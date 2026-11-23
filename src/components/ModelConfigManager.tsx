import { useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  HardDrive,
  Plus,
  RotateCcw,
  Settings2,
  Terminal,
  Trash2,
  Upload,
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
import { BENCHMARK_SCENARIOS } from '@/data/presets';
import {
  formatCompactTokens,
  formatDecimal,
  formatPercent,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  ModelSpec,
  ScenarioBenchmark,
  ScenarioKey,
} from '@/types/calculator';

interface ModelConfigManagerProps {
  models: ModelSpec[];
  workloadCount: number;
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  onUpdateModel: (id: string, patch: Partial<ModelSpec>) => void;
  onUpdateBenchmark: (
    modelId: string,
    scenarioKey: ScenarioKey,
    patch: Partial<ScenarioBenchmark>,
  ) => void;
  onAddCustomModel: () => void;
  onDeleteModel: (id: string) => void;
  onResetModels: () => void;
  onExportConfig: () => void;
  onImportConfig: (file: File) => void;
  configNotice: { type: 'success' | 'error'; message: string } | null;
}

const CARD_QUICK_OPTIONS = [1, 2, 4, 8, 16, 32];

function parsePositive(raw: string, fallback: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return num;
}

function buildSpecLabel(
  cardsPerInstance: number,
  cardsPerServer: number,
  chipModel: string,
): string {
  const chip = chipModel.trim() || '910B3';
  const perServer = Math.max(1, cardsPerServer);
  if (cardsPerInstance >= perServer && cardsPerInstance % perServer === 0) {
    return `${cardsPerInstance / perServer}台${perServer}卡 ${chip}`;
  }
  return `1台${cardsPerInstance}卡 ${chip}`;
}

export function ModelConfigManager({
  models,
  workloadCount,
  selectedModelId,
  onSelectModel,
  onUpdateModel,
  onUpdateBenchmark,
  onAddCustomModel,
  onDeleteModel,
  onResetModels,
  onExportConfig,
  onImportConfig,
  configNotice,
}: ModelConfigManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedCmdKey, setCopiedCmdKey] = useState<string | null>(null);
  const currentModel =
    models.find((m) => m.id === selectedModelId) ?? models[0];

  const handleCopyCommand = (key: string, command: string) => {
    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(command).then(() => {
      setCopiedCmdKey(key);
      window.setTimeout(() => {
        setCopiedCmdKey((prev) => (prev === key ? null : prev));
      }, 1800);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/60 text-foreground">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  配置导入与导出（本地自动保存）
                </span>
                <Badge variant="secondary" className="tabular-nums">
                  {models.length} 个模型 · {workloadCount} 个场景
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                所有模型压测基准、自定义场景与全局策略均自动持久化到浏览器 localStorage，支持一键导出 JSON 备份或导入迁移
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportConfig(file);
                }
                e.target.value = '';
              }}
            />
            <Button variant="outline" size="sm" onClick={onExportConfig}>
              <Download className="h-3.5 w-3.5" />
              一键导出配置
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              一键导入配置
            </Button>
          </div>
        </CardContent>
        {configNotice ? (
          <div className="px-5 pb-4">
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                configNotice.type === 'success'
                  ? 'border-success/30 bg-success/10 text-success-foreground'
                  : 'border-destructive/30 bg-destructive/10 text-destructive',
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{configNotice.message}</span>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-info" />
              <CardTitle>模型实例规格与三场景压测基准管理</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onResetModels}>
                <RotateCcw className="h-3.5 w-3.5" />
                恢复默认模型库
              </Button>
              <Button variant="default" size="sm" onClick={onAddCustomModel}>
                <Plus className="h-3.5 w-3.5" />
                新增自定义模型
              </Button>
            </div>
          </div>
          <CardDescription>
            配置单实例卡数与 S1/S2/S3 三场景压测数据（稳态并发、输出吞吐、TTFT），单路输出速度由输出吞吐 ÷ 稳态并发自动计算
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {models.map((m) => {
              const isActive = m.id === currentModel.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModel(m.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-background text-foreground hover:bg-accent',
                  )}
                >
                  <span>{m.name}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] tabular-nums',
                      isActive
                        ? 'bg-primary-foreground/15 text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {m.cardsPerInstance}卡
                  </span>
                </button>
              );
            })}
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {currentModel.name} 基础规格配置
                </h4>
                {currentModel.isCustom ? (
                  <Badge variant="info">自定义模型</Badge>
                ) : (
                  <Badge variant="secondary">内置预设</Badge>
                )}
              </div>
              {models.length > 1 && currentModel.isCustom ? (
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => onDeleteModel(currentModel.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除该模型
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>模型名称</Label>
                <Input
                  value={currentModel.name}
                  onChange={(e) =>
                    onUpdateModel(currentModel.id, { name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>总参数 / 激活参数</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input
                    value={currentModel.totalParams}
                    onChange={(e) =>
                      onUpdateModel(currentModel.id, {
                        totalParams: e.target.value,
                      })
                    }
                    placeholder="总参数"
                  />
                  <Input
                    value={currentModel.activeParams}
                    onChange={(e) =>
                      onUpdateModel(currentModel.id, {
                        activeParams: e.target.value,
                      })
                    }
                    placeholder="激活参数"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>量化精度 / 上下文</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input
                    value={currentModel.precision}
                    onChange={(e) =>
                      onUpdateModel(currentModel.id, {
                        precision: e.target.value,
                      })
                    }
                    placeholder="W8A8"
                  />
                  <Input
                    value={currentModel.contextLength}
                    onChange={(e) =>
                      onUpdateModel(currentModel.id, {
                        contextLength: e.target.value,
                      })
                    }
                    placeholder="1M"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/80 bg-muted/30 p-3.5 sm:grid-cols-12">
              <div className="flex flex-col gap-1.5 sm:col-span-3">
                <Label>加速卡型号</Label>
                <Input
                  value={currentModel.chipModel}
                  placeholder="910B3"
                  onChange={(e) => {
                    const nextChip = e.target.value;
                    onUpdateModel(currentModel.id, {
                      chipModel: nextChip,
                      instanceSpecLabel: buildSpecLabel(
                        currentModel.cardsPerInstance,
                        currentModel.cardsPerServer,
                        nextChip,
                      ),
                    });
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>单机卡数</Label>
                <Input
                  type="number"
                  min={1}
                  max={64}
                  value={currentModel.cardsPerServer}
                  onChange={(e) => {
                    const nextServerCards = Math.max(
                      1,
                      Math.round(
                        parsePositive(
                          e.target.value,
                          currentModel.cardsPerServer,
                        ),
                      ),
                    );
                    onUpdateModel(currentModel.id, {
                      cardsPerServer: nextServerCards,
                      instanceSpecLabel: buildSpecLabel(
                        currentModel.cardsPerInstance,
                        nextServerCards,
                        currentModel.chipModel,
                      ),
                    });
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-7">
                <Label>单实例卡数</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CARD_QUICK_OPTIONS.map((cards) => (
                    <Button
                      key={cards}
                      variant={
                        currentModel.cardsPerInstance === cards
                          ? 'default'
                          : 'outline'
                      }
                      size="xs"
                      onClick={() =>
                        onUpdateModel(currentModel.id, {
                          cardsPerInstance: cards,
                          instanceSpecLabel: buildSpecLabel(
                            cards,
                            currentModel.cardsPerServer,
                            currentModel.chipModel,
                          ),
                        })
                      }
                    >
                      {cards}卡
                    </Button>
                  ))}
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      max={128}
                      value={currentModel.cardsPerInstance}
                      onChange={(e) => {
                        const nextCards = Math.max(
                          1,
                          Math.round(
                            parsePositive(
                              e.target.value,
                              currentModel.cardsPerInstance,
                            ),
                          ),
                        );
                        onUpdateModel(currentModel.id, {
                          cardsPerInstance: nextCards,
                          instanceSpecLabel: buildSpecLabel(
                            nextCards,
                            currentModel.cardsPerServer,
                            currentModel.chipModel,
                          ),
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>压测备注</Label>
              <Input
                value={currentModel.benchmarkNote ?? ''}
                placeholder="可选：填写推理框架（如 MindIE / vLLM-Ascend）、压测版本、批处理或量化说明"
                onChange={(e) =>
                  onUpdateModel(currentModel.id, {
                    benchmarkNote: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {BENCHMARK_SCENARIOS.map((sc) => {
                const bench = currentModel.benchmarks[sc.key];
                const perStreamSpeed =
                  bench.outputTps / Math.max(bench.conc, 1);
                const concInt = Math.max(1, Math.round(bench.conc));
                const renderedCmd = sc.commandTemplate
                  .replaceAll('{{model}}', currentModel.name)
                  .replaceAll('{{conc}}', String(concInt))
                  .replaceAll('{{num}}', String(concInt * 10));
                const isCopied = copiedCmdKey === sc.key;
                return (
                  <div
                    key={sc.key}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="info">{sc.code}</Badge>
                          <span className="text-xs font-semibold text-foreground">
                            {sc.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatCompactTokens(sc.promptTokens)} 输入 ·{' '}
                          {formatCompactTokens(sc.outputTokens)} 输出 ·{' '}
                          {formatPercent(sc.cacheHitRate, 0)} Cache
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          稳态并发（路）
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={bench.conc}
                          onChange={(e) =>
                            onUpdateBenchmark(currentModel.id, sc.key, {
                              conc: parsePositive(e.target.value, bench.conc),
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          输出吞吐（tok/s）
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={bench.outputTps}
                          onChange={(e) =>
                            onUpdateBenchmark(currentModel.id, sc.key, {
                              outputTps: parsePositive(
                                e.target.value,
                                bench.outputTps,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          TTFT 首字延迟（ms）
                          <sup className="ml-0.5 text-info-foreground">[1]</sup>
                        </Label>
                        <Input
                          type="number"
                          min={10}
                          value={bench.ttftMs}
                          onChange={(e) =>
                            onUpdateBenchmark(currentModel.id, sc.key, {
                              ttftMs: parsePositive(
                                e.target.value,
                                bench.ttftMs,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          单路输出速度（自动）
                        </Label>
                        <div className="flex h-9 items-center justify-between rounded-lg border border-border/80 bg-muted/60 px-2.5 font-mono text-xs text-muted-foreground tabular-nums">
                          <span className="font-semibold text-foreground">
                            {formatDecimal(perStreamSpeed, 1)}
                          </span>
                          <span className="text-[11px]">tok/s</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/35 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
                          <Terminal className="h-3 w-3 text-info" />
                          建议压测方案
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand(sc.key, renderedCmd)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                        >
                          {isCopied ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {isCopied ? '已复制命令' : '复制命令'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        <span>
                          <strong className="font-medium text-foreground/85">
                            工具：
                          </strong>
                          {sc.recommendedTool}
                        </span>
                        <span>
                          <strong className="font-medium text-foreground/85">
                            数据集：
                          </strong>
                          {sc.recommendedDataset}
                        </span>
                      </div>
                      <pre className="overflow-x-auto rounded-md border border-border/70 bg-background px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-all">
                        {renderedCmd}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>

            <blockquote className="rounded-lg border-l-2 border-info bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">[1]</span>{' '}
              TTFT 首字延迟指计入对应场景 KV-Cache 前缀命中率后的首字延迟平均值（如 S1 为 0% 冷缓存均值，S2 为 30% 命中均值，S3 为 90% 命中均值）。
            </blockquote>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
