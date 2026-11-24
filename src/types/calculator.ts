export type ScenarioKey =
  | 'short_io'
  | 'long_in_high_cache'
  | 'long_in_long_out';

export type BottleneckType = 'decode' | 'compute' | 'concurrency';

export interface ScenarioDefinition {
  key: ScenarioKey;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  promptTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  recommendedTool: string;
  recommendedDataset: string;
  commandTemplate: string;
}

export interface ScenarioBenchmark {
  conc: number;
  outputTps: number;
  ttftMs: number;
}

export interface ModelSpec {
  id: string;
  name: string;
  vendor: string;
  totalParams: string;
  activeParams: string;
  contextLength: string;
  precision: string;
  chipModel: string;
  cardsPerInstance: number;
  cardsPerServer: number;
  instanceSpecLabel: string;
  benchmarkNote?: string;
  isCustom?: boolean;
  benchmarks: Record<ScenarioKey, ScenarioBenchmark>;
}

export interface WorkloadConfig {
  id: string;
  name: string;
  presetKey?: string;
  isCustom?: boolean;
  enabled: boolean;
  avgInputTokens: number;
  avgOutputTokens: number;
  turnsPerTask: number;
  cacheHitRate: number;
  dailyTasks: number;
  peakHours: number;
  peakTrafficShare: number;
  burstFactor: number;
}

export interface WorkloadPreset {
  key: string;
  name: string;
  tag: string;
  description: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  turnsPerTask: number;
  cacheHitRate: number;
  dailyTasks: number;
  peakHours: number;
  peakTrafficShare: number;
  burstFactor: number;
}

export interface GlobalEvalSettings {
  targetUtil: number;
  enablePeakModel: boolean;
  enableNPlusOne: boolean;
  prefillWeight: number;
}

export interface ScenarioWeightDetail {
  key: ScenarioKey;
  code: string;
  label: string;
  weight: number;
  distance: number;
}

export interface WorkloadEvalDetail {
  workload: WorkloadConfig;
  dailyRequests: number;
  peakAvgRps: number;
  burstRps: number;
  peakOutputTps: number;
  rawPrefillTps: number;
  effectivePrefillTps: number;
  savedPrefillTps: number;
  weightedDemandTps: number;
  weights: ScenarioWeightDetail[];
  instOutputTps: number;
  instWeightedTps: number;
  instConc: number;
  estTtftMs: number;
  estTpotMs: number;
  estLatencySec: number;
  peakConcurrency: number;
  instByDecode: number;
  instByCompute: number;
  instByConc: number;
}

export interface FormulaStep {
  stepNumber: number;
  title: string;
  subtitle: string;
  formula: string;
  substitution: string;
  resultLabel: string;
  resultValue: string;
  note?: string;
}

export interface ModelEvalResult {
  model: ModelSpec;
  activeWorkloadCount: number;
  workloadDetails: WorkloadEvalDetail[];
  totalDailyTasks: number;
  totalDailyRequests: number;
  totalDailyInputTokens: number;
  totalDailyOutputTokens: number;
  totalDailyCachedTokens: number;
  avgTaskDurationSec: number;
  avgCacheHitRate: number;
  totalPeakAvgRps: number;
  totalBurstRps: number;
  totalPeakOutputTps: number;
  totalRawPrefillTps: number;
  totalEffectivePrefillTps: number;
  totalSavedPrefillTps: number;
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
  bottleneckType: BottleneckType;
  bottleneckLabel: string;
  baseInstances: number;
  finalInstances: number;
  totalCards910B3: number;
  totalServers8Card: number;
  cardUtilizationInServers: number;
  actualPeakUtil: number;
  primaryWeights: ScenarioWeightDetail[];
  formulaSteps: FormulaStep[];
}
