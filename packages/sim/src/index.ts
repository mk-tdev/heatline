export { createEnvironment, CABIN_WBGT, type SiteEnvironment } from './environment';
export { buildScenario, weatherForDate, type ScenarioTemplate, type OpenMeteoHourly, type ScenarioOptions } from './scenario';
export { baselinePlan } from './plans';
export { runShift, UNAIDED_DETECTION_MIN, type Policy, type RunOptions } from './engine';
export { runMetrics, type RunMetrics } from './metrics';
export * as physiology from './physiology';
export { SCENARIOS, scenarioSpec, buildCatalogScenario, type ScenarioSpec } from './catalog';
export { runBacktest, warningPerformance, WINDOWS, POLICIES, type BacktestReport, type BacktestPolicy, type PolicyTotals, type WarningPerformance } from './backtest';
