import { useMemo, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  formatDecimal,
  formatNumber,
  formatTokenVolume,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GlobalEvalSettings, ModelEvalResult } from '@/types/calculator';

type MetricKey = 'tasks' | 'requests' | 'tokens';

interface TrafficProfileChartProps {
  result: ModelEvalResult;
  settings: GlobalEvalSettings;
}

interface HourlyPoint {
  hour: number;
  label: string;
  value: number;
  flatValue: number;
  isPeakHour: boolean;
  isWorkHour: boolean;
}

const WORK_HOURS = [8, 9, 10, 11, 14, 15, 16, 17];
const PEAK_PRIORITY = [
  10, 15, 9, 14, 11, 16, 8, 17, 13, 18, 12, 19, 20, 21, 7, 22, 23, 6, 5, 4, 3,
  2, 1, 0,
];
const OFF_HOURS_WEIGHTS: Record<number, number> = {
  12: 0.25,
  13: 0.25,
  18: 0.22,
  19: 0.12,
  20: 0.08,
  21: 0.04,
  7: 0.04,
};

const METRIC_META: Record<
  MetricKey,
  { label: string; unit: string; format: (v: number) => string }
> = {
  tasks: {
    label: '任务数',
    unit: '次/h',
    format: (v) => `${formatNumber(Math.round(v), 0)} 次/h`,
  },
  requests: {
    label: '模型请求数',
    unit: '次/h',
    format: (v) => `${formatNumber(Math.round(v), 0)} 次/h`,
  },
  tokens: {
    label: 'Tokens 数',
    unit: 'tok/h',
    format: (v) => `${formatTokenVolume(v)}/h`,
  },
};

function distributeWorkloadHourly(
  dailyVolume: number,
  peakHours: number,
  peakShare: number,
  enablePeak: boolean,
): { hourly: number[]; peakSet: Set<number> } {
  const hourly = new Array<number>(24).fill(0);
  const clampedPeakCount = Math.min(24, Math.max(1, Math.round(peakHours)));
  const peakSet = new Set<number>(PEAK_PRIORITY.slice(0, clampedPeakCount));

  if (!enablePeak) {
    const perWorkHour = dailyVolume / WORK_HOURS.length;
    for (const h of WORK_HOURS) {
      hourly[h] = perWorkHour;
    }
    return { hourly, peakSet };
  }

  const safeShare = Math.min(Math.max(peakShare, clampedPeakCount / 8), 1);
  const peakVolume = dailyVolume * safeShare;
  const restVolume = Math.max(0, dailyVolume - peakVolume);

  const perPeakHour = peakVolume / clampedPeakCount;
  for (const h of peakSet) {
    hourly[h] += perPeakHour;
  }

  const nonPeakWorkHours = WORK_HOURS.filter((h) => !peakSet.has(h));
  const offEntries = Object.entries(OFF_HOURS_WEIGHTS)
    .map(([h, w]) => ({ hour: Number(h), weight: w }))
    .filter((item) => !peakSet.has(item.hour));

  if (nonPeakWorkHours.length > 0 && offEntries.length > 0) {
    const workRest = restVolume * 0.85;
    const offRest = restVolume * 0.15;
    const perNonPeakWork = workRest / nonPeakWorkHours.length;
    for (const h of nonPeakWorkHours) {
      hourly[h] += perNonPeakWork;
    }
    const offWeightSum = offEntries.reduce((s, e) => s + e.weight, 0);
    for (const item of offEntries) {
      hourly[item.hour] += offRest * (item.weight / offWeightSum);
    }
  } else if (nonPeakWorkHours.length > 0) {
    const perNonPeakWork = restVolume / nonPeakWorkHours.length;
    for (const h of nonPeakWorkHours) {
      hourly[h] += perNonPeakWork;
    }
  } else if (offEntries.length > 0) {
    const offWeightSum = offEntries.reduce((s, e) => s + e.weight, 0);
    for (const item of offEntries) {
      hourly[item.hour] += restVolume * (item.weight / offWeightSum);
    }
  } else if (restVolume > 0) {
    const remainingHours: number[] = [];
    for (let h = 0; h < 24; h += 1) {
      if (!peakSet.has(h)) {
        remainingHours.push(h);
      }
    }
    if (remainingHours.length > 0) {
      const perRemain = restVolume / remainingHours.length;
      for (const h of remainingHours) {
        hourly[h] += perRemain;
      }
    } else {
      const perAll = restVolume / 24;
      for (let h = 0; h < 24; h += 1) {
        hourly[h] += perAll;
      }
    }
  }

  return { hourly, peakSet };
}

export function TrafficProfileChart({
  result,
  settings,
}: TrafficProfileChartProps) {
  const [metric, setMetric] = useState<MetricKey>('tokens');
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  const { points, flatBaseline, peakDesignLevel, maxScale, ratioVsFlat } =
    useMemo(() => {
      const workSet = new Set(WORK_HOURS);
      const activeTotals = new Array<number>(24).fill(0);
      const flatTotals = new Array<number>(24).fill(0);
      const unionPeakSet = new Set<number>();

      let flatLine = 0;
      let peakLine = 0;

      for (const d of result.workloadDetails) {
        const w = d.workload;
        const safePeakHours = Math.min(Math.max(w.peakHours, 0.1), 8);
        const dailyVol =
          metric === 'tasks'
            ? Math.max(w.dailyTasks, 0)
            : metric === 'requests'
              ? d.dailyRequests
              : d.dailyRequests *
                (Math.max(w.avgInputTokens, 1) + Math.max(w.avgOutputTokens, 1));

        const activeDist = distributeWorkloadHourly(
          dailyVol,
          safePeakHours,
          w.peakTrafficShare,
          settings.enablePeakModel,
        );
        const flatDist = distributeWorkloadHourly(
          dailyVol,
          safePeakHours,
          w.peakTrafficShare,
          false,
        );

        for (let h = 0; h < 24; h += 1) {
          activeTotals[h] += activeDist.hourly[h];
          flatTotals[h] += flatDist.hourly[h];
        }
        for (const h of activeDist.peakSet) {
          unionPeakSet.add(h);
        }

        const safeShare = Math.min(
          Math.max(w.peakTrafficShare, Math.min(safePeakHours / 8, 1)),
          1,
        );
        flatLine += dailyVol / 8;
        peakLine += ((dailyVol * safeShare) / safePeakHours) * Math.max(w.burstFactor, 1);
      }

      const builtPoints: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        value: activeTotals[h],
        flatValue: flatTotals[h],
        isPeakHour: unionPeakSet.has(h),
        isWorkHour: workSet.has(h),
      }));

      const maxBar = Math.max(...builtPoints.map((p) => p.value), 0);
      const scaleTop = Math.max(maxBar, peakLine, flatLine, 1) * 1.15;
      const ratio = flatLine > 0 ? peakLine / flatLine : 1;

      return {
        points: builtPoints,
        flatBaseline: flatLine,
        peakDesignLevel: peakLine,
        maxScale: scaleTop,
        ratioVsFlat: ratio,
      };
    }, [result.workloadDetails, metric, settings.enablePeakModel]);

  const meta = METRIC_META[metric];
  const hovered = hoverHour !== null ? points[hoverHour] : null;
  const flatLineBottomPct = Math.min(100, (flatBaseline / maxScale) * 100);
  const peakLineBottomPct = Math.min(100, (peakDesignLevel / maxScale) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-info" />
            <CardTitle>工作日 24 小时流量分布与高峰水位对比</CardTitle>
            <Badge
              variant={settings.enablePeakModel ? 'warning' : 'secondary'}
              className="tabular-nums"
            >
              {settings.enablePeakModel
                ? `高峰模式 · 相对 8h 均摊 ${formatDecimal(ratioVsFlat, 2)}×`
                : '8h 均摊模式（未开高峰）'}
            </Badge>
          </div>

          <div className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5">
            {(['tasks', 'requests', 'tokens'] as MetricKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  metric === key
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {METRIC_META[key].label}
              </button>
            ))}
          </div>
        </div>
        <CardDescription>
          直观对比「开启高峰（忙时集中 + 波动水位）」与「关闭高峰（8 小时工作日均摊）」在不同时段的小时负载形态
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-xs',
                  settings.enablePeakModel ? 'bg-warning' : 'bg-info',
                )}
              />
              {settings.enablePeakModel ? '核心高峰小时' : '8h 工作时段'}
            </span>
            {settings.enablePeakModel ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-info/60" />
                非忙时 / 低谷小时
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-2 border-dashed border-warning" />
              高峰设计水位（含忙时波动）：{meta.format(peakDesignLevel)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground/70" />
              8h 均摊水位：{meta.format(flatBaseline)}
            </span>
          </div>

          <div className="font-mono text-[11px] text-foreground">
            {hovered ? (
              <span>
                {hovered.label}–{String((hovered.hour + 1) % 24).padStart(2, '0')}:00
                {' · '}
                <strong>{meta.format(hovered.value)}</strong>
                {flatBaseline > 0
                  ? `（${formatDecimal(hovered.value / flatBaseline, 2)}× 8h均值）`
                  : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">
                悬停柱状图查看单小时明细
              </span>
            )}
          </div>
        </div>

        <div className="relative mt-1 h-48 w-full rounded-xl border border-border/70 bg-muted/20 px-3 pt-4 pb-7">
          <div className="relative h-full w-full">
            <div
              className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border/70"
              style={{ bottom: '50%' }}
            />
            <div
              className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border/70"
              style={{ bottom: '100%' }}
            />

            <div
              className={cn(
                'pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-dashed transition-all duration-300',
                settings.enablePeakModel
                  ? 'border-warning'
                  : 'border-warning/35',
              )}
              style={{ bottom: `${peakLineBottomPct}%` }}
            >
              <span
                className={cn(
                  'absolute -top-4.5 right-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                  settings.enablePeakModel
                    ? 'bg-warning/15 font-semibold text-warning-foreground'
                    : 'bg-muted/80 text-muted-foreground',
                )}
              >
                高峰设计 {meta.format(peakDesignLevel)}
              </span>
            </div>

            <div
              className={cn(
                'pointer-events-none absolute right-0 left-0 z-10 border-t-2 border-dashed transition-all duration-300',
                !settings.enablePeakModel
                  ? 'border-info'
                  : 'border-muted-foreground/55',
              )}
              style={{ bottom: `${flatLineBottomPct}%` }}
            >
              <span
                className={cn(
                  'absolute -top-4.5 left-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                  !settings.enablePeakModel
                    ? 'bg-info/15 font-semibold text-info-foreground'
                    : 'bg-muted/80 text-muted-foreground',
                )}
              >
                8h 均摊 {meta.format(flatBaseline)}
              </span>
            </div>

            <div className="relative z-0 flex h-full w-full items-end gap-1">
              {points.map((pt) => {
                const heightPct = Math.max(
                  pt.value > 0 ? 2 : 0,
                  (pt.value / maxScale) * 100,
                );
                const isHovered = hoverHour === pt.hour;
                return (
                  <div
                    key={pt.hour}
                    onMouseEnter={() => setHoverHour(pt.hour)}
                    onMouseLeave={() => setHoverHour(null)}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                  >
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all duration-300',
                        settings.enablePeakModel
                          ? pt.isPeakHour
                            ? 'bg-warning/85 group-hover:bg-warning'
                            : 'bg-info/45 group-hover:bg-info/75'
                          : pt.isWorkHour
                            ? 'bg-info/75 group-hover:bg-info'
                            : 'bg-muted-foreground/20',
                        isHovered && 'ring-1 ring-foreground/40',
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span
                      className={cn(
                        'absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[10px] tabular-nums',
                        pt.hour % 3 === 0 || isHovered
                          ? 'text-muted-foreground'
                          : 'hidden sm:inline text-muted-foreground/45',
                        isHovered && 'font-semibold text-foreground',
                      )}
                    >
                      {String(pt.hour).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
