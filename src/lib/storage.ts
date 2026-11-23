import type {
  GlobalEvalSettings,
  ModelSpec,
  ScenarioBenchmark,
  ScenarioKey,
  WorkloadConfig,
} from '@/types/calculator';

const STORAGE_KEY = 'agent-compute-estimator:config:v2';

export interface PersistedState {
  version: number;
  exportedAt?: string;
  models: ModelSpec[];
  workloads: WorkloadConfig[];
  settings: GlobalEvalSettings;
  selectedModelId?: string;
  selectedWorkloadId?: string;
}

const SCENARIO_KEYS: ScenarioKey[] = [
  'short_io',
  'long_in_high_cache',
  'long_in_long_out',
];

function isValidBenchmark(raw: unknown): raw is ScenarioBenchmark {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.conc === 'number' &&
    Number.isFinite(obj.conc) &&
    obj.conc > 0 &&
    typeof obj.outputTps === 'number' &&
    Number.isFinite(obj.outputTps) &&
    obj.outputTps > 0 &&
    typeof obj.ttftMs === 'number' &&
    Number.isFinite(obj.ttftMs) &&
    obj.ttftMs > 0
  );
}

function isValidModel(raw: unknown): raw is ModelSpec {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.name !== 'string' ||
    typeof obj.cardsPerInstance !== 'number' ||
    !obj.benchmarks ||
    typeof obj.benchmarks !== 'object'
  ) {
    return false;
  }
  const benchmarks = obj.benchmarks as Record<string, unknown>;
  return SCENARIO_KEYS.every((k) => isValidBenchmark(benchmarks[k]));
}

function isValidWorkload(raw: unknown): raw is WorkloadConfig {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.enabled === 'boolean' &&
    typeof obj.avgInputTokens === 'number' &&
    typeof obj.avgOutputTokens === 'number' &&
    typeof obj.turnsPerTask === 'number' &&
    typeof obj.cacheHitRate === 'number' &&
    typeof obj.dailyTasks === 'number' &&
    typeof obj.peakHours === 'number' &&
    typeof obj.peakTrafficShare === 'number' &&
    typeof obj.burstFactor === 'number'
  );
}

function isValidSettings(raw: unknown): raw is GlobalEvalSettings {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.targetUtil === 'number' &&
    typeof obj.enableNPlusOne === 'boolean' &&
    typeof obj.prefillWeight === 'number'
  );
}

function buildFallbackSpecLabel(
  cardsPerInstance: number,
  cardsPerServer: number,
  chipModel: string,
): string {
  if (cardsPerInstance >= cardsPerServer && cardsPerInstance % cardsPerServer === 0) {
    return `${cardsPerInstance / cardsPerServer}台${cardsPerServer}卡 ${chipModel}`;
  }
  return `1台${cardsPerInstance}卡 ${chipModel}`;
}

function normalizeModel(raw: ModelSpec): ModelSpec {
  const chipModel =
    typeof raw.chipModel === 'string' && raw.chipModel.trim()
      ? raw.chipModel.trim()
      : '910B3';
  const cardsPerInstance = Math.max(1, Math.round(raw.cardsPerInstance));
  const cardsPerServer =
    typeof raw.cardsPerServer === 'number' &&
    Number.isFinite(raw.cardsPerServer) &&
    raw.cardsPerServer >= 1
      ? Math.round(raw.cardsPerServer)
      : 8;
  return {
    id: raw.id,
    name: raw.name,
    vendor: raw.vendor || '自定义',
    totalParams: raw.totalParams || '-',
    activeParams: raw.activeParams || '-',
    contextLength: raw.contextLength || '128K',
    precision: raw.precision || 'W8A8',
    chipModel,
    cardsPerInstance,
    cardsPerServer,
    instanceSpecLabel: buildFallbackSpecLabel(
      cardsPerInstance,
      cardsPerServer,
      chipModel,
    ),
    benchmarkNote:
      typeof raw.benchmarkNote === 'string' ? raw.benchmarkNote : '',
    isCustom: raw.isCustom,
    benchmarks: {
      short_io: {
        conc: raw.benchmarks.short_io.conc,
        outputTps: raw.benchmarks.short_io.outputTps,
        ttftMs: raw.benchmarks.short_io.ttftMs,
      },
      long_in_high_cache: {
        conc: raw.benchmarks.long_in_high_cache.conc,
        outputTps: raw.benchmarks.long_in_high_cache.outputTps,
        ttftMs: raw.benchmarks.long_in_high_cache.ttftMs,
      },
      long_in_long_out: {
        conc: raw.benchmarks.long_in_long_out.conc,
        outputTps: raw.benchmarks.long_in_long_out.outputTps,
        ttftMs: raw.benchmarks.long_in_long_out.ttftMs,
      },
    },
  };
}

export function validateConfigPayload(
  raw: unknown,
): { ok: true; data: PersistedState } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: '配置文件格式无效，应为 JSON 对象' };
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.models) || obj.models.length === 0) {
    return { ok: false, error: '配置缺少有效的 models 模型列表' };
  }
  if (!obj.models.every(isValidModel)) {
    return { ok: false, error: '部分模型缺少必需的压测字段（conc / outputTps / ttftMs）' };
  }
  if (!Array.isArray(obj.workloads) || obj.workloads.length === 0) {
    return { ok: false, error: '配置缺少有效的 workloads 场景列表' };
  }
  if (!obj.workloads.every(isValidWorkload)) {
    return { ok: false, error: '部分场景参数字段缺失或格式不正确' };
  }
  if (!isValidSettings(obj.settings)) {
    return { ok: false, error: '配置缺少有效的 settings 全局评估参数' };
  }
  const workloads = obj.workloads.map((w) => ({ ...w }));
  if (!workloads.some((w) => w.enabled)) {
    workloads[0].enabled = true;
  }
  return {
    ok: true,
    data: {
      version: 2,
      models: obj.models.map(normalizeModel),
      workloads,
      settings: {
        targetUtil: Math.min(Math.max(obj.settings.targetUtil, 0.2), 1),
        enablePeakModel:
          typeof (obj.settings as unknown as Record<string, unknown>)
            .enablePeakModel === 'boolean'
            ? ((obj.settings as unknown as Record<string, unknown>)
                .enablePeakModel as boolean)
            : true,
        enableNPlusOne: obj.settings.enableNPlusOne,
        prefillWeight: Math.min(Math.max(obj.settings.prefillWeight, 0.05), 1),
      },
      selectedModelId:
        typeof obj.selectedModelId === 'string'
          ? obj.selectedModelId
          : undefined,
      selectedWorkloadId:
        typeof obj.selectedWorkloadId === 'string'
          ? obj.selectedWorkloadId
          : undefined,
    },
  };
}

export function loadPersistedState(): PersistedState | null {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) {
      return null;
    }
    const parsed = JSON.parse(text);
    const result = validateConfigPayload(parsed);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export function savePersistedState(state: Omit<PersistedState, 'version'>): void {
  try {
    const payload: PersistedState = {
      version: 2,
      ...state,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
}

export function clearPersistedState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function downloadConfigJson(state: Omit<PersistedState, 'version'>): void {
  const now = new Date();
  const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const payload: PersistedState = {
    version: 2,
    exportedAt: now.toISOString(),
    ...state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-compute-config-${dateTag}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
