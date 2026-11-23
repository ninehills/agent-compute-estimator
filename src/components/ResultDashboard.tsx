import {
  Activity,
  Cpu,
  Gauge,
  Layers,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GlobalEvalSettings, ModelEvalResult } from '@/types/calculator';

interface ResultDashboardProps {
  allResults: ModelEvalResult[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  result: ModelEvalResult;
  settings: GlobalEvalSettings;
}

export function ResultDashboard({
  allResults,
  selectedModelId,
  onSelectModel,
  result,
  settings,
}: ResultDashboardProps) {
  const maxDim = Math.max(
    result.instByDecode,
    result.instByCompute,
    result.instByConc,
    0.01,
  );
  const barScaleMax = Math.max(result.baseInstances, maxDim);

  const dimensions = [
    {
      key: 'decode',
      label: '① 生成速度瓶颈（输出 Token/s）',
      formulaHint: '峰值输出吞吐 ÷ (单实例输出吞吐 × 安全水位)，校验模型生字够不够快',
      demandText: `${formatNumber(result.totalPeakOutputTps, 0)} tok/s`,
      capText: `单实例安全上限 ${formatNumber(result.effectiveInstOutputTps * settings.targetUtil, 0)} tok/s`,
      value: result.instByDecode,
      isBottleneck: result.bottleneckType === 'decode',
    },
    {
      key: 'compute',
      label: '② 读写综合算力瓶颈（输入 + 输出）',
      formulaHint: '(峰值输出 + 未命中有效输入 × γ_pd) ÷ (单实例综合吞吐 × 安全水位)，校验读提示词与生成综合算力',
      demandText: `${formatNumber(result.totalWeightedDemandTps, 0)} tok/s`,
      capText: `单实例安全上限 ${formatNumber(result.effectiveInstWeightedTps * settings.targetUtil, 0)} tok/s`,
      value: result.instByCompute,
      isBottleneck: result.bottleneckType === 'compute',
    },
    {
      key: 'concurrency',
      label: '③ 并发槽位瓶颈（同时在线路数）',
      formulaHint: '(突发 RPS × 单次响应总耗时) ÷ (单实例稳态并发 × 安全水位)，校验 KV-Cache 显存与并发槽位',
      demandText: `${formatDecimal(result.totalPeakConcurrency, 1)} 路在线`,
      capText: `单实例安全上限 ${formatDecimal(result.effectiveInstConc * settings.targetUtil, 1)} 路`,
      value: result.instByConc,
      isBottleneck: result.bottleneckType === 'concurrency',
    },
  ];

  const savedRatio =
    result.totalRawPrefillTps > 0
      ? result.totalSavedPrefillTps / result.totalRawPrefillTps
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {allResults.map((item) => {
          const isSelected = item.model.id === selectedModelId;
          return (
            <button
              key={item.model.id}
              type="button"
              onClick={() => onSelectModel(item.model.id)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer',
                isSelected
                  ? 'border-primary bg-card ring-1 ring-primary/20 shadow-xs'
                  : 'border-border bg-card/60 hover:bg-accent/50',
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-xs font-semibold text-foreground">
                  {item.model.name}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {item.model.cardsPerInstance}卡 {item.model.chipModel} · {item.model.precision}
              </span>
              <div className="mt-1 flex w-full items-baseline justify-between border-t border-border/60 pt-1.5">
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {formatDecimal(item.totalCards910B3, 1)} 卡
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {formatDecimal(item.totalServers8Card, 2)} 台{item.model.cardsPerServer}卡
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                所需推理实例数
              </span>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight tabular-nums">
                {formatDecimal(result.finalInstances, 2)}
              </span>
              <span className="text-xs text-muted-foreground">实例</span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
              基础 {formatDecimal(result.baseInstances, 2)} 实例
              {settings.enableNPlusOne ? ' + 1 热备（N+1）' : '（未开 N+1）'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {result.model.chipModel} 总卡数
              </span>
              <Cpu className="h-4 w-4 text-info" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-info-foreground tabular-nums">
                {formatDecimal(result.totalCards910B3, 1)}
              </span>
              <span className="text-xs text-muted-foreground">
                张 {result.model.chipModel}
              </span>
            </div>
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
              单实例：{result.model.instanceSpecLabel}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {result.model.cardsPerServer} 卡服务器台数
              </span>
              <Server className="h-4 w-4 text-success" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-success-foreground tabular-nums">
                {formatDecimal(result.totalServers8Card, 2)}
              </span>
              <span className="text-xs text-muted-foreground">
                台（{result.model.cardsPerServer}卡机）
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
              卡数按 0.1 卡向上取整，台数 = {formatDecimal(result.totalCards910B3, 1)} ÷{' '}
              {result.model.cardsPerServer}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                主导瓶颈与峰值水位
              </span>
              <Gauge className="h-4 w-4 text-warning" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight tabular-nums">
                {formatPercent(result.actualPeakUtil, 1)}
              </span>
              <span className="text-xs text-muted-foreground">
                / 目标 {formatPercent(settings.targetUtil, 0)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge variant="warning" className="text-[11px]">
                {result.bottleneckLabel}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <CardTitle>三维度瓶颈校核与吞吐拆解</CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[11px]">
                {result.model.name}
              </Badge>
            </div>
            <CardDescription>
              按木桶短板原理，同时满足「生成速度」「读写综合算力」「并发槽位」三项需求，取三者最大值作为所需实例数
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3.5">
              {dimensions.map((dim) => {
                const widthPct = Math.min(
                  100,
                  Math.max(4, (dim.value / barScaleMax) * 100),
                );
                return (
                  <div key={dim.key} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">
                          {dim.label}
                        </span>
                        {dim.isBottleneck ? (
                          <Badge variant="warning" className="text-[10px] py-0">
                            主导瓶颈
                          </Badge>
                        ) : null}
                      </div>
                      <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                        需 {formatDecimal(dim.value, 2)} 实例
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {dim.formulaHint}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          dim.isBottleneck ? 'bg-warning' : 'bg-primary/70',
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>峰值需求：{dim.demandText}</span>
                      <span>{dim.capText}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border/80 bg-muted/35 p-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-muted-foreground">突发峰值 RPS</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatDecimal(result.totalBurstRps, 2)}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    req/s
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">估算 TTFT / TPOT</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatNumber(result.avgEstTtftMs, 0)}ms
                  <span className="mx-1 text-muted-foreground">/</span>
                  {formatDecimal(result.avgEstTpotMs, 1)}ms
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">单路输出速度</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatDecimal(1000 / Math.max(result.avgEstTpotMs, 0.1), 1)}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    tok/s
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">平均单次耗时</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatDecimal(result.avgEstLatencySec, 2)}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    s
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <CardTitle>基准场景权重与 KV-Cache 收益</CardTitle>
            </div>
            <CardDescription>
              按总上下文长度 L = 输入 + 输出 在 S1/S2/S3 间分段插值（与缓存命中率解耦）
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              {result.primaryWeights.map((w) => (
                <div key={w.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {w.code} · {w.label}
                    </span>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {formatPercent(w.weight, 1)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-info transition-all duration-300"
                      style={{ width: `${Math.max(2, w.weight * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-success/25 bg-success/8 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-success-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  KV-Cache Prefill 算力折减
                </div>
                <Badge variant="success" className="tabular-nums">
                  节省 {formatPercent(savedRatio, 1)}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] tabular-nums">
                <div>
                  <span className="text-muted-foreground">原始输入吞吐：</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatNumber(result.totalRawPrefillTps, 0)} tok/s
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">有效 Prefill：</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatNumber(result.totalEffectivePrefillTps, 0)} tok/s
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
