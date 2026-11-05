# Heatline implementation plan

Planning date: 6 November 2026 (Abu Dhabi time). Concept: [`research/06-heatline-concept.md`](../../research/06-heatline-concept.md). Evidence: [`research/`](../../research/README.md).

Deadlines: registration closes **10 Nov**; prototype due **20 Nov** per Hack2skill (one report says 15 Nov). **Internal release candidate: 15 Nov, 20:00 GST. Submission: 19 Nov.** Everything after 15 Nov is polish, video and documents.

## 1. Planning assumptions and decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Challenge | Population Health → Climate-Resilient Worker Health | Confirm the switch with Hack2skill before 10 Nov |
| Language | TypeScript throughout, Node ≥ 22 | Same stack as CrisisCraft; shared code between engine, server and tests |
| Frontend | React 19 + Vite + Three.js via React Three Fiber | Proven in CrisisCraft and Brew & Reason |
| Engine | Pure TypeScript package, deterministic, seeded, no wall-clock, no I/O | Replay, back-testing and tests depend on it |
| Model | **Claude Opus 5.5** (`claude-opus-5-5`) through the Anthropic TypeScript SDK; Microsoft Foundry deployment as an option (Microsoft is an event co-creator) | Structured outputs and strict tool use; server-side refusal fallback (`fallbacks: "default"`) |
| Effort | Guardian `low`, safety officer `low`, planner `medium`, debrief `medium` | Latency for warnings; reasoning for plans |
| Voice | Azure AI Speech neural text-to-speech for EN, AR, HI, UR, BN, ML; speech-to-text for supervisor orders (EN) | Broad South Asian language coverage; **verify locales and voices in M0** |
| Weather | Open-Meteo historical (scenario, back-test) and forecast (forecast mode); no key | Already downloaded and analysed in `research/data/` |
| WBGT | TypeScript port of Liljegren (2008), validated against ECMWF thermofeel outputs on all 744 August hours (tolerance 0.15 °C) | Physically based; the simple approximation was shown to mislead ([research 03](../../research/03-abu-dhabi-heat-data.md)) |
| TWL | Shown only from a supplied measurement or a tested implementation of Brake & Bates; otherwise display WBGT and say so | Never present an approximation as a compliance value |
| Hosting | One Node service serving the web build and API (Azure Container Apps or Fly.io), credentials server-side | Long model calls and NDJSON streaming; avoid serverless time limits that constrained CrisisCraft |
| Data | Synthetic workers only; no real personal data anywhere | Governance and challenge rules |

## 2. Scope and release gate

The release candidate must pass all of these, checked by tests or a recorded rehearsal:

1. The 15:00–18:00 shift of **1 Aug 2025** plays end to end from real weather, in under 4 minutes at default speed.
2. Every warning level is produced by the rules engine; the model never sets or lowers a level (test).
3. The supervisor channel never receives an individual physiological value outside a logged red-flag event (property test over random runs).
4. A rule-breaking plan is refused with the rule cited, revised at most once, and an approved plan changes crew positions and exposure.
5. Rewind reproduces the original run byte-for-byte when no decision changes, and a changed decision produces an explained difference (golden test).
6. The back-test report covers 31 days × the crew roster and reports lead time and false-alarm rate.
7. With the model unavailable or the network cut, warnings still fire from rules and the UI says which mode it is in.
8. Spoken warnings play in at least four languages; all six languages have written warnings.
9. Live evaluation evidence: 30 recorded planner runs and 60 guardian messages checked (section 9).
10. Public URL loads without sign-in; phone layout usable.

## 3. Architecture

```text
apps/web            React + R3F: site twin, supervisor console, worker phone, replay, back-test report
server/             Node HTTP: sessions, agent workflows (NDJSON stream), speech, forecast proxy
packages/contracts  Zod schemas shared by everything (state, events, plans, messages)
packages/climate    Liljegren WBGT, heat index, solar position, shade from geometry, weather interpolation
packages/sim        Pure engine: site, crews, tasks, physiology, events, ticks, checkpoints
packages/rules      Rule tables + evaluator: warnings, plan validation, red flags, governance
packages/agents     Role context projection, prompts, tool definitions, output validation
packages/eval       Back-test harness, golden scenarios, agent evals
data/               Scenario JSON, weather JSON (copied from research/data), rule tables with citations
```

| Component | Responsibility | Must not do |
| --- | --- | --- |
| `climate` | Turn weather + sun + geometry into per-zone WBGT, heat index, shade | Fetch from the network (the server does) |
| `sim` | Advance state per tick; apply approved plans; produce events | Call models, read the clock, render |
| `rules` | Decide warning levels, validate plans, detect red flags, enforce governance | Defer a safety decision to a model |
| `agents` | Build each role's permitted context, call Claude, validate outputs | See state outside its projection; mutate state |
| `server` | Own sessions, serialise commands, stream agent turns, hold credentials | Accept client-authored state |
| `web` | Render, collect commands, show provenance ("what they saw") | Invent outcomes; treat animation as state |

## 4. Scenario specification: "Saadiyat Tower, 1 August 2025"

### Site

A 14-storey reinforced-concrete frame under construction, about 120 × 80 m, oriented with the long façade facing west. Zones, each with its own exposure computed every tick:

| Zone | Exposure | Notes |
| --- | --- | --- |
| Rebar yard (ground, east) | Sun; enters the tower's shadow progressively after ~15:30 | Shadow computed from real sun azimuth/elevation |
| Level 12 deck | Full sun, more wind | No shade until a tent is placed |
| West façade scaffold | Sun from early afternoon | Work at height: escalations take longer |
| Rest cabin (AC) | Cooled | Capacity 8 |
| Shade tent (deployable) | Shade, ambient air | Planner can place up to 2 |
| Water stations (2, + mobile) | — | Refill runs take time |
| First aid room + gate | — | Ambulance access at the gate |

### Crews and featured workers

20 workers in three crews. Six are **featured**, with live guardian agents and voices; the rest use rule-based guardians with template messages.

| Worker | Crew | Language | Profile |
| --- | --- | --- | --- |
| Anwar | B · deck | Bengali | Day 2 on site (unacclimatised), heavy work |
| Ravi | A · rebar | Hindi | Third summer; wearable battery 6% at 15:00 |
| Suresh | B · deck (lead) | Malayalam | Acclimatised; tends to skip breaks to finish the pour |
| Bilal | C · façade | Urdu | Acclimatised; the red-flag case at 16:20 in the default run |
| Joel | C · façade | Tagalog (stretch) / English | Acclimatised |
| Ahmed | Foreman | Arabic | Relays approved plans |

### Fixed events (seeded and identical in every branch)

| Time | Event |
| --- | --- |
| 15:00 | Midday ban ends; crews return. Real weather for 1 Aug 2025 (humid sea-breeze day) |
| 15:30 | Concrete truck arrives for the Level 12 pour (pour must continue ~60 min once started) |
| 15:40 | Ravi's wearable battery dies |
| 16:05–16:15 | Site Wi-Fi outage (worker phones keep running cached rules) |
| 16:20 | Bilal's strain crosses the red-flag threshold **if** no intervention reduced his exposure |
| 16:45 | Dust surge: humidity up, direct sun down for 25 minutes |
| 18:00 | Shift ends; debrief |

Bilal's 16:20 event is an *outcome* of the engine, not a script: in branches where Crew C rotated earlier, it does not happen. The default-run golden test asserts it does.

### Golden comparison fixture

Decision at 15:10: **A** approve the pour as booked with Crew B intact; **B** approve the planner's rotation (Anwar to Crew A in shadow, Crew B halves on 20/40, shade tent at the hoist, pour at 15:45). Expected: B has fewer worker-minutes at PSI ≥ 7, no unacclimatised exposure over cap, a later pour finish, and zero rule violations. Exact numbers are frozen once the coefficients are final (section 5).

## 5. Environment and physiology model

### Environment (per zone, per minute)

1. Interpolate hourly weather to minutes (linear for temperature, humidity, wind; radiation follows solar elevation).
2. Solar position (NOAA equations, already implemented in Python in `research/data/analyse_august_liljegren.py`) → sun elevation and azimuth.
3. Shade: project the tower's footprint along the sun vector onto the ground plane; a zone point is shaded if inside the projection. Tents shade their footprint.
4. WBGT (Liljegren): sun zones use full radiation; shaded zones use diffuse only; the AC cabin is a fixed indoor condition.
5. Heat index from air temperature and humidity (NWS) for worker-facing "feels like" and Dubai-flag colour.

### Worker physiology (a teaching model; label it so)

State per worker: core temperature `Tc`, heart rate `HR`, water deficit `D` (L), cumulative exposure, acclimatisation day `a`, current activity and location.

- **Metabolic rate** `M` by activity: rest 115 W, light 180, moderate 300, heavy 415 (ISO 8996-style class midpoints; cite in code).
- **Steady-state core temperature** for the current conditions:
  `Tc_ss = 36.8 + k_M·(M − 115)/100 + k_E·max(0, WBGT_eff − W0) + k_D·D − k_A·acc(a)`,
  where `WBGT_eff` includes the clothing adjustment and `acc(a)` rises from 0 to 1 over 14 days.
- **Dynamics:** `dTc/dt = (Tc_ss − Tc)/τ`, with τ ≈ 20 min when heating and ≈ 12 min when resting in the AC cabin (faster cooling), 18 min in shade.
- **Heart rate:** `HR = HR_rest + c_M·(M − 115) + c_T·(Tc − 37) + c_D·D`, clamped to physiological limits.
- **Sweat and water:** sweat rate grows with `M` and `WBGT_eff`; drinking reduces `D` when the worker is at a water point; `D` raises `Tc_ss` and `HR`.
- **PSI** from Moran (1998) with baselines 37.0 °C / 70 bpm.
- **Red flag:** Tc ≥ 39.5 °C or PSI ≥ 9 sustained 3 min triggers symptoms (confusion), with seeded per-worker variation.
- **Signals:** featured workers with wearables emit HR (with noise, dropouts) and an estimated Tc (with lag and error), so the guardian works from *imperfect* signals, as it would in reality.

Coefficients (`k_*`, `c_*`, `W0`, τ) are chosen so that: an acclimatised worker doing moderate work at WBGT 28 °C stays below PSI 5 for 60 min; heavy work at WBGT 34 °C without rest reaches PSI ≥ 7 within 30–50 min; unacclimatised workers reach thresholds ~30% sooner; a 20-minute AC rest lowers Tc by ~0.4–0.6 °C. These targets are documented with the test that enforces them (`packages/sim/test/calibration.test.ts`). The model is **illustrative**, not validated physiology; the UI and docs say so.

## 6. Rules engine

Rule tables live in `data/rules/*.json`, each row with a `source` field pointing at the research document and section.

| Rule set | Content | Source |
| --- | --- | --- |
| Midday ban | 12:30–15:00, 15 Jun–15 Sep, outdoor direct-sun work blocked unless an exemption reason is recorded | MoHRE ([research 04](../../research/04-uae-regulation-and-governance.md)) |
| Zone schedule | TWL zone → work/rest and water per hour; WBGT-based fallback schedule when TWL is unavailable | Sharjah CoP 33; ACGIH screening ([research 02](../../research/02-heat-stress-science-and-standards.md)) |
| Acclimatisation | NIOSH 20%/day cap for new workers; 50/60/80/100% for returning; > 14 days off resets | NIOSH 2016; Sharjah CoP 33 |
| No lone work | Buffer and withdrawal zones require pairs | Sharjah CoP 33 |
| Warning levels | Green/yellow/amber/red from the worst of: zone, PSI band, water deficit, acclimatisation cap | Dubai flag colours + PSI bands |
| Red flag | Confusion, collapse, PSI ≥ 9, Tc ≥ 39.5 → emergency workflow | OSHA first aid |
| Governance | G1–G7 from [research 04](../../research/04-uae-regulation-and-governance.md) | Challenge text |

**Precedence:** red flag > rules > approved plan > agent suggestion. A warning can be raised by an agent's observation (e.g., a worker says "I feel dizzy"), but never lowered by one.

**Plan validation** checks every proposed assignment minute by minute over the horizon: zone exposure vs schedule, acclimatisation caps, pairs, water access ≥ required L/h, ban window, cabin capacity, crew size for the pour (min 6 on deck while pouring). Output: `{ ok, violations: [{ rule, worker?, crew?, at, detail }] }`.

## 7. Agents

### Roles and what each may see (enforced by projection functions)

| Agent | Sees | Can do | Model |
| --- | --- | --- | --- |
| **Guardian** (one per featured worker) | Own signals and history, own location's conditions, own schedule, own rule state, the worker's language | Phrase the current rule-based warning; answer the worker's questions; run symptom check-ins | Claude, effort `low`, ≤ 2 sentences, strict JSON |
| **Noor · site safety** | Crew aggregates only (counts per warning level, zone conditions, water stock, schedule compliance) | Raise crew-level requests to the supervisor | Claude, effort `low` |
| **Omar · planner** | Noor's requests, task list, roster with *capability tags only* (acclimatised yes/no, current crew), forecast, zone map | Tools: `get_forecast`, `list_tasks`, `check_plan` (dry run), `submit_plan` | Claude, effort `medium`, tool loop (≤ 6 steps) |
| **Debrief** | Event log and metrics of one or two runs | Write the after-action review; every claim cites event IDs; numbers are inserted from metrics, not generated | Claude, effort `medium` |

Projection tests: for every role, a property test generates random states and asserts the serialised context contains no field outside the role's allowlist (e.g., no `hr`, `tc`, `symptoms` in Noor's or Omar's context).

### Model use details (from the Claude API reference used for this plan)

- `client.messages.create` / `client.beta.messages.create` with `output_config: { effort, format: { type: "json_schema", schema } }` for single-shot roles.
- Planner: tools with `strict: true`, `tool_choice: auto` (forced tool choice is not supported on Opus 5.5), and a prompt instruction to finish with `submit_plan`.
- `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`; check `stop_reason` (`refusal`, `max_tokens`) before using output.
- No `temperature`/`top_p` (rejected); thinking cannot be disabled on Opus 5.5, so latency is controlled with `effort`.
- Budgets: guardian ≤ 6 s, planner ≤ 40 s total workflow, debrief ≤ 30 s; streamed to the UI as NDJSON with visible tool steps, as in CrisisCraft.
- Every model output passes the same guardrail class as ReRoute's coach: length, language script, no medical claims, numbers must match engine values.

### Without a model

Each role has a deterministic fallback: template warnings in all languages (pre-translated, reviewed), template crew requests, a rule-derived default plan (rotate unacclimatised workers to shade, 20/40 on heavy tasks), and a template debrief. The UI shows "Rules-only mode".

## 8. Voice and languages

- Written warnings: EN, AR, HI, UR, BN, ML. Templates are translated once and frozen; model-phrased warnings are checked by script detection and a back-translation eval (section 9).
- Spoken: Azure AI Speech neural voices; target ≥ 4 languages live (EN, AR, HI, BN), all six if voices verify in M0. Cache audio by text hash.
- Supervisor voice orders: speech-to-text (EN), transcript editable before sending.
- Native-speaker review of the template set before the demo is recorded (ask contacts; record who reviewed).

## 9. Replay, back-testing and evaluation

### Replay and comparison

- Checkpoint at every supervisor decision (state + RNG state + pending events). Rewind clones the checkpoint, applies the alternative decision, and replays with cached agent outputs where the inputs are unchanged; new agent calls only where the projected context differs, and those are cached with the branch.
- Side-by-side view with a shared clock; diff timeline marks the first divergent event.
- Outcome measures per run: worker-minutes per warning level and at PSI ≥ 7; red-flag events; time-to-cooling after a red flag; unacclimatised exposure over cap (min); water shortfall (L); rule violations; pour completion time; total rest minutes. No "lives saved" or invented productivity cost.

### Back-test (the evidence our previous projects never had)

For each of the 31 August days × 3 shift windows (07–10, 10–12:30, 15–18) × the 20-worker roster, run three policies:

1. **No warnings** (baseline): workers follow the task plan with standard breaks only.
2. **Site flag only**: a single site-level heat-index flag (Dubai bands) sets breaks.
3. **Heatline**: per-worker rules + crew plan (rule-derived default plan, no model, so results are deterministic and cheap).

Report, for policy 3 against the baseline physiology:

- **Lead time:** minutes between the first amber/red warning for a worker and the time that worker would have reached PSI ≥ 7 under the baseline.
- **False-alarm rate:** share of red warnings for which the worker would not have reached PSI ≥ 7 within 60 min under the baseline.
- **Prevented exposure:** worker-minutes at PSI ≥ 7 avoided; red flags avoided.
- **Cost:** extra rest minutes and pour delay.

Every number is about the **simulation**, and the report says so in its title. It demonstrates that the warning logic behaves sensibly across real weather, not that it prevents real injuries.

### Agent evaluation (recorded, like CrisisCraft's 30 runs)

- **Planner, 30 runs** over 3 scenario states: share of first proposals that pass validation; share passing after one revision; share protecting the unacclimatised worker; median latency.
- **Guardian, 60 messages** (6 languages × 10 situations): correct script, length, no forbidden content, numbers match engine, back-translation preserves the action (judged by a second Claude call with a rubric, then spot-checked by a person).
- **Projection leakage:** 0 tolerated; enforced by tests, not evals.

## 10. User interface and visual direction

- **Site twin (centre):** stylised low-poly site, warm palette, heat shimmer shader over hot surfaces; real-time shadow from the computed sun; workers as small figures coloured by warning level only where the viewer is entitled to see it (supervisor sees crew rings, not individual colours).
- **Top bar:** clock, date, WBGT (sun/shade), zone, ban status, mode (live models / rules-only / offline).
- **Supervisor console (left):** Noor's crew requests, Omar's plan card with timeline and rule checks, approve/edit/reject, voice order.
- **Worker phone (right, switchable worker):** the guardian's message in the worker's language with audio, own readings, water and rest timers, red-flag button. A banner reminds the viewer "Only Anwar sees this screen."
- **"What they saw" drawer** on every agent message, as in CrisisCraft.
- **Replay view:** two sites split down the middle, shared clock, metric deltas, debrief with event links.
- **Back-test report page:** a single-series chart per measure, a table view, denominators, and a "simulation" banner.
- Accessibility: keyboard paths for console actions, captions for all audio, reduced motion disables shimmer.

## 11. Repository layout

```text
heatline/
  apps/web/src/{scene,console,phone,replay,report}/
  server/{index.ts,session.ts,agents.ts,speech.ts,forecast.ts}
  packages/{contracts,climate,sim,rules,agents,eval}/src + test/
  data/{scenario/saadiyat-2025-08-01.json, weather/abu-dhabi-2025-08.json, rules/*.json, i18n/*.json}
  docs/{implementation-plan.md, architecture.md, governance.md, evaluation.md, backtest-report.md, demo-script.md}
  research/            copy of ../research at submission time (sources, data, evidence)
  scripts/{backtest.ts, eval-planner.ts, eval-guardian.ts, wbgt-golden.py}
```

## 12. Calendar and milestone gates

| Date (GST) | Milestone | Gate |
| --- | --- | --- |
| **Fri 6 Nov** | M0 spikes: repo scaffold; Liljegren TS port + golden file from thermofeel; Claude call with strict tools; Azure Speech voices for 6 locales; 3D asset licences | Golden WBGT within 0.15 °C on 744 hours; 4+ languages have voices |
| Sat 7 – Sun 8 | M1 engine: climate, sim, rules, scenario, calibration tests; headless shift runs in < 2 s | Golden default run and comparison fixture pass |
| **Mon 9** | M2 agents: projections + leakage tests, guardian, Noor, Omar tool loop, fallbacks, NDJSON server | **Confirm challenge switch (registration closes 10 Nov)** |
| Tue 10 – Wed 11 | M3 experience: 3D site with sun/shadow, console, worker phone, voice | Full shift playable in the browser |
| Thu 12 | M4 rewind: checkpoints, branch, side-by-side, debrief with citations | Golden rewind test; debrief cites events |
| Fri 13 | M5 evidence: back-test harness + report page; planner and guardian evals recorded | Report generated from 31 days |
| Sat 14 | M6 field + forecast: outage, dropout, dust, rules-only mode; forecast mode for any coordinates; deploy | Public URL; offline drill passes |
| **Sun 15** | **Release candidate**; full browser rehearsal on desktop and phone | All release-gate items green |
| Mon 16 – Wed 18 | Polish, native-speaker review, demo video, deck, docs, copy research into repo | Video ≤ 3:30; docs complete |
| **Thu 19** | **Submit** | Links verified signed-out |

## 13. Verification strategy

- **Unit and property tests** (Vitest): climate (WBGT golden, solar position against NOAA examples, shade geometry), physiology calibration targets, every rule table row, plan validator, projection leakage, replay determinism.
- **Golden runs:** default shift and comparison fixture frozen as JSON; any change is reviewed.
- **Server tests:** stand-in model servers that stall, refuse, return invalid JSON or break rules; workflows end with a terminal error or fallback, never a partial state.
- **Evals:** section 9, results committed under `docs/eval/` with raw JSON.
- **Browser rehearsal:** scripted Playwright run of the demo path on the deployed URL, with screenshots; phone viewport; forced WebGL failure shows the 2D fallback.
- Target: ≥ 120 tests by the release candidate (CrisisCraft had 90).

## 14. Risks and scope cuts

| Risk | Mitigation / cut order |
| --- | --- |
| Challenge switch refused | Reframe the same build for *Workforce Health Early Warning* (multi-signal site warning, back-testing, small-cell suppression); the engine and evidence carry over |
| Physiology model criticised | Present it as a teaching model with calibration targets and citations; never claim clinical accuracy; show sensitivity in the back-test |
| TWL computation not ready | WBGT-based schedule, labelled; TWL only from imported measurements |
| Voices missing for a language | Written warning + English audio; list the gap |
| 3D scope slips | Cut order: dust visual → second tent → façade detail → keep a 2D top-down twin (still shadow-accurate) |
| Model latency | Effort `low` for guardians; prefetch the next warning text when a level change is imminent; rules-only fallback |
| Back-test runtime | Rules-only policy, no model calls; parallel workers; cache weather per day |
| Deadline is actually 15 Nov | Release candidate is already 15 Nov; record a short video on 15 Nov as insurance |

Cut order overall (last cut first): forecast mode → Tagalog/Malayalam audio → dust event → debrief model (keep template) → second scenario window.

## 15. Three-minute demo

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | Site at 15:00, shadow sweeping, top bar | "1 August 2025, Saadiyat. Real weather. The midday break just ended. WBGT is still 34 degrees." |
| 0:15 | Anwar's phone, Bengali voice | "Anwar is on his second day. His guardian tells him, in Bengali, to rest now. Only he sees his heart rate." |
| 0:35 | Noor's crew request; supervisor asks "Can we still pour at 15:30?" | "I see crews, not people's bodies. That line is enforced in code." |
| 0:55 | Omar's tool steps; plan refused (unacclimatised worker in buffer zone), revised, approved | "The planner can propose anything. The rules decide what's allowed." |
| 1:25 | Wearable dies, Wi-Fi drops: warnings continue in rules-only mode | "Field-ready means it still works when the battery and the network don't." |
| 1:45 | (In the as-played branch) Bilal's red flag: escalation, cooling steps | "A red flag is the one time his name reaches me, and he can see that it did." |
| 2:05 | Rewind to 15:10, side by side | "Same afternoon, one decision changed. Fewer minutes in danger, no red flag, the pour 25 minutes later." |
| 2:35 | Back-test report | "Across all 31 days of August, in simulation: warning lead time and false alarms, measured." |
| 2:55 | Forecast mode for tomorrow | "And tomorrow's plan, for any site." |

## 16. Submission checklist

- Public URL (signed-out check), repository, README with judge path, 3-minute video.
- Docs: architecture, governance (G1–G7 with test names), evaluation results, back-test report, assumptions and limitations, research with sources.
- Asset and voice licences recorded; all data synthetic; model and speech providers named.
- The challenge's six desired outcomes mapped to features and evidence in the README.

## 17. Immediate next tasks (M0, today)

1. Scaffold the monorepo (contracts, climate, sim, rules, agents, eval, web, server) with Vitest and strict TypeScript.
2. Port Liljegren WBGT to `packages/climate`; generate `data/weather/wbgt-golden.json` with thermofeel from `research/data`; write the golden test.
3. Spike: one Claude call with a strict tool and structured output from the server; record latency at `low` and `medium` effort.
4. Spike: Azure Speech voices for ar-AE, hi-IN, ur-PK, bn-IN/BD, ml-IN, en; save one sample per language.
5. Pick 3D construction assets with clear licences (CC0 preferred) and record them in `docs/assets-and-licenses.md`.
6. Email Hack2skill support to confirm the challenge switch and the deadline.
