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
| OpenAI structured output + strict tool loop, latency at `low`/`medium` | **Waiting for `OPENAI_API_KEY`** | — |
| `gpt-4o-mini-tts` samples in EN, AR, HI, UR, BN, ML | **Waiting for `OPENAI_API_KEY`** | Bengali and Malayalam are not in OpenAI's listed speech languages |
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

## M2 agents and M3 first playable (6 Nov)

- `packages/agents`: role projections (crew summaries, red-flag disclosures, guardian context, planner roster), guardian prompt/schema/checks with fallback templates in 7 languages, Noor brief, Omar's tools backed by the engine (`get_conditions`, `get_roster`, `check_plan`, `submit_plan`).
- `server/index.ts`: `/api/health`, `/api/guardian`, `/api/safety`, `/api/planner` (NDJSON). Strict input schemas; timeouts; rule fallbacks. Model `gpt-6-luna` for everything.
- Live checks: Omar's loop ran 6 tool steps in about 10 s and submitted a plan the rules accepted (tents on deck and yard, pour 15:30–16:15, Anwar stood down; forecast 69 high-strain minutes, 0 red flags). Noor briefs in about 3 s; guardian messages in 2–5 s.
- `apps/web`: playable 3D twin, console, phone, decision, rewind comparison. Browser-checked: no console errors.
- Fixes found in the browser: tents restricted to tentable zones (Omar had put one on the scaffold; new `tent-placement` rule); drei `<Html>` labels replaced by projected DOM labels (they were disappearing and logging errors); stale guardian text dimmed.
- Tests: **53**.

## Story mode and realism (6 Nov, after team feedback)

- Entry screen with scenario brief, real conditions, role and six characters.
- Nine story beats with camera fly-tos and worker selection; ending with decide-again, compare and explore.
- Scene rebuilt as a Saadiyat district (two towers under construction, finished block, villas, site facilities, roads, sea) and articulated, UAE-authentic workers.
- Browser-verified both branches: plan approved (0 red flags, pour 15:30–16:15) and original schedule (Suresh red flag 16:43 with live Malayalam emergency message). No console errors.

## Scenarios, coverage and compact UI (7 Nov, team feedback)

- Four scenarios on real days, each with its own decision and story; scenario picker on the entry screen.
- Protective clothing per worker; strict midday break; no new pour in a high-risk zone; planner refuses impossible pour requests; spares, cool-down and contingency for pour crews.
- August back-test and in-app evidence report (lead time 36 min median, 86% detected, 10% false alarms; red flags 197 → 0 with an approved plan).
- Compact side panels (300 px / 268 px, smaller type) to give the 3D view more room.
- Live checks: Omar refused to pour on 1 Aug and planned the 11:30 stair-core pour to finish before 12:30 on 12 Aug. All four stories verified in the browser with no console errors.
- Tests: **72**.

## Next

1. Agent evals (30 planner runs, 60 guardian messages) recorded under `docs/eval/`.
2. Any-decision rewind with split-screen replay; debrief agent citing events.
3. Back-test harness and report page (31 days × windows × policies).
4. Voice (`gpt-4o-mini-tts`), forecast mode, field failure visuals, deployment.
