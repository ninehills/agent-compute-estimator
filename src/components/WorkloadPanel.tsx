import {
  Check,
  CheckSquare,
  Layers,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { formatCompactTokens, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GlobalEvalSettings, WorkloadConfig } from '@/types/calculator';

interface WorkloadPanelProps {
  workloads: WorkloadConfig[];
  selectedWorkloadId: string;
  onSelectWorkload: (id: string) => void;
  onToggleWorkload: (id: string) => void;
  onSelectAllWorkloads: () => void;
  onSelectOnlyCurrentWorkload: () => void;
  onUpdateWorkload: (id: string, patch: Partial<WorkloadConfig>) => void;
  onAddCustomWorkload: () => void;
  onDeleteWorkload: (id: string) => void;
  settings: GlobalEvalSettings;
  onUpdateSettings: (patch: Partial<GlobalEvalSettings>) => void;
}

function parsePositiveNumber(raw: string, fallback: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) {
    return fallback;
  }
  return num;
}

export function WorkloadPanel({
  workloads,
  selectedWorkloadId,
  onSelectWorkload,
  onToggleWorkload,
  onSelectAllWorkloads,
  onSelectOnlyCurrentWorkload,
  onUpdateWorkload,
  onAddCustomWorkload,
  onDeleteWorkload,
  settings,
  onUpdateSettings,
}: WorkloadPanelProps) {
  const activeWorkload =
    workloads.find((w) => w.id === selectedWorkloadId) ?? workloads[0];
  const enabledWorkloads = workloads.filter((w) => w.enabled);
  const enabledCount = enabledWorkloads.length;
  const totalEnabledTasks = enabledWorkloads.reduce(
    (sum, w) => sum + w.dailyTasks,
    0,
  );
  const allEnabled = enabledCount === workloads.length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-info" />
              <CardTitle>智能体需求场景</CardTitle>
            </div>
            <Badge variant={enabledCount > 1 ? 'info' : 'secondary'}>
              已选 {enabledCount} / {workloads.length}
            </Badge>
          </div>
          <CardDescription>
            勾选多个场景可叠加共享算力池，点击场景行即可编辑其详细参数
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={
                    allEnabled
                      ? onSelectOnlyCurrentWorkload
                      : onSelectAllWorkloads
                  }
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {allEnabled ? '仅选当前' : '全选叠加'}
                </Button>
                {enabledCount > 1 && !allEnabled ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={onSelectOnlyCurrentWorkload}
                  >
                    仅选当前
                  </Button>
                ) : null}
              </div>
              <Button variant="outline" size="xs" onClick={onAddCustomWorkload}>
                <Plus className="h-3.5 w-3.5" />
                新增场景
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              {workloads.map((wl) => {
                const isEditing = wl.id === activeWorkload.id;
                const isLastEnabled = wl.enabled && enabledCount === 1;
                return (
                  <div
                    key={wl.id}
                    onClick={() => onSelectWorkload(wl.id)}
                    className={cn(
                      'group flex items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-all cursor-pointer',
                      isEditing
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/15'
                        : wl.enabled
                          ? 'border-border bg-background hover:bg-accent/50'
                          : 'border-border/60 bg-muted/25 hover:bg-muted/50',
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={wl.enabled}
                      aria-label={`勾选参与评估：${wl.name}`}
                      disabled={isLastEnabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWorkload(wl.id);
                      }}
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        wl.enabled
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background text-transparent hover:border-primary/60',
                        isLastEnabled
                          ? 'opacity-65 cursor-not-allowed'
                          : 'cursor-pointer',
                      )}
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'truncate text-xs font-medium',
                              wl.enabled
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            {wl.name}
                          </span>
                          {wl.isCustom ? (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              自定义
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {isEditing ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              编辑中
                            </span>
                          ) : null}
                          {workloads.length > 1 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteWorkload(wl.id);
                              }}
                              className="rounded p-0.5 text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                              aria-label={`删除场景：${wl.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground tabular-nums">
                        <span>
                          {formatCompactTokens(wl.avgInputTokens)}进 /{' '}
                          {formatCompactTokens(wl.avgOutputTokens)}出
                        </span>
                        <span>·</span>
                        <span>{formatNumber(wl.dailyTasks, 0)}次/日</span>
                        <span>·</span>
                        <span>{formatPercent(wl.cacheHitRate, 0)}命中</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {enabledCount > 1 ? (
              <div className="flex items-center justify-between rounded-lg border border-info/25 bg-info/8 px-2.5 py-1.5 text-[11px] text-info-foreground tabular-nums">
                <span className="flex items-center gap-1.5 font-medium">
                  <Layers className="h-3.5 w-3.5" />
                  多场景共享叠加（{enabledCount} 项）
                </span>
                <span>合计 {formatNumber(totalEnabledTasks, 0)} 任务/日</span>
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                当前编辑场景参数
              </span>
              {!activeWorkload.enabled ? (
                <button
                  type="button"
                  onClick={() => onToggleWorkload(activeWorkload.id)}
                  className="text-[11px] font-medium text-info-foreground hover:underline cursor-pointer"
                >
                  当前未勾选，点击加入评估
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wl-name">场景名称</Label>
              <Input
                id="wl-name"
                value={activeWorkload.name}
                onChange={(e) =>
                  onUpdateWorkload(activeWorkload.id, {
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wl-input">单次平均输入 Token</Label>
                <Input
                  id="wl-input"
                  type="number"
                  min={64}
                  step={256}
                  value={activeWorkload.avgInputTokens}
                  onChange={(e) =>
                    onUpdateWorkload(activeWorkload.id, {
                      avgInputTokens: Math.max(
                        1,
                        parsePositiveNumber(
                          e.target.value,
                          activeWorkload.avgInputTokens,
                        ),
                      ),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wl-output">单次平均输出 Token</Label>
                <Input
                  id="wl-output"
                  type="number"
                  min={32}
                  step={100}
                  value={activeWorkload.avgOutputTokens}
                  onChange={(e) =>
                    onUpdateWorkload(activeWorkload.id, {
                      avgOutputTokens: Math.max(
                        1,
                        parsePositiveNumber(
                          e.target.value,
                          activeWorkload.avgOutputTokens,
                        ),
                      ),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wl-daily">日均任务数（次/日）</Label>
                <Input
                  id="wl-daily"
                  type="number"
                  min={10}
                  step={100}
                  value={activeWorkload.dailyTasks}
                  onChange={(e) =>
                    onUpdateWorkload(activeWorkload.id, {
                      dailyTasks: parsePositiveNumber(
                        e.target.value,
                        activeWorkload.dailyTasks,
                      ),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wl-turns">单任务平均调用轮次</Label>
                <Input
                  id="wl-turns"
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  value={activeWorkload.turnsPerTask}
                  onChange={(e) =>
                    onUpdateWorkload(activeWorkload.id, {
                      turnsPerTask: Math.max(
                        1,
                        parsePositiveNumber(
                          e.target.value,
                          activeWorkload.turnsPerTask,
                        ),
                      ),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label>KV-Cache 命中率预估</Label>
                <Badge variant="success" className="tabular-nums">
                  {formatPercent(activeWorkload.cacheHitRate, 0)}
                </Badge>
              </div>
              <Slider
                value={Math.round(activeWorkload.cacheHitRate * 100)}
                min={0}
                max={95}
                step={5}
                onValueChange={(v) =>
                  onUpdateWorkload(activeWorkload.id, {
                    cacheHitRate: v / 100,
                  })
                }
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>0% 无复用</span>
                <span>50% 常规</span>
                <span>95% Agent多轮</span>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    开启高峰突发流量建模
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    按高峰时段集中度与忙时波动系数估算；关闭后按 8 小时工作日均匀分布计算
                  </p>
                </div>
                <Switch
                  checked={settings.enablePeakModel}
                  onCheckedChange={(checked) =>
                    onUpdateSettings({ enablePeakModel: checked })
                  }
                />
              </div>

              <div
                className={cn(
                  'flex flex-col gap-3 transition-opacity',
                  !settings.enablePeakModel && 'opacity-50',
                )}
              >
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wl-peak-hours">高峰时段时长（小时）</Label>
                    <Input
                      id="wl-peak-hours"
                      type="number"
                      min={0.5}
                      max={8}
                      step={0.5}
                      disabled={!settings.enablePeakModel}
                      value={activeWorkload.peakHours}
                      onChange={(e) =>
                        onUpdateWorkload(activeWorkload.id, {
                          peakHours: Math.max(
                            0.5,
                            Math.min(
                              8,
                              parsePositiveNumber(
                                e.target.value,
                                activeWorkload.peakHours,
                              ),
                            ),
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wl-burst" className="text-muted-foreground">
                      忙时波动系数（Peak/Avg）
                    </Label>
                    <Input
                      id="wl-burst"
                      type="number"
                      value={activeWorkload.burstFactor}
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label>高峰时段流量占比</Label>
                    <Badge variant="outline" className="tabular-nums">
                      {formatPercent(activeWorkload.peakTrafficShare, 0)}
                    </Badge>
                  </div>
                  <Slider
                    value={Math.round(activeWorkload.peakTrafficShare * 100)}
                    min={20}
                    max={100}
                    step={5}
                    disabled={!settings.enablePeakModel}
                    onValueChange={(v) =>
                      onUpdateWorkload(activeWorkload.id, {
                        peakTrafficShare: v / 100,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <CardTitle>全局评估策略与容灾参数</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label>目标安全资源水位（Util）</Label>
              <Badge variant="warning" className="tabular-nums">
                {formatPercent(settings.targetUtil, 0)}
              </Badge>
            </div>
            <Slider
              value={Math.round(settings.targetUtil * 100)}
              min={50}
              max={95}
              step={5}
              onValueChange={(v) =>
                onUpdateSettings({ targetUtil: v / 100 })
              }
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              高峰期集群允许的最高负载上限，预留余量可防止排队抖动与长尾延迟飙升（通常取 70%–80%）
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label>Prefill 相对 Decode 算力权重 γ_pd</Label>
              <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                {settings.prefillWeight.toFixed(2)}
              </span>
            </div>
            <Slider
              value={Math.round(settings.prefillWeight * 100)}
              min={10}
              max={50}
              step={5}
              onValueChange={(v) =>
                onUpdateSettings({ prefillWeight: v / 100 })
              }
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Prefill 并行计算效率远高于逐字生成的 Decode，0.25 表示每 4 个有效输入 Token 约等效 1 个输出 Token 算力
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-foreground">
                开启 N+1 高可用冗余
              </p>
              <p className="text-[11px] text-muted-foreground">
                在基础实例数之上额外增加 1 个热备实例，防止单节点故障降级
              </p>
            </div>
            <Switch
              checked={settings.enableNPlusOne}
              onCheckedChange={(checked) =>
                onUpdateSettings({ enableNPlusOne: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
