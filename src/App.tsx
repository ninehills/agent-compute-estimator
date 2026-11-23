import { useEffect, useMemo, useState } from 'react';
import { Calculator, Settings2 } from 'lucide-react';
import { FormulaExplanation } from '@/components/FormulaExplanation';
import { HeaderBar } from '@/components/HeaderBar';
import { ModelComparisonTable } from '@/components/ModelComparisonTable';
import { ModelConfigManager } from '@/components/ModelConfigManager';
import { ReportDialog } from '@/components/ReportDialog';
import { ResultDashboard } from '@/components/ResultDashboard';
import { WorkloadPanel } from '@/components/WorkloadPanel';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_MODELS,
  DEFAULT_WORKLOADS,
} from '@/data/presets';
import { evaluateAllModels } from '@/engine/calculator';
import { formatDecimal, formatNumber } from '@/lib/format';
import { generateFormalReport } from '@/lib/report';
import {
  clearPersistedState,
  downloadConfigJson,
  loadPersistedState,
  savePersistedState,
  validateConfigPayload,
} from '@/lib/storage';
import type {
  GlobalEvalSettings,
  ModelSpec,
  ScenarioBenchmark,
  ScenarioKey,
  WorkloadConfig,
} from '@/types/calculator';

function cloneModels(models: ModelSpec[]): ModelSpec[] {
  return models.map((m) => ({
    ...m,
    benchmarks: {
      short_io: { ...m.benchmarks.short_io },
      long_in_high_cache: { ...m.benchmarks.long_in_high_cache },
      long_in_long_out: { ...m.benchmarks.long_in_long_out },
    },
  }));
}

function getInitialData() {
  const persisted = loadPersistedState();
  if (persisted) {
    const validModelId = persisted.models.some(
      (m) => m.id === persisted.selectedModelId,
    )
      ? persisted.selectedModelId!
      : persisted.models[0].id;
    const validWorkloadId = persisted.workloads.some(
      (w) => w.id === persisted.selectedWorkloadId,
    )
      ? persisted.selectedWorkloadId!
      : persisted.workloads[0].id;
    return {
      models: persisted.models,
      workloads: persisted.workloads,
      settings: persisted.settings,
      selectedModelId: validModelId,
      selectedWorkloadId: validWorkloadId,
    };
  }
  return {
    models: cloneModels(DEFAULT_MODELS),
    workloads: DEFAULT_WORKLOADS.map((w) => ({ ...w })),
    settings: { ...DEFAULT_GLOBAL_SETTINGS },
    selectedModelId: DEFAULT_MODELS[1].id,
    selectedWorkloadId: DEFAULT_WORKLOADS[0].id,
  };
}

export function App() {
  const [initial] = useState(getInitialData);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('evaluation');
  const [models, setModels] = useState<ModelSpec[]>(initial.models);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    initial.selectedModelId,
  );
  const [workloads, setWorkloads] = useState<WorkloadConfig[]>(
    initial.workloads,
  );
  const [selectedWorkloadId, setSelectedWorkloadId] = useState<string>(
    initial.selectedWorkloadId,
  );
  const [settings, setSettings] = useState<GlobalEvalSettings>(
    initial.settings,
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [configNotice, setConfigNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    savePersistedState({
      models,
      workloads,
      settings,
      selectedModelId,
      selectedWorkloadId,
    });
  }, [models, workloads, settings, selectedModelId, selectedWorkloadId]);

  const allResults = useMemo(
    () => evaluateAllModels(models, workloads, settings),
    [models, workloads, settings],
  );

  const selectedResult = useMemo(
    () =>
      allResults.find((r) => r.model.id === selectedModelId) ?? allResults[0],
    [allResults, selectedModelId],
  );

  const formalReportText = useMemo(
    () => generateFormalReport(selectedResult, settings),
    [selectedResult, settings],
  );

  const showNotice = (type: 'success' | 'error', message: string) => {
    setConfigNotice({ type, message });
    window.setTimeout(() => {
      setConfigNotice((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const handleUpdateWorkload = (
    id: string,
    patch: Partial<WorkloadConfig>,
  ) => {
    setWorkloads((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    );
  };

  const handleToggleWorkload = (id: string) => {
    setWorkloads((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) {
        return prev;
      }
      const enabledCount = prev.filter((w) => w.enabled).length;
      if (target.enabled && enabledCount <= 1) {
        return prev;
      }
      return prev.map((w) =>
        w.id === id ? { ...w, enabled: !w.enabled } : w,
      );
    });
  };

  const handleSelectAllWorkloads = () => {
    setWorkloads((prev) => prev.map((w) => ({ ...w, enabled: true })));
  };

  const handleSelectOnlyCurrentWorkload = () => {
    setWorkloads((prev) =>
      prev.map((w) => ({ ...w, enabled: w.id === selectedWorkloadId })),
    );
  };

  const handleAddCustomWorkload = () => {
    const customIndex = workloads.filter((w) => w.isCustom).length + 1;
    const newId = `wl-custom-${Date.now()}`;
    const newItem: WorkloadConfig = {
      id: newId,
      name: `自定义场景-${customIndex}`,
      isCustom: true,
      enabled: true,
      avgInputTokens: 4096,
      avgOutputTokens: 800,
      turnsPerTask: 2,
      cacheHitRate: 0.5,
      dailyTasks: 1000,
      peakHours: 4,
      peakTrafficShare: 0.7,
      burstFactor: 2.0,
    };
    setWorkloads((prev) => [...prev, newItem]);
    setSelectedWorkloadId(newId);
  };

  const handleDeleteWorkload = (id: string) => {
    setWorkloads((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const next = prev.filter((w) => w.id !== id);
      if (!next.some((w) => w.enabled)) {
        next[0] = { ...next[0], enabled: true };
      }
      if (selectedWorkloadId === id) {
        setSelectedWorkloadId(next[0].id);
      }
      return next;
    });
  };

  const handleUpdateModel = (id: string, patch: Partial<ModelSpec>) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  const handleUpdateBenchmark = (
    modelId: string,
    scenarioKey: ScenarioKey,
    patch: Partial<ScenarioBenchmark>,
  ) => {
    setModels((prev) =>
      prev.map((m) =>
        m.id === modelId
          ? {
              ...m,
              benchmarks: {
                ...m.benchmarks,
                [scenarioKey]: {
                  ...m.benchmarks[scenarioKey],
                  ...patch,
                },
              },
            }
          : m,
      ),
    );
  };

  const handleAddCustomModel = () => {
    const newId = `custom-${Date.now()}`;
    const customCount = models.filter((m) => m.isCustom).length + 1;
    const newModel: ModelSpec = {
      id: newId,
      name: `自定义模型-${customCount}`,
      vendor: '自研/第三方',
      totalParams: '72B',
      activeParams: '72B',
      contextLength: '128K',
      precision: 'W8A8',
      chipModel: '910B3',
      cardsPerInstance: 4,
      cardsPerServer: 8,
      instanceSpecLabel: '1台4卡 910B3',
      benchmarkNote: '',
      isCustom: true,
      benchmarks: {
        short_io: {
          conc: 32,
          outputTps: 800,
          ttftMs: 800,
        },
        long_in_high_cache: {
          conc: 24,
          outputTps: 520,
          ttftMs: 1400,
        },
        long_in_long_out: {
          conc: 16,
          outputTps: 310,
          ttftMs: 4800,
        },
      },
    };
    setModels((prev) => [...prev, newModel]);
    setSelectedModelId(newId);
  };

  const handleDeleteModel = (id: string) => {
    setModels((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const next = prev.filter((m) => m.id !== id);
      if (selectedModelId === id) {
        setSelectedModelId(next[0].id);
      }
      return next;
    });
  };

  const handleResetModels = () => {
    setModels(cloneModels(DEFAULT_MODELS));
    setSelectedModelId(DEFAULT_MODELS[1].id);
    showNotice('success', '已恢复默认 5 款内置模型压测配置');
  };

  const handleResetAll = () => {
    clearPersistedState();
    setModels(cloneModels(DEFAULT_MODELS));
    setSelectedModelId(DEFAULT_MODELS[1].id);
    setWorkloads(DEFAULT_WORKLOADS.map((w) => ({ ...w })));
    setSelectedWorkloadId(DEFAULT_WORKLOADS[0].id);
    setSettings({ ...DEFAULT_GLOBAL_SETTINGS });
    showNotice('success', '已恢复所有默认配置并重置本地存储');
  };

  const handleExportConfig = () => {
    downloadConfigJson({
      models,
      workloads,
      settings,
      selectedModelId,
      selectedWorkloadId,
    });
    showNotice(
      'success',
      `已导出配置文件（包含 ${models.length} 个模型与 ${workloads.length} 个场景）`,
    );
  };

  const handleImportConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const parsed = JSON.parse(text);
        const validation = validateConfigPayload(parsed);
        if (!validation.ok) {
          showNotice('error', `导入失败：${validation.error}`);
          return;
        }
        const next = validation.data;
        setModels(next.models);
        setWorkloads(next.workloads);
        setSettings(next.settings);
        setSelectedModelId(
          next.selectedModelId &&
            next.models.some((m) => m.id === next.selectedModelId)
            ? next.selectedModelId
            : next.models[0].id,
        );
        setSelectedWorkloadId(
          next.selectedWorkloadId &&
            next.workloads.some((w) => w.id === next.selectedWorkloadId)
            ? next.selectedWorkloadId
            : next.workloads[0].id,
        );
        showNotice(
          'success',
          `已成功导入 ${next.models.length} 个模型与 ${next.workloads.length} 个场景配置并保存至本地`,
        );
      } catch {
        showNotice('error', '导入失败：无法解析 JSON 文件内容');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeaderBar
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onOpenReport={() => setReportOpen(true)}
        onResetAll={handleResetAll}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <TabsList>
              <TabsTab value="evaluation">
                <Calculator className="h-3.5 w-3.5" />
                算力评估报告
              </TabsTab>
              <TabsTab value="config">
                <Settings2 className="h-3.5 w-3.5" />
                模型与配置管理
              </TabsTab>
            </TabsList>

            <span className="text-xs text-muted-foreground tabular-nums">
              已选 {selectedResult.activeWorkloadCount} 个场景 · 日均总调用{' '}
              {formatNumber(selectedResult.totalDailyRequests, 0)} 次 · 峰值
              RPS {formatDecimal(selectedResult.totalBurstRps, 2)} req/s
            </span>
          </div>

          <TabsPanel value="evaluation">
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
              <aside className="lg:col-span-4 xl:col-span-3">
                <WorkloadPanel
                  workloads={workloads}
                  selectedWorkloadId={selectedWorkloadId}
                  onSelectWorkload={setSelectedWorkloadId}
                  onToggleWorkload={handleToggleWorkload}
                  onSelectAllWorkloads={handleSelectAllWorkloads}
                  onSelectOnlyCurrentWorkload={handleSelectOnlyCurrentWorkload}
                  onUpdateWorkload={handleUpdateWorkload}
                  onAddCustomWorkload={handleAddCustomWorkload}
                  onDeleteWorkload={handleDeleteWorkload}
                  settings={settings}
                  onUpdateSettings={(patch) =>
                    setSettings((prev) => ({ ...prev, ...patch }))
                  }
                />
              </aside>

              <section className="flex flex-col gap-4 lg:col-span-8 xl:col-span-9">
                <ResultDashboard
                  allResults={allResults}
                  selectedModelId={selectedResult.model.id}
                  onSelectModel={setSelectedModelId}
                  result={selectedResult}
                  settings={settings}
                />
                <FormulaExplanation
                  model={selectedResult.model}
                  steps={selectedResult.formulaSteps}
                />
                <ModelComparisonTable
                  results={allResults}
                  selectedModelId={selectedResult.model.id}
                  onSelectModel={setSelectedModelId}
                />
              </section>
            </div>
          </TabsPanel>

          <TabsPanel value="config">
            <ModelConfigManager
              models={models}
              workloadCount={workloads.length}
              selectedModelId={selectedResult.model.id}
              onSelectModel={setSelectedModelId}
              onUpdateModel={handleUpdateModel}
              onUpdateBenchmark={handleUpdateBenchmark}
              onAddCustomModel={handleAddCustomModel}
              onDeleteModel={handleDeleteModel}
              onResetModels={handleResetModels}
              onExportConfig={handleExportConfig}
              onImportConfig={handleImportConfig}
              configNotice={configNotice}
            />
          </TabsPanel>
        </Tabs>
      </main>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reportContent={formalReportText}
        modelName={selectedResult.model.name}
        workloadCount={selectedResult.activeWorkloadCount}
      />
    </div>
  );
}

export default App;
