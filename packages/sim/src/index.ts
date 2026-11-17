export { createEnvironment, CABIN_WBGT, type SiteEnvironment } from './environment';
export { buildScenario, weatherForDate, type ScenarioTemplate, type OpenMeteoHourly, type ScenarioOptions } from './scenario';
export { baselinePlan } from './plans';
export { runShift, UNAIDED_DETECTION_MIN, type Policy, type RunOptions } from './engine';
export { runMetrics, type RunMetrics } from './metrics';
export * as physiology from './physiology';
export { SCENARIOS, scenarioSpec, buildCatalogScenario, type ScenarioSpec } from './catalog';
export { runBacktest, warningPerformance, WINDOWS, POLICIES, type BacktestReport, type BacktestPolicy, type PolicyTotals, type WarningPerformance } from './backtest';

export { nioshLimitC, screenExposure, type ExposureScreen } from './screening';
export { buildDayPlan, maxWorkMinutes, weatherRows, type DayPlan, type DayPlanInput, type HourRow, type PourWindow, type RestPlace, type DayLevel, type WorkMinutes } from './dayplan';
export { briefing, briefingFacts, BRIEFING_LANGUAGES } from './briefing';
export { stationWbgt, checkReadings, fuse, correctionAhead, parseStationCsv, FUSION, type StationReading, type CheckedReading, type ConditionSource, type Fused, type FusionSettings } from './station';
export { TASKS, task, acclimatisation as acclimatisationProfile, historyOf, type TaskProfile, type HeatDay, type Acclimatisation, type Tier } from './profiles';
export { dustLevel, DUST_ADVICE, DUST_RANK, PM10_BANDS, type DustLevel } from './airquality';
export { runWatch, crossingLeads, type WatchInput, type WatchRun, type WatchAlert, type WatchCrew, type WatchGroup, type WatchMinute, type GroupMinute, type GroupSummary, type AlertKind, type AlertLevel, type Conditions } from './watch';
export { conditionsFrom, dayAheadRows, siteTruth, stationFrom, pm10From, shiftsFor, defaultCrews, rng, SITE } from './watchday';
export { broadcast, broadcastFact, broadcastLines, BROADCAST_LANGUAGES } from './broadcast';
export { watchContext, limitShare } from './watchcontext';
