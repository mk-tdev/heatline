# Heatline status

Updated 6 November 2026 (GST).

## Decisions

- Challenge switch to **Population Health → Climate-Resilient Worker Health** confirmed accepted (6 Nov).

## M0 spikes

| Task | Status | Evidence |
| --- | --- | --- |
| Monorepo scaffold (npm workspaces, strict TypeScript, Vitest) | Done | `npm run check` |
| Liljegren WBGT TypeScript port | **Done** | Matches ECMWF thermofeel on all 744 August 2025 hours: worst error 0.0000 °C at 4 dp (`tests/climate.test.ts`) |
| Solar position (NOAA) | Done | Reproduces the golden cos(zenith) to 1e-6; azimuth sanity tests |
| Heat index + Dubai flag bands | Done | NWS regression check; band boundaries |
| Claude call with strict tool + structured output, latency at `low`/`medium` | **Blocked: needs `ANTHROPIC_API_KEY`** | — |
| Azure Speech voices for ar-AE, hi-IN, ur-PK, bn-IN/BD, ml-IN, en | **Blocked: needs an Azure Speech key and region** | — |
| 3D asset licences | Candidates listed | `docs/assets-and-licenses.md` |

## M1 engine (done 6 Nov, ahead of the 7–8 Nov gate)

| Piece | Evidence |
| --- | --- |
| Scenario: Saadiyat Tower, 20 workers, 3 crews, 7 zones, real weather for any August 2025 day (default 19 Aug) | `data/scenario/saadiyat-tower.json`, `packages/sim/src/scenario.ts` |
| Environment: minute interpolation, NOAA sun, ray-marched tower shadow, tents, dust surge, Liljegren WBGT per zone | `packages/sim/src/environment.ts` |
| Physiology teaching model with six calibration targets | `tests/physiology.test.ts` (8 tests) |
| Truth vs observation (noisy lagged wearable, environment-only estimator, battery death) | `packages/sim/src/engine.ts` |
| Rules: proxy TWL zones, Sharjah work/rest and water, midday ban, NIOSH caps, no lone work, warnings | `tests/rules.test.ts` |
| Plan validator citing rules; rules-only protective planner valid on all 31 days | `tests/rules.test.ts` |
| Three policies (original, site flags, Heatline), metrics, deterministic branching, golden snapshot | `tests/engine.test.ts` |

Totals: **44 tests**, typecheck clean, one 3-hour shift runs in about 15 ms.

Golden comparison (19 Aug, decision at 15:10): original schedule 190 worker-minutes at PSI ≥ 7, one red flag (Suresh 16:43, cooled at 16:44), 80 violation episodes; protective plan 69, none, 11 (all before 15:10), and the pour finishes earlier (16:15 vs 17:06).

Decision recorded: the zone thresholds are a WBGT proxy for TWL (configurable, documented in `packages/rules/src/tables.ts`), because TWL cannot be computed from weather data and pure ACGIH limits would forbid all afternoon heavy work.

## Next (M2, 7–9 Nov)

Role projections with leakage tests; guardian, site-safety and planner agents with fallbacks; NDJSON server. Model calls need `ANTHROPIC_API_KEY`.
