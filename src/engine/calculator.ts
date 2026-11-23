import { BENCHMARK_SCENARIOS } from '@/data/presets';
import { formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import type {
  BottleneckType,
  FormulaStep,
  GlobalEvalSettings,
  ModelEvalResult,
  ModelSpec,
  ScenarioDefinition,
  ScenarioWeightDetail,
  WorkloadConfig,
  WorkloadEvalDetail,
} from '@/types/calculator';

const BASELINE_PREFILL_WEIGHT = 0.25;

function getScenarioTotalLen(sc: ScenarioDefinition): number {
  return sc.promptTokens + sc.outputTokens;
}

function getScenarioEffPrefill(sc: ScenarioDefinition): number {
  return sc.promptTokens * (1 - sc.cacheHitRate);
}

function getScenarioTrueTpotMs(
  model: ModelSpec,
  sc: ScenarioDefinition,
): number {
  const bench = model.benchmarks[sc.key];
  const cycleMs =
    (1000 * Math.max(bench.conc, 1) * Math.max(sc.outputTokens, 1)) /
    Math.max(bench.outputTps, 1);
  const decodeMs = Math.max(cycleMs - bench.ttftMs, 0.15 * cycleMs);
  return decodeMs / Math.max(sc.outputTokens, 1);
}

export function getScenarioWeightedTps(
  model: ModelSpec,
  scenario: ScenarioDefinition,
): number {
  const bench = model.benchmarks[scenario.key];
  const effPrefillRatio =
    (scenario.promptTokens * (1 - scenario.cacheHitRate)) /
    Math.max(scenario.outputTokens, 1);
  return bench.outputTps * (1 + effPrefillRatio * BASELINE_PREFILL_WEIGHT);
}

export function computeScenarioWeights(
  inputTokens: number,
  outputTokens: number,
): ScenarioWeightDetail[] {
  const s1 = BENCHMARK_SCENARIOS[0];
  const s2 = BENCHMARK_SCENARIOS[1];
  const s3 = BENCHMARK_SCENARIOS[2];

  const totalLen = Math.max(inputTokens + outputTokens, 128);
  const x = Math.log2(totalLen);
  const x1 = Math.log2(getScenarioTotalLen(s1));
  const x2 = Math.log2(getScenarioTotalLen(s2));
  const x3 = Math.log2(getScenarioTotalLen(s3));

  let w1 = 0;
  let w2 = 0;
  let w3 = 0;

  if (x <= x1) {
    w1 = 1;
  } else if (x <= x2) {
    const t = (x - x1) / Math.max(x2 - x1, 0.0001);
    w1 = 1 - t;
    w2 = t;
  } else if (x <= x3) {
    const t = (x - x2) / Math.max(x3 - x2, 0.0001);
    w2 = 1 - t;
    w3 = t;
  } else {
    w3 = 1;
  }

  return [
    {
      key: s1.key,
      code: s1.code,
      label: s1.label,
      weight: w1,
      distance: Math.abs(x - x1),
    },
    {
      key: s2.key,
      code: s2.code,
      label: s2.label,
      weight: w2,
      distance: Math.abs(x - x2),
    },
    {
      key: s3.key,
      code: s3.code,
      label: s3.label,
      weight: w3,
      distance: Math.abs(x - x3),
    },
  ];
}

function interpolateTtftMs(
  model: ModelSpec,
  inputTokens: number,
  cacheHitRate: number,
): number {
  const s1 = BENCHMARK_SCENARIOS[0];
  const s2 = BENCHMARK_SCENARIOS[1];
  const s3 = BENCHMARK_SCENARIOS[2];

  const e1 = getScenarioEffPrefill(s1);
  const e3 = getScenarioEffPrefill(s3);
  const e2 = getScenarioEffPrefill(s2);

  const t1 = model.benchmarks[s1.key].ttftMs;
  const t3 = model.benchmarks[s3.key].ttftMs;
  const t2 = model.benchmarks[s2.key].ttftMs;

  const effPrefill = Math.max(0, inputTokens * (1 - cacheHitRate));

  if (effPrefill <= e1) {
    const t0 = t1 * 0.4;
    const ratio = e1 > 0 ? effPrefill / e1 : 0;
    return t0 + (t1 - t0) * ratio;
  }
  if (effPrefill <= e3) {
    const ratio = (effPrefill - e1) / Math.max(e3 - e1, 1);
    return t1 + (t3 - t1) * ratio;
  }
  if (effPrefill <= e2) {
    const ratio = (effPrefill - e3) / Math.max(e2 - e3, 1);
    return t3 + (t2 - t3) * ratio;
  }

  const slope = Math.max(t2 - t1, 50) / Math.max(e2 - e1, 1);
  const longCtxFactor = 1 + (0.25 * Math.max(inputTokens - s2.promptTokens, 0)) / 65536;
  return t2 + slope * (effPrefill - e2) * longCtxFactor;
}

function evaluateSingleWorkload(
  model: ModelSpec,
  workload: WorkloadConfig,
  settings: GlobalEvalSettings,
): WorkloadEvalDetail {
  const safePeakHours = Math.max(workload.peakHours, 0.1);
  const safeTurns = Math.max(workload.turnsPerTask, 1);
  const safeDailyTasks = Math.max(workload.dailyTasks, 0);
  const minPeakShare = Math.min(safePeakHours / 24, 1);
  const safePeakShare = Math.min(
    Math.max(workload.peakTrafficShare, minPeakShare),
    1,
  );
  const safeBurst = Math.max(workload.burstFactor, 1);
  const safeCacheHit = Math.min(Math.max(workload.cacheHitRate, 0), 0.99);
  const safeInput = Math.max(workload.avgInputTokens, 1);
  const safeOutput = Math.max(workload.avgOutputTokens, 1);
  const safeUtil = Math.min(Math.max(settings.targetUtil, 0.2), 1);

  const dailyRequests = safeDailyTasks * safeTurns;
  const peakAvgRps = settings.enablePeakModel
    ? (dailyRequests * safePeakShare) / (safePeakHours * 3600)
    : dailyRequests / (24 * 3600);
  const burstRps = settings.enablePeakModel
    ? peakAvgRps * safeBurst
    : peakAvgRps;

  const peakOutputTps = burstRps * safeOutput;
  const rawPrefillTps = burstRps * safeInput;
  const effectivePrefillTps = rawPrefillTps * (1 - safeCacheHit);
  const savedPrefillTps = rawPrefillTps - effectivePrefillTps;
  const weightedDemandTps =
    peakOutputTps + effectivePrefillTps * settings.prefillWeight;

  const weights = computeScenarioWeights(safeInput, safeOutput);
  const s1 = BENCHMARK_SCENARIOS[0];
  const s2 = BENCHMARK_SCENARIOS[1];
  const s3 = BENCHMARK_SCENARIOS[2];
  const l2 = getScenarioTotalLen(s2);
  const l3 = getScenarioTotalLen(s3);
  const totalLen = safeInput + safeOutput;

  const b1 = model.benchmarks[s1.key];
  const b2 = model.benchmarks[s2.key];
  const b3 = model.benchmarks[s3.key];

  const cap1 = getScenarioWeightedTps(model, s1);
  const cap2 = Math.min(getScenarioWeightedTps(model, s2), cap1);
  const cap3 = Math.min(getScenarioWeightedTps(model, s3), cap2);
  const caps = [cap1, cap2, cap3];

  const tpot1 = getScenarioTrueTpotMs(model, s1);
  const tpot2 = getScenarioTrueTpotMs(model, s2);
  const tpot3 = getScenarioTrueTpotMs(model, s3);
  const tpots = [tpot1, tpot2, tpot3];

  let instOutputTps = 0;
  let instWeightedTps = 0;
  let instConc = 0;
  let estTpotMs = 0;

  if (totalLen <= l3) {
    const benches = [b1, b2, b3];
    for (let i = 0; i < weights.length; i += 1) {
      const w = weights[i].weight;
      instOutputTps += w * benches[i].outputTps;
      instWeightedTps += w * caps[i];
      instConc += w * benches[i].conc;
      estTpotMs += w * tpots[i];
    }
  } else {
    const lenRatio = l3 / totalLen;
    const rawAlpha =
      Math.log(Math.max(b2.outputTps, 1) / Math.max(b3.outputTps, 1)) /
      Math.max(Math.log(l3 / l2), 0.0001);
    const alpha = Math.min(Math.max(rawAlpha, 0.3), 0.8);
    const scaleFactor = Math.pow(lenRatio, alpha);

    instConc = b3.conc * lenRatio;
    instOutputTps = b3.outputTps * scaleFactor;
    instWeightedTps = cap3 * scaleFactor;

    const perStream3 = b3.outputTps / Math.max(b3.conc, 1);
    const perStreamL = instOutputTps / Math.max(instConc, 0.1);
    estTpotMs = tpot3 * Math.max(1, perStream3 / Math.max(perStreamL, 0.1));
  }

  instOutputTps = Math.max(instOutputTps, 1);
  instWeightedTps = Math.max(instWeightedTps, 1);
  instConc = Math.max(instConc, 0.5);

  const estTtftMs = interpolateTtftMs(model, safeInput, safeCacheHit);
  const estLatencySec = estTtftMs / 1000 + (safeOutput * estTpotMs) / 1000;
  const peakConcurrency = burstRps * estLatencySec;

  const instByDecode = peakOutputTps / (instOutputTps * safeUtil);
  const instByCompute = weightedDemandTps / (instWeightedTps * safeUtil);
  const instByConc = peakConcurrency / (instConc * safeUtil);

  return {
    workload,
    dailyRequests,
    peakAvgRps,
    burstRps,
    peakOutputTps,
    rawPrefillTps,
    effectivePrefillTps,
    savedPrefillTps,
    weightedDemandTps,
    weights,
    instOutputTps,
    instWeightedTps,
    instConc,
    estTtftMs,
    estTpotMs,
    estLatencySec,
    peakConcurrency,
    instByDecode,
    instByCompute,
    instByConc,
  };
}

function getBottleneckMeta(
  instByDecode: number,
  instByCompute: number,
  instByConc: number,
): { type: BottleneckType; label: string } {
  if (instByConc >= instByDecode && instByConc >= instByCompute) {
    return { type: 'concurrency', label: '并发槽位瓶颈（同时在线路数）' };
  }
  if (instByCompute >= instByDecode && instByCompute >= instByConc) {
    return { type: 'compute', label: '读写综合算力瓶颈（输入+输出）' };
  }
  return { type: 'decode', label: '生成速度瓶颈（输出 Token/s）' };
}

function buildFormulaSteps(
  model: ModelSpec,
  details: WorkloadEvalDetail[],
  settings: GlobalEvalSettings,
  totals: {
    totalPeakAvgRps: number;
    totalBurstRps: number;
    totalPeakOutputTps: number;
    totalRawPrefillTps: number;
    totalEffectivePrefillTps: number;
    totalWeightedDemandTps: number;
    totalPeakConcurrency: number;
    effectiveInstOutputTps: number;
    effectiveInstWeightedTps: number;
    effectiveInstConc: number;
    avgEstTtftMs: number;
    avgEstTpotMs: number;
    avgEstLatencySec: number;
    instByDecode: number;
    instByCompute: number;
    instByConc: number;
    bottleneckLabel: string;
    baseInstances: number;
    finalInstances: number;
    totalCards910B3: number;
    totalServers8Card: number;
    primaryWeights: ScenarioWeightDetail[];
  },
): FormulaStep[] {
  const isSingle = details.length === 1;
  const first = details[0];
  const utilPct = formatPercent(settings.targetUtil, 0);

  const step1Sub = settings.enablePeakModel
    ? isSingle
      ? `高峰均值 RPS = (${formatNumber(first.workload.dailyTasks)} × ${first.workload.turnsPerTask} × ${formatPercent(Math.max(first.workload.peakTrafficShare, first.workload.peakHours / 24), 0)}) ÷ (${first.workload.peakHours} × 3600) = ${formatDecimal(first.peakAvgRps, 2)} req/s；突发峰值 RPS = ${formatDecimal(first.peakAvgRps, 2)} × ${first.workload.burstFactor} = ${formatDecimal(first.burstRps, 2)} req/s`
      : `按同峰最坏重叠（同时率 1.0）累加 ${details.length} 个场景：${details.map((d) => `${d.workload.name}(${formatDecimal(d.burstRps, 2)})`).join(' + ')} = ${formatDecimal(totals.totalBurstRps, 2)} req/s`
    : isSingle
      ? `未开启高峰模型，按全天 24 小时均匀分摊：均值 RPS = (${formatNumber(first.workload.dailyTasks)} × ${first.workload.turnsPerTask}) ÷ (24 × 3600) = ${formatDecimal(first.burstRps, 2)} req/s`
      : `未开启高峰模型，${details.length} 个场景按全天 24 小时均摊累加：${details.map((d) => `${d.workload.name}(${formatDecimal(d.burstRps, 2)})`).join(' + ')} = ${formatDecimal(totals.totalBurstRps, 2)} req/s`;

  const step2Sub = isSingle
    ? `峰值输出吞吐 = ${formatDecimal(first.burstRps, 2)} × ${formatNumber(first.workload.avgOutputTokens)} = ${formatNumber(first.peakOutputTps, 0)} tok/s；未命中有效输入 = ${formatDecimal(first.burstRps, 2)} × ${formatNumber(first.workload.avgInputTokens)} × (1 - ${formatPercent(first.workload.cacheHitRate, 0)}) = ${formatNumber(first.effectivePrefillTps, 0)} tok/s；读写综合需求 = ${formatNumber(first.peakOutputTps, 0)} + ${formatNumber(first.effectivePrefillTps, 0)} × ${settings.prefillWeight} = ${formatNumber(first.weightedDemandTps, 0)} tok/s`
    : `汇总输出吞吐 = ${formatNumber(totals.totalPeakOutputTps, 0)} tok/s；未命中有效输入 = ${formatNumber(totals.totalEffectivePrefillTps, 0)} tok/s；读写综合需求 = ${formatNumber(totals.totalPeakOutputTps, 0)} + ${formatNumber(totals.totalEffectivePrefillTps, 0)} × ${settings.prefillWeight} = ${formatNumber(totals.totalWeightedDemandTps, 0)} tok/s`;

  const weightSummary = totals.primaryWeights
    .map((w) => `${w.code}(${formatPercent(w.weight, 1)})`)
    .join(' + ');

  const step3Sub = `按总上下文长度 L = 输入 + 输出 在对数轴分段插值（${weightSummary}）→ 单实例输出吞吐 ${formatNumber(totals.effectiveInstOutputTps, 0)} tok/s、稳态并发 ${formatDecimal(totals.effectiveInstConc, 1)} 路、扣除 TTFT 后纯生成 TPOT ${formatDecimal(totals.avgEstTpotMs, 1)} ms；TTFT 按未命中输入量独立插值得 ${formatNumber(totals.avgEstTtftMs, 0)} ms`;

  const step4Sub = isSingle
    ? `单次响应总耗时 = 首字等待 ${formatNumber(first.estTtftMs, 0)}/1000 + 生成阶段 (${formatNumber(first.workload.avgOutputTokens)} × ${formatDecimal(first.estTpotMs, 1)})/1000 = ${formatDecimal(first.estLatencySec, 2)} s；同时在线路数 = ${formatDecimal(first.burstRps, 2)} req/s × ${formatDecimal(first.estLatencySec, 2)} s = ${formatDecimal(first.peakConcurrency, 1)} 路`
    : `各场景分别按「RPS × 单次响应总耗时」求在线并发后累加：${details.map((d) => `${d.workload.name}(${formatDecimal(d.peakConcurrency, 1)}路)`).join(' + ')} = ${formatDecimal(totals.totalPeakConcurrency, 1)} 路`;

  const step5Sub = `① 生成速度维 = ${formatNumber(totals.totalPeakOutputTps, 0)} ÷ (${formatNumber(totals.effectiveInstOutputTps, 0)} × ${utilPct}) = ${formatDecimal(totals.instByDecode, 2)} 实例；② 读写综合算力维 = ${formatNumber(totals.totalWeightedDemandTps, 0)} ÷ (${formatNumber(totals.effectiveInstWeightedTps, 0)} × ${utilPct}) = ${formatDecimal(totals.instByCompute, 2)} 实例；③ 并发槽位维 = ${formatDecimal(totals.totalPeakConcurrency, 1)} ÷ (${formatDecimal(totals.effectiveInstConc, 1)} × ${utilPct}) = ${formatDecimal(totals.instByConc, 2)} 实例 → 按木桶短板取三者最大值 = ${formatDecimal(totals.baseInstances, 2)} 实例`;

  const chipModel = model.chipModel || '910B3';
  const cardsPerServer = Math.max(1, model.cardsPerServer || 8);

  const step6Sub = settings.enableNPlusOne
    ? `开启 N+1 冗余：${formatDecimal(totals.baseInstances, 2)} + 1 = ${formatDecimal(totals.finalInstances, 2)} 实例；${chipModel} 卡数 = ceil((${formatDecimal(totals.finalInstances, 2)} × ${model.cardsPerInstance}) × 10) ÷ 10 = ${formatDecimal(totals.totalCards910B3, 1)} 卡；${cardsPerServer} 卡服务器 = ${formatDecimal(totals.totalCards910B3, 1)} ÷ ${cardsPerServer} = ${formatDecimal(totals.totalServers8Card, 2)} 台`
    : `未开启 N+1 冗余：最终 ${formatDecimal(totals.finalInstances, 2)} 实例；${chipModel} 卡数 = ceil((${formatDecimal(totals.finalInstances, 2)} × ${model.cardsPerInstance}) × 10) ÷ 10 = ${formatDecimal(totals.totalCards910B3, 1)} 卡；${cardsPerServer} 卡服务器 = ${formatDecimal(totals.totalCards910B3, 1)} ÷ ${cardsPerServer} = ${formatDecimal(totals.totalServers8Card, 2)} 台`;

  return [
    {
      stepNumber: 1,
      title: settings.enablePeakModel
        ? '互联网高峰与突发请求率（Burst RPS）'
        : '全天均值请求率（24h 均摊 RPS）',
      subtitle: settings.enablePeakModel
        ? '将日均任务按高峰时段集中度与瞬时峰值系数折算为峰值每秒请求数'
        : '已关闭高峰突发模型，按全天 24 小时均匀分布计算每秒请求数',
      formula: settings.enablePeakModel
        ? 'peakAvgRps = (dailyTasks × turns × peakShare) / (peakHours × 3600);  burstRps = peakAvgRps × burstFactor'
        : 'avgRps = (dailyTasks × turns) / (24 × 3600)',
      substitution: step1Sub,
      resultLabel: settings.enablePeakModel ? '突发峰值 RPS' : '全天均值 RPS',
      resultValue: `${formatDecimal(totals.totalBurstRps, 2)} req/s`,
    },
    {
      stepNumber: 2,
      title: '读写 Token 吞吐需求（KV-Cache 折减）',
      subtitle: '已命中 KV-Cache 的输入无需重复计算，剩余有效输入按权重 γ_pd 折算为等效输出算力',
      formula:
        'effectiveInput = burstRps × inTok × (1 - cacheHit);  combinedDemand = peakOutTps + effectiveInput × γ_pd',
      substitution: step2Sub,
      resultLabel: '读写综合吞吐',
      resultValue: `${formatNumber(totals.totalWeightedDemandTps, 0)} tok/s`,
      note:
        totals.totalRawPrefillTps > 0
          ? `KV-Cache 命中节省了 ${formatNumber(totals.totalRawPrefillTps - totals.totalEffectivePrefillTps, 0)} tok/s 的输入计算（节省 ${formatPercent((totals.totalRawPrefillTps - totals.totalEffectivePrefillTps) / totals.totalRawPrefillTps, 1)}）`
          : undefined,
    },
    {
      stepNumber: 3,
      title: '三场景解耦插值与单实例能力推算',
      subtitle: '吞吐与并发仅随总上下文长度 L = 输入+输出 变化（不因缓存命中率上升而倒挂），TTFT 独立随未命中输入量变化',
      formula:
        'L = inTok + outTok → 对数分段插值/外推(outputTps, conc, trueTpot);  E = inTok×(1 - cacheHit) → 分段插值/外推(TTFT)',
      substitution: step3Sub,
      resultLabel: '单实例输出吞吐',
      resultValue: `${formatNumber(totals.effectiveInstOutputTps, 0)} tok/s`,
    },
    {
      stepNumber: 4,
      title: '同时在线并发路数推导（Little’s Law）',
      subtitle: '用「首字等待 TTFT + 扣除首字后的纯生成耗时」算出单请求占用时长，乘以 RPS 得峰值在线路数',
      formula:
        'latency = TTFT/1000 + (outTok × trueTPOT)/1000;  peakConcurrency = burstRps × latency',
      substitution: step4Sub,
      resultLabel: '峰值同时在线路数',
      resultValue: `${formatDecimal(totals.totalPeakConcurrency, 1)} 路`,
    },
    {
      stepNumber: 5,
      title: '三维度短板校核与安全水位折算',
      subtitle: '生成速度、读写综合算力、并发槽位三项必须同时达标，按木桶效应取最大值作为基础实例数',
      formula:
        '① 生成速度维 = peakOutTps / (instOutTps × Util)  |  ② 读写综合算力维 = combinedDemand / (instCombinedTps × Util)  |  ③ 并发槽位维 = peakConc / (instConc × Util)  →  base = max(①, ②, ③)',
      substitution: step5Sub,
      resultLabel: `基础实例数（${totals.bottleneckLabel}）`,
      resultValue: `${formatDecimal(totals.baseInstances, 2)} 实例`,
    },
    {
      stepNumber: 6,
      title: 'N+1 高可用冗余与硬件规模换算',
      subtitle: `按共享集群资源折算 ${chipModel} 卡数（按 0.1 卡精度向上取整），再除以单机 ${cardsPerServer} 卡折算服务器台数`,
      formula: `finalInstances = base + (N+1 ? 1 : 0);  cards = ceil((final × cardsPerInst) × 10) / 10;  servers = cards / ${cardsPerServer}`,
      substitution: step6Sub,
      resultLabel: '最终硬件规模',
      resultValue: `${formatDecimal(totals.totalCards910B3, 1)} 卡 / ${formatDecimal(totals.totalServers8Card, 2)} 台 ${cardsPerServer} 卡机`,
    },
  ];
}

export function evaluateModel(
  model: ModelSpec,
  workloads: WorkloadConfig[],
  settings: GlobalEvalSettings,
): ModelEvalResult {
  const activeWorkloads = workloads.filter((w) => w.enabled);
  const safeWorkloads =
    activeWorkloads.length > 0 ? activeWorkloads : workloads.slice(0, 1);

  const details = safeWorkloads.map((w) =>
    evaluateSingleWorkload(model, w, settings),
  );

  const totalDailyTasks = details.reduce((s, d) => s + d.workload.dailyTasks, 0);
  const totalDailyRequests = details.reduce((s, d) => s + d.dailyRequests, 0);
  const totalPeakAvgRps = details.reduce((s, d) => s + d.peakAvgRps, 0);
  const totalBurstRps = details.reduce((s, d) => s + d.burstRps, 0);
  const totalPeakOutputTps = details.reduce((s, d) => s + d.peakOutputTps, 0);
  const totalRawPrefillTps = details.reduce((s, d) => s + d.rawPrefillTps, 0);
  const totalEffectivePrefillTps = details.reduce(
    (s, d) => s + d.effectivePrefillTps,
    0,
  );
  const totalSavedPrefillTps = details.reduce(
    (s, d) => s + d.savedPrefillTps,
    0,
  );
  const totalWeightedDemandTps = details.reduce(
    (s, d) => s + d.weightedDemandTps,
    0,
  );
  const totalPeakConcurrency = details.reduce(
    (s, d) => s + d.peakConcurrency,
    0,
  );

  const instByDecode = details.reduce((s, d) => s + d.instByDecode, 0);
  const instByCompute = details.reduce((s, d) => s + d.instByCompute, 0);
  const instByConc = details.reduce((s, d) => s + d.instByConc, 0);

  const safeUtil = Math.min(Math.max(settings.targetUtil, 0.2), 1);

  const effectiveInstOutputTps =
    instByDecode > 0
      ? totalPeakOutputTps / (instByDecode * safeUtil)
      : details[0].instOutputTps;
  const effectiveInstWeightedTps =
    instByCompute > 0
      ? totalWeightedDemandTps / (instByCompute * safeUtil)
      : details[0].instWeightedTps;
  const effectiveInstConc =
    instByConc > 0
      ? totalPeakConcurrency / (instByConc * safeUtil)
      : details[0].instConc;

  const rpsDenom = totalBurstRps > 0 ? totalBurstRps : 1;
  const avgEstTtftMs =
    totalBurstRps > 0
      ? details.reduce((s, d) => s + d.estTtftMs * d.burstRps, 0) / rpsDenom
      : details[0].estTtftMs;
  const avgEstTpotMs =
    totalBurstRps > 0
      ? details.reduce((s, d) => s + d.estTpotMs * d.burstRps, 0) / rpsDenom
      : details[0].estTpotMs;
  const avgEstLatencySec =
    totalBurstRps > 0
      ? details.reduce((s, d) => s + d.estLatencySec * d.burstRps, 0) / rpsDenom
      : details[0].estLatencySec;

  const primaryWeights: ScenarioWeightDetail[] = BENCHMARK_SCENARIOS.map(
    (sc, idx) => {
      if (totalBurstRps <= 0) {
        return details[0].weights[idx];
      }
      const weightedW =
        details.reduce((s, d) => s + d.weights[idx].weight * d.burstRps, 0) /
        totalBurstRps;
      const weightedD =
        details.reduce((s, d) => s + d.weights[idx].distance * d.burstRps, 0) /
        totalBurstRps;
      return {
        key: sc.key,
        code: sc.code,
        label: sc.label,
        weight: weightedW,
        distance: weightedD,
      };
    },
  );

  const bottleneck = getBottleneckMeta(instByDecode, instByCompute, instByConc);
  const maxDim = Math.max(instByDecode, instByCompute, instByConc);
  const rawBaseInstances = maxDim;
  const rawFinalInstances =
    maxDim > 0
      ? settings.enableNPlusOne
        ? rawBaseInstances + 1
        : rawBaseInstances
      : 0;

  const baseInstances =
    rawBaseInstances > 0
      ? Math.ceil(rawBaseInstances * 100 - 1e-9) / 100
      : 0;
  const finalInstances =
    rawFinalInstances > 0
      ? Math.ceil(rawFinalInstances * 100 - 1e-9) / 100
      : 0;

  const cardsPerServer = Math.max(1, model.cardsPerServer || 8);
  const rawCards910B3 = rawFinalInstances * model.cardsPerInstance;
  const totalCards910B3 =
    rawCards910B3 > 0
      ? Math.max(0.1, Math.ceil(rawCards910B3 * 10 - 1e-9) / 10)
      : 0;
  const totalServers8Card =
    totalCards910B3 > 0
      ? Number((totalCards910B3 / cardsPerServer).toFixed(2))
      : 0;

  const cardUtilizationInServers =
    totalCards910B3 > 0 ? Math.min(1, rawCards910B3 / totalCards910B3) : 0;
  const allocatedInstances =
    model.cardsPerInstance > 0 ? totalCards910B3 / model.cardsPerInstance : 0;
  const actualPeakUtil =
    allocatedInstances > 0
      ? Math.min(1, (maxDim * safeUtil) / allocatedInstances)
      : 0;

  const formulaSteps = buildFormulaSteps(model, details, settings, {
    totalPeakAvgRps,
    totalBurstRps,
    totalPeakOutputTps,
    totalRawPrefillTps,
    totalEffectivePrefillTps,
    totalWeightedDemandTps,
    totalPeakConcurrency,
    effectiveInstOutputTps,
    effectiveInstWeightedTps,
    effectiveInstConc,
    avgEstTtftMs,
    avgEstTpotMs,
    avgEstLatencySec,
    instByDecode,
    instByCompute,
    instByConc,
    bottleneckLabel: bottleneck.label,
    baseInstances,
    finalInstances,
    totalCards910B3,
    totalServers8Card,
    primaryWeights,
  });

  return {
    model,
    activeWorkloadCount: details.length,
    workloadDetails: details,
    totalDailyTasks,
    totalDailyRequests,
    totalPeakAvgRps,
    totalBurstRps,
    totalPeakOutputTps,
    totalRawPrefillTps,
    totalEffectivePrefillTps,
    totalSavedPrefillTps,
    totalWeightedDemandTps,
    totalPeakConcurrency,
    effectiveInstOutputTps,
    effectiveInstWeightedTps,
    effectiveInstConc,
    avgEstTtftMs,
    avgEstTpotMs,
    avgEstLatencySec,
    instByDecode,
    instByCompute,
    instByConc,
    bottleneckType: bottleneck.type,
    bottleneckLabel: bottleneck.label,
    baseInstances,
    finalInstances,
    totalCards910B3,
    totalServers8Card,
    cardUtilizationInServers,
    actualPeakUtil,
    primaryWeights,
    formulaSteps,
  };
}

export function evaluateAllModels(
  models: ModelSpec[],
  workloads: WorkloadConfig[],
  settings: GlobalEvalSettings,
): ModelEvalResult[] {
  return models.map((model) => evaluateModel(model, workloads, settings));
}
