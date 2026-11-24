import { BENCHMARK_SCENARIOS } from '@/data/presets';
import {
  formatDecimal,
  formatDuration,
  formatNumber,
  formatPercent,
  formatTokenVolume,
} from '@/lib/format';
import type { GlobalEvalSettings, ModelEvalResult } from '@/types/calculator';

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function buildRecommendations(
  result: ModelEvalResult,
  settings: GlobalEvalSettings,
): string[] {
  const items: string[] = [];

  if (result.bottleneckType === 'decode') {
    items.push(
      `当前主导瓶颈为 **生成速度瓶颈（输出 Token/s）**，建议优先开启连续批处理（Continuous Batching）与投机解码（Speculative Decoding / MTP），并在满足业务精度前提下采用 W8A8 / W4A8 量化提升单卡显存带宽利用率。`,
    );
  } else if (result.bottleneckType === 'compute') {
    items.push(
      `当前主导瓶颈为 **读写综合算力瓶颈（输入 + 输出）**，建议在推理网关层启用前缀亲和路由（Prefix-Aware Routing）并扩大 KV-Cache 显存/主存二级缓存池，持续提升公共系统提示词与知识库切片的缓存命中率；在长输入占比高的集群可评估 PD 分离架构。`,
    );
  } else {
    items.push(
      `当前主导瓶颈为 **并发槽位瓶颈（同时在线路数）**，建议开启 PagedAttention / KV-Cache 量化（INT8/FP8 KV）以压缩单路上下文显存占用，并在高峰时段配置合理的请求队列与流控阈值，避免长尾排队引发显存抢占。`,
    );
  }

  if (!settings.enableNPlusOne) {
    items.push(
      `当前测算未开启 N+1 冗余，若该业务属于核心生产级联机服务，建议在共享集群池层面额外预留 **1 个热备实例（+${result.model.cardsPerInstance} 卡）** 或依托多业务错峰弹性池兜底，防止单节点故障触发降级。`,
    );
  } else {
    items.push(
      `当前方案已包含 N+1 高可用热备实例，可在任意单实例故障或滚动升级期间保持高峰水位处于目标阈值（${formatPercent(settings.targetUtil, 0)}）以内。`,
    );
  }

  items.push(
    `本报告按共享算力池模式以 **0.1 卡** 为粒度向上取整输出卡数份额（${formatDecimal(result.totalCards910B3, 1)} 卡，折合 ${formatDecimal(result.totalServers8Card, 2)} 台 ${result.model.cardsPerServer} 卡服务器）；实际采购与机房上架规划时，建议将同架构智能体合并建池后统一按整机向上取整。`,
  );

  return items;
}

export function generateFormalReport(
  result: ModelEvalResult,
  settings: GlobalEvalSettings,
): string {
  const now = new Date();
  const savedRatio =
    result.totalRawPrefillTps > 0
      ? result.totalSavedPrefillTps / result.totalRawPrefillTps
      : 0;

  const workloadRows = result.workloadDetails.map((d) => {
    const w = d.workload;
    const safePeakHours = Math.min(Math.max(w.peakHours, 0.1), 8);
    return `| ${w.name} | ${formatNumber(Math.max(w.dailyTasks, 0), 0)} | ${Math.max(w.turnsPerTask, 1)} | ${formatNumber(Math.max(w.avgInputTokens, 1), 0)} / ${formatNumber(Math.max(w.avgOutputTokens, 1), 0)} | ${formatPercent(w.cacheHitRate, 0)} | ${safePeakHours}h / ${formatPercent(w.peakTrafficShare, 0)} | ${w.burstFactor}× | ${formatDecimal(d.burstRps, 2)} | ${formatDecimal(d.peakConcurrency, 1)} |`;
  });

  const benchmarkRows = BENCHMARK_SCENARIOS.map((sc) => {
    const b = result.model.benchmarks[sc.key];
    const perStream = b.outputTps / Math.max(b.conc, 1);
    const weightItem = result.primaryWeights.find((w) => w.key === sc.key);
    const weightPct = weightItem ? formatPercent(weightItem.weight, 1) : '0.0%';
    return `| ${sc.code} · ${sc.label} | ${formatNumber(sc.promptTokens, 0)} / ${formatNumber(sc.outputTokens, 0)} / ${formatPercent(sc.cacheHitRate, 0)} | ${b.conc} 路 | ${formatNumber(b.outputTps, 0)} tok/s | ${formatDecimal(perStream, 1)} tok/s | ${formatNumber(b.ttftMs, 0)} ms | ${weightPct} |`;
  });

  const stepSections = result.formulaSteps.map((step) => {
    const noteLine = step.note ? `\n- **关键说明**：${step.note}` : '';
    return [
      `### 步骤 ${step.stepNumber}：${step.title}`,
      `- **推导公式**：\`${step.formula}\``,
      `- **参数代入**：${step.substitution}`,
      `- **阶段结论**：${step.resultLabel} = **${step.resultValue}**${noteLine}`,
    ].join('\n');
  });

  const recommendations = buildRecommendations(result, settings);

  const sections = [
    `# 智能体算力需求评估报告`,
    ``,
    `> **生成时间**：${formatDateTime(now)}  `,
    `> **评估模型**：${result.model.name}（${result.model.totalParams} 总参 / ${result.model.activeParams} 激活，${result.model.precision}）  `,
    `> **资源模式**：共享集群资源池（卡数按 0.1 卡精度向上取整，台数按单机 ${result.model.cardsPerServer} 卡折算）  `,
    `> **评估策略**：目标安全水位 ${formatPercent(settings.targetUtil, 0)} ｜ 高峰突发建模：${settings.enablePeakModel ? '已开启' : '已关闭（8h 工作日均摊）'} ｜ Prefill 算力权重 γ_pd = ${settings.prefillWeight.toFixed(2)} ｜ N+1 冗余：${settings.enableNPlusOne ? '已开启' : '未开启'}`,
    ``,
    `---`,
    ``,
    `## 一、执行摘要（Executive Summary）`,
    ``,
    `针对本次纳入评估的 **${result.activeWorkloadCount} 个智能体业务场景**（合计日均任务 **${formatNumber(result.totalDailyTasks, 0)} 次**、日均模型调用 **${formatNumber(result.totalDailyRequests, 0)} 次**），在互联网高峰时段集中度与瞬时突发峰值约束下，采用 **${result.model.name}** 模型的算力需求测算结论如下：`,
    ``,
    `| 核心评估指标 | 测算结果 | 备注说明 |`,
    `| :--- | :--- | :--- |`,
    `| **选定评估模型** | ${result.model.name} | 单实例：${result.model.cardsPerInstance} 卡 ${result.model.chipModel}（单机 ${result.model.cardsPerServer} 卡） |`,
    `| **所需推理实例数** | **${formatDecimal(result.finalInstances, 2)} 实例** | ${result.finalInstances === 0 ? '当前业务流量为 0，无需分配算力实例' : `基础 ${formatDecimal(result.baseInstances, 2)} 实例${settings.enableNPlusOne ? ' + 1 热备（N+1）' : '（未开启 N+1）'}`} |`,
    `| **${result.model.chipModel} 卡数需求** | **${formatDecimal(result.totalCards910B3, 1)} 卡** | 按 0.1 卡精度向上取整 |`,
    `| **${result.model.cardsPerServer} 卡服务器需求规模** | **${formatDecimal(result.totalServers8Card, 2)} 台** | 按 ${formatDecimal(result.totalCards910B3, 1)} 卡 ÷ ${result.model.cardsPerServer} 卡/台 折算 |`,
    `| **日 Tokens 消耗（入 / 出 / 缓存）** | ${formatTokenVolume(result.totalDailyInputTokens)} / ${formatTokenVolume(result.totalDailyOutputTokens)} / ${formatTokenVolume(result.totalDailyCachedTokens)} | 平均 KV-Cache 命中率 ${formatPercent(result.avgCacheHitRate, 1)} |`,
    `| **日任务量与单任务平均时长** | ${formatNumber(result.totalDailyTasks, 0)} 次/日 · ${formatDuration(result.avgTaskDurationSec)} | 含各轮模型调用累计推理耗时（单次均值 ${formatDecimal(result.avgEstLatencySec, 2)} s） |`,
    `| **峰值突发请求率（Burst RPS）** | ${formatDecimal(result.totalBurstRps, 2)} req/s | 高峰均值 ${formatDecimal(result.totalPeakAvgRps, 2)} req/s |`,
    `| **峰值输出吞吐 / 瞬时并发** | ${formatNumber(result.totalPeakOutputTps, 0)} tok/s / ${formatDecimal(result.totalPeakConcurrency, 1)} 路 | 估算 TTFT ${formatNumber(result.avgEstTtftMs, 0)} ms · 单路输出速度 ${formatDecimal(1000 / Math.max(result.avgEstTpotMs, 0.1), 1)} tok/s · 单次均值耗时 ${formatDecimal(result.avgEstLatencySec, 2)} s |`,
    `| **主导性能瓶颈与峰值水位** | ${result.bottleneckLabel}（${formatPercent(result.actualPeakUtil, 1)}） | 目标安全水位上限 ${formatPercent(settings.targetUtil, 0)} |`,
    ``,
    `---`,
    ``,
    `## 二、智能体业务需求与流量模型`,
    ``,
    `| 场景名称 | 日均任务数 | 调用轮次 | 单次输入 / 输出 Token | KV-Cache 命中率 | 高峰时长 / 占比 | 峰值系数 | 突发 RPS | 峰值并发贡献 |`,
    `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |`,
    ...workloadRows,
    `| **合计（共享池叠加）** | **${formatNumber(result.totalDailyTasks, 0)}** | - | - | - | - | - | **${formatDecimal(result.totalBurstRps, 2)}** | **${formatDecimal(result.totalPeakConcurrency, 1)}** |`,
    ``,
    `- **KV-Cache 算力收益**：高峰原始输入吞吐为 **${formatNumber(result.totalRawPrefillTps, 0)} tok/s**，经 KV-Cache 命中折减后有效 Prefill 吞吐降至 **${formatNumber(result.totalEffectivePrefillTps, 0)} tok/s**，累计节省 **${formatPercent(savedRatio, 1)}** 的 Prefill 算力开销。`,
    ``,
    `---`,
    ``,
    `## 三、白盒计算过程与 6 步公式推导`,
    ``,
    ...stepSections,
    ``,
    `---`,
    ``,
    `## 四、工程部署与优化建议`,
    ``,
    ...recommendations.map((rec, i) => `${i + 1}. ${rec}`),
    ``,
    `---`,
    ``,
    `## 附录：选定模型压测基准结果（${result.model.name}）`,
    ``,
    `### A.1 模型与单实例硬件配置`,
    ``,
    `| 配置项 | 参数值 |`,
    `| :--- | :--- |`,
    `| 模型名称 | ${result.model.name} |`,
    `| 参数规模 | ${result.model.totalParams} 总参 / ${result.model.activeParams} 激活 |`,
    `| 量化精度 / 上下文长度 | ${result.model.precision} / ${result.model.contextLength} |`,
    `| 加速卡型号 | ${result.model.chipModel} |`,
    `| 单实例卡数 / 单机卡数 | ${result.model.cardsPerInstance} 卡 / ${result.model.cardsPerServer} 卡 |`,
    ...(result.model.benchmarkNote?.trim()
      ? [`| 压测备注 | ${result.model.benchmarkNote.trim()} |`]
      : []),
    ``,
    `### A.2 三场景单实例压测数据与本次插值权重`,
    ``,
    `| 基准场景 | 压测条件（入 / 出 / Cache 命中） | 稳态并发 | 输出吞吐 | 单路输出速度（自动） | TTFT 首字延迟[1] | 本次插值权重 |`,
    `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |`,
    ...benchmarkRows,
    ``,
    `> **[1] 口径说明**：表中 TTFT 首字延迟为计入对应场景 KV-Cache 前缀命中率后的首字延迟平均值（S1 为 0% 冷缓存均值，S2 为 30% 命中均值，S3 为 90% 命中均值）。  `,
    `> **[2] 流量模型参考**：高峰流量参数参考 BurstGPT（arXiv:2401.17644，Azure OpenAI 企业级生产追踪集，全天 24h 峰均比约 4.1×，忙时 5 分钟窗口波动中位数约 1.25×）及政企 8 小时工作制办公曲线校准；忙时波动系数（1.10–1.30×）仅刻画 10–15 分钟级业务波峰，秒级随机抖动由安全水位吸收。`,
    ``,
  ];

  return sections.join('\n');
}

export function downloadMarkdownReport(content: string, modelName: string): void {
  const now = new Date();
  const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const safeName = modelName.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `智能体算力需求评估报告-${safeName}-${dateTag}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
