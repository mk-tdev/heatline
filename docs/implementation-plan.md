# Heatline implementation plan

> Historical planning record. Current evidence, limitations and corrected metrics are in [scientific-basis.md](scientific-basis.md) and [status.md](status.md). Earlier “lawful”, TWL-proxy, 86% detection and safety claims below are superseded.

Planning date: 6 November 2026 (Abu Dhabi time). Concept: [`research/06-heatline-concept.md`](../research/06-heatline-concept.md). Evidence: [`research/`](../research/README.md).

Deadlines: registration closes **10 Nov**; prototype due **20 Nov** per Hack2skill (one report says 15 Nov). **Internal release candidate: 15 Nov, 20:00 GST. Submission: 19 Nov.** Everything after 15 Nov is polish, video and documents.

## Progress log

| Date | Milestone | State | Evidence |
| --- | --- | --- | --- |
| 6 Nov | M0 spikes | **Done** | Liljegren port matches ECMWF thermofeel on 744 hours; live `gpt-6-luna` structured output (4.8 s, Bengali) and strict tool call (2.8 s) |
| 6 Nov | M1 engine | **Done** | Scenario, environment, physiology, rules, planner, three policies, golden comparison |
| 6 Nov | M2 agents | **Mostly done** | Projections with leakage tests; guardian, Noor and Omar live on `gpt-6-luna` with rule fallbacks; NDJSON planner stream. Open: agent evals (section 9) |
| 6 Nov | M3 experience | **First playable** | 3D twin with real sun and shadows, console, worker phone, 15:10 decision, rewind compare; runs locally with `npm run dev` |
| 6 Nov | M3b story and realism (team feedback: "only one building", characters not authentic, needs a story) | **Done** | Entry screen; nine story beats with camera moves; full Saadiyat district; articulated UAE-site workers; dust haze. Both branches verified end to end in the browser |
| — | M4 rewind | **Partly done** | Branch from the 15:10 decision and side-by-side metrics. Open: any-decision rewind, split-screen replay, debrief agent |
| 7 Nov | M3c scenarios + coverage (team feedback: compact panels, more scenarios to meet the brief) | **Done** | Four scenarios, compact panels, PPE, strict midday ban, August back-test and evidence view; 72 tests |
| 7 Nov | M5 evidence | **Done** | `npm run backtest` → `data/backtest/august-2025.json`; evidence report in the app |
| — | M6 field + forecast | Partly (field failures scenario done) | Open: forecast mode for any coordinates, deployment |

**Run it locally:** put `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in `.env`, then `npm install` and `npm run dev`. Open http://127.0.0.1:5183. The API server runs on port 8787; without a key, everything runs in rules-only mode.

## Coverage of the challenge's desired outcomes

| Desired outcome (Climate-Resilient Worker Health) | Where Heatline shows it | Evidence |
| --- | --- | --- |
| Dynamic heat-risk assessment | Every scenario: Liljegren WBGT per zone and minute from real weather, shade, tents, clothing, workload, acclimatisation, hydration, optional wearables | `tests/climate.test.ts`, `tests/physiology.test.ts`; *The day nobody should pour* |
| Clear, graded, multilingual warnings | Guardian on each worker's phone in 7 languages; four levels; one concrete action each | Live `gpt-6-luna` + rule fallbacks; `tests/projections.test.ts` |
| Worker-first governance | Projections: crews only for the supervisor, name only on a red flag; no disciplinary data path | Leakage tests over every minute of both branches |
| Field-ready operation | *When everything fails*: three wearables die, 35-minute network outage, dust storm; warnings continue on estimates | `tests/scenarios.test.ts` |
| Supervisor decision support | A decision in every scenario; Omar's tools run the real engine; rules refuse unlawful plans | Pour timing, tents, stand-downs, midday break (*Racing the midday break*) |
| Safety and productivity measures | August evidence report: lead time, false alarms, red flags, escalation, compliance, rest time, pours completed | 93 shifts × 4 policies |

## Scenarios (implemented 7 Nov, `packages/sim/src/catalog.ts`, stories in `apps/web/src/story.ts`)

| Scenario | Real day and shift | What it tests | Rules planner outcome (vs no intervention) |
| --- | --- | --- | --- |
| The afternoon pour | Tue 19 Aug 2025, 15:00–18:00 | Rotation, tents, red-flag escalation | 0 red flags (2), 17 high-strain worker-min (2,196), pour 15:30–16:15 |
| Racing the midday break | Tue 12 Aug 2025, 09:30–13:00 | Midday ban, coveralls (+1 °C), re-acclimatisation after 3 weeks' leave | 0 red flags (2), pour done by 12:20, 0 breaches of the 12:30 ban |
| The day nobody should pour | Fri 1 Aug 2025, 15:00–18:00 | Saying no: no lawful pour start exists | No pour, 0 high-strain minutes; no intervention gives 8 red flags |
| When everything fails | Tue 26 Aug 2025, 15:00–18:00 | Battery, network and dust failures | 0 red flags (2); warnings continue on estimates during the outage |

Rules added for coverage: **pour-start-high** (a new pour cannot start in a high-risk zone; a started pour may continue), **strict midday break** (no outdoor work 12:30–15:00, tents do not exempt; only recorded technical exemptions), **pour-not-possible** (the planner tool refuses rather than silently drops a requested pour), **clothing adjustment** per worker (ACGIH), pour crews with one spare per rotation group, 15 minutes cool-down before and a 15-minute contingency after.

## August 2025 back-test (implemented 7 Nov, `packages/sim/src/backtest.ts`)

31 days × 3 windows (07:00–10:00, 10:00–12:30, 15:00–18:00) × 4 policies, scripted failures removed. Runs in under 2 seconds.

| Policy (93 shifts) | High-strain worker-min | Severe-strain worker-min | Red flags | Median min to cooling | Violation episodes | Rest worker-min | Pours done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| No intervention | 177,118 | 31,503 | 197 | 6 | 6,863 | 56,189 | 93 |
| Site-wide flags | 118,357 | 10,625 | 52 | 6 | 5,201 | 96,575 | 93 |
| Heatline warnings only | 20,462 | 5,100 | 65 | 1 | 4,150 | 111,902 | 93 |
| Heatline + protective plan | 12,712 | 0 | 0 | — | 11 | 149,860 | 85 |

Warning performance (from no-intervention runs, judged against true strain the warning system cannot see): 86% of high-strain episodes warned in advance (3,815 of 4,449), median lead time 36 minutes (10th percentile 2 minutes), 10% false alarms (361 of 3,580 amber onsets). Honest findings: warnings alone still allow red flags when people push through; an enforced plan removes them; safety costs rest time and 8 pours with no lawful start.

## 1. Planning assumptions and decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Challenge | Population Health → Climate-Resilient Worker Health | Confirm the switch with Hack2skill before 10 Nov |
| Language | TypeScript throughout, Node ≥ 22 | Same stack as CrisisCraft; shared code between engine, server and tests |
| Frontend | React 19 + Vite + Three.js via React Three Fiber | Proven in CrisisCraft and Brew & Reason |
| Engine | Pure TypeScript package, deterministic, seeded, no wall-clock, no I/O | Replay, back-testing and tests depend on it |
| Provider | **OpenAI for everything** (team decision, 6 Nov), official `openai` Node SDK, Responses API | One key and one SDK for agents, speech and transcription |
| Models | **`gpt-6-luna` for every role** (team decision, 6 Nov), set by `OPENAI_MODEL` in `.env`; reasoning effort `low` everywhere | Cheapest and fastest current model; live tests show it handles the planner's tool loop (6 steps, ~10 s) and Bengali output. `gpt-6.1-sol` remains the upgrade path for the planner if evals show a need |
| Voice | Text to speech: `gpt-4o-mini-tts` on `/v1/audio/speech` (voice `marin`/`cedar`, `instructions` for a calm tone). Supervisor orders: `gpt-transcribe` | `gpt-4o-mini-tts` shuts down 6 Jan 2027 (after the event); successor is Realtime-only. OpenAI lists Hindi, Urdu, Arabic and Tagalog for speech; **Bengali and Malayalam are not listed** — test in M0 |
| Weather | Open-Meteo historical (scenario, back-test) and forecast (forecast mode); no key | Already downloaded and analysed in `research/data/` |
| WBGT | TypeScript port of Liljegren (2008), validated against ECMWF thermofeel outputs on all 744 August hours (tolerance 0.15 °C) | Physically based; the simple approximation was shown to mislead ([research 03](../research/03-abu-dhabi-heat-data.md)) |
| TWL | Shown only from a supplied measurement or a tested implementation of Brake & Bates; otherwise display WBGT and say so | Never present an approximation as a compliance value |
| Hosting | One Node service serving the web build and API (Azure Container Apps or Fly.io), credentials server-side | Long model calls and NDJSON streaming; avoid serverless time limits that constrained CrisisCraft |
| Data | Synthetic workers only; no real personal data anywhere | Governance and challenge rules |

## 2. Scope and release gate

The release candidate must pass all of these, checked by tests or a recorded rehearsal:

1. The 15:00–18:00 shift of **19 Aug 2025** plays end to end from real weather, in under 4 minutes at default speed.
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
| `agents` | Build each role's permitted context, call OpenAI models, validate outputs | See state outside its projection; mutate state |
| `server` | Own sessions, serialise commands, stream agent turns, hold credentials | Accept client-authored state |
| `web` | Render, collect commands, show provenance ("what they saw") | Invent outcomes; treat animation as state |

## 4. Scenario specification: "Saadiyat Tower, 19 August 2025"

**Status: implemented in M1** (`data/scenario/saadiyat-tower.json`, `packages/sim`). 19 August replaced 1 August after a scan of all 31 days: 1 August was so humid that every zone stayed high-risk all afternoon, leaving no decision to make. On 19 August the deck is high-risk at 15:30 and a shade tent or a later start changes what is lawful.

### Site

A 14-storey reinforced-concrete frame under construction, about 120 × 80 m, oriented with the long façade facing west. Zones, each with its own exposure computed every tick:

| Zone | Exposure | Notes |
| --- | --- | --- |
| Rebar yard (ground, east) | Sun; enters the tower's shadow mid-afternoon | Shadow ray-marched from the real sun azimuth/elevation |
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
| Suresh | B · deck (lead) | Malayalam | Acclimatised; skips breaks and pushes through strain warnings to finish the pour; starts 1.3 L short of water; the red-flag case |
| Bilal | C · façade | Urdu | Acclimatised; starts the afternoon short of water |
| Joel | C · façade | Tagalog (stretch) / English | Acclimatised |
| Ahmed | Foreman | Arabic | Relays approved plans |

### Fixed events (seeded and identical in every branch)

| Time | Event |
| --- | --- |
| 15:00 | Midday ban ends; crews return. Real weather for 19 Aug 2025 (humid sea-breeze afternoon) |
| 15:30 | Concrete truck arrives for the Level 12 pour (45 min of pour work, at least 5 on the deck at all times; paced work) |
| 15:40 | Ravi's wearable battery dies |
| 16:05–16:15 | Site Wi-Fi outage (worker phones keep running cached rules) |
| 16:43 | Suresh shows confusion **if** the original pour plan is approved (engine outcome) |
| 17:20 | Dust surge: humidity up, direct sun down for 25 minutes |
| 18:00 | Shift ends; debrief |

Suresh's red flag is an *outcome* of the engine, not a script: in the branch where the rotation is approved, it does not happen. `tests/engine.test.ts` asserts both.

### Golden comparison fixture

Decision at 15:10, both branches under Heatline warnings: **A** keep the original schedule; **B** approve the rules planner's plan (tents on the deck and yard; Anwar to light indoor duties; pour crew of 15 including borrowed crew-A workers on 20/40 rotation; water to the zone requirement).

| Measure (frozen snapshot) | A · original | B · protective plan |
| --- | --- | --- |
| Worker-minutes at PSI ≥ 7 | 190 | 69 |
| Worker-minutes at PSI ≥ 9 | 52 | 0 |
| Red flags | 1 (Suresh, 16:43; cooling at 16:44) | 0 |
| Rule-violation episodes | 80 | 11 (all before 15:10) |
| Pour | 15:38–17:06 | 15:30–16:15 |

The protective plan finishes the pour *earlier*, because the original schedule stops the pour for every break, but it costs far more rest minutes elsewhere on site.

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

Coefficients (`k_*`, `c_*`, `W0`, τ) are chosen so that: an acclimatised worker doing moderate work at WBGT 28 °C stays below PSI 5 for 60 min; heavy work at WBGT 34 °C without rest reaches PSI ≥ 7 within 30–50 min; unacclimatised workers reach thresholds ~30% sooner; a 20-minute AC rest lowers Tc by ~0.4–0.6 °C. These targets are documented with the test that enforces them (`tests/physiology.test.ts`). The model is **illustrative**, not validated physiology; the UI and docs say so.

## 6. Rules engine

Rule tables live in `data/rules/*.json`, each row with a `source` field pointing at the research document and section.

| Rule set | Content | Source |
| --- | --- | --- |
| Midday ban | 12:30–15:00, 15 Jun–15 Sep, outdoor direct-sun work blocked unless an exemption reason is recorded | MoHRE ([research 04](../research/04-uae-regulation-and-governance.md)) |
| Zone schedule | TWL zone → work/rest and water per hour; WBGT-based fallback schedule when TWL is unavailable | Sharjah CoP 33; ACGIH screening ([research 02](../research/02-heat-stress-science-and-standards.md)) |
| Acclimatisation | NIOSH 20%/day cap for new workers; 50/60/80/100% for returning; > 14 days off resets | NIOSH 2016; Sharjah CoP 33 |
| No lone work | Buffer and withdrawal zones require pairs | Sharjah CoP 33 |
| Warning levels | Green/yellow/amber/red from the worst of: zone, PSI band, water deficit, acclimatisation cap | Dubai flag colours + PSI bands |
| Red flag | Confusion, collapse, PSI ≥ 9, Tc ≥ 39.5 → emergency workflow | OSHA first aid |
| Governance | G1–G7 from [research 04](../research/04-uae-regulation-and-governance.md) | Challenge text |

**Precedence:** red flag > rules > approved plan > agent suggestion. A warning can be raised by an agent's observation (e.g., a worker says "I feel dizzy"), but never lowered by one.

**Plan validation** checks every proposed assignment minute by minute over the horizon: zone exposure vs schedule, acclimatisation caps, pairs, water access ≥ required L/h, ban window, cabin capacity, crew size for the pour (min 5 on deck while pouring). Output: `{ ok, violations: [{ rule, worker?, crew?, at, detail }] }`.

## 7. Agents

### Roles and what each may see (enforced by projection functions)

| Agent | Sees | Can do | Model |
| --- | --- | --- | --- |
| **Guardian** (one per featured worker) | Own signals and history, own location's conditions, own schedule, own rule state, the worker's language | Phrase the current rule-based warning; answer the worker's questions; run symptom check-ins | `gpt-6-luna`, effort `low`, ≤ 2 sentences, structured output |
| **Noor · site safety** | Crew aggregates only (counts per warning level, zone conditions, water stock, schedule compliance) | Raise crew-level requests to the supervisor | `gpt-6-luna`, effort `low` |
| **Omar · planner** | Noor's requests, task list, roster with *capability tags only* (acclimatised yes/no, current crew), forecast, zone map | Tools: `get_forecast`, `list_tasks`, `check_plan` (dry run), `submit_plan` | `gpt-6.1-sol`, effort `medium`, strict tool loop (≤ 6 steps) |
| **Debrief** | Event log and metrics of one or two runs | Write the after-action review; every claim cites event IDs; numbers are inserted from metrics, not generated | `gpt-6.1-sol`, effort `medium` |

Projection tests: for every role, a property test generates random states and asserts the serialised context contains no field outside the role's allowlist (e.g., no `hr`, `tc`, `symptoms` in Noor's or Omar's context).

### Model use details (OpenAI Responses API, docs read 6 Nov 2026)

- Single-shot roles (guardian, site safety, debrief): `openai.responses.parse({ model, reasoning: { effort }, input, text: { format: zodTextFormat(schema, name) } })`, then `response.output_parsed`; reject and fall back if parsing fails or output is incomplete.
- Implemented in `server/index.ts`; prompts, schemas, projections and fallbacks in `packages/agents`.
- Planner: `openai.responses.create` with function tools defined `strict: true` (`additionalProperties: false`, every property in `required`, optional fields as `["type", "null"]`), loop on `function_call` items, append `function_call_output` items, ≤ 6 steps, and require a final `submit_plan` call. Tool calling for Sol requires the Responses API.
- No `temperature`/`top_p` when reasoning effort is not `none`.
- Budgets: guardian ≤ 6 s, planner ≤ 40 s total workflow, debrief ≤ 30 s; streamed to the UI as NDJSON with visible tool steps, as in CrisisCraft.
- Every model output passes the same guardrail class as ReRoute's coach: length, language script, no medical claims, numbers must match engine values.

### Planner levers (implemented)

Omar does not write minute-by-minute schedules. He sets three levers, which `protectivePlan` compiles into a full plan and `validatePlan` checks:

| Lever | Values |
| --- | --- |
| `tents` | Up to two of the tentable zones (deck, yard), in setup order; 15 minutes each to put up |
| `pourStart` | `HH:MM`, or `null` for no pour today; omitted means the earliest lawful start |
| `standDown` | Worker ids moved to indoor duties for the rest of the shift |

`check_plan` compiles, validates and simulates the levers to 18:00, returning violations or a forecast (high-strain minutes, red flags, pour start and finish, rest minutes). `submit_plan` is accepted only if the plan passes; a refused submission goes back to Omar with the reasons.

### Without a model

Each role has a deterministic fallback: template warnings in all languages (pre-translated, reviewed), template crew requests, a rule-derived default plan (rotate unacclimatised workers to shade, 20/40 on heavy tasks), and a template debrief. The UI shows "Rules-only mode".

## 8. Voice and languages

- Written warnings: EN, AR, HI, UR, BN, ML. Templates are translated once and frozen; model-phrased warnings are checked by script detection and a back-translation eval (section 9).
- Spoken: OpenAI `gpt-4o-mini-tts`; target EN, AR, HI, UR live (listed languages). Bengali and Malayalam are not in OpenAI's speech language list: test them in M0; if quality is poor, show the written warning and play a short pre-recorded tone plus the worker's name. Cache audio by text hash.
- Implemented 7 Nov: `/api/speak` plus a Listen button on the phone, with an in-memory cache keyed by language and text. On-site speech bubbles (`dialogue.ts`) show what people say in their own language with English underneath, driven by engine events.
- Supervisor voice orders: `gpt-transcribe` (EN), transcript editable before sending.
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
- **Guardian, 60 messages** (6 languages × 10 situations): correct script, length, no forbidden content, numbers match engine, back-translation preserves the action (judged by a second model call with a rubric, then spot-checked by a person).
- **Projection leakage:** 0 tolerated; enforced by tests, not evals.

## 10. User interface and visual direction

**Story mode (implemented 6 Nov, `apps/web/src/story.ts`, `components/Intro.tsx`, `components/StoryCard.tsx`).** The app opens on an entry screen: the claim, the afternoon's real conditions at 15:00, why it matters (WBGT ≥ 31 °C every August day 12:00–18:00), the viewer's role, and six fictional characters with home towns and languages. "Begin the shift" plays the story; "Explore freely" plays without narration (it still pauses for the decision).

| Beat | Time | Camera | What the viewer learns |
| --- | --- | --- | --- |
| Chapter 1 · The break is over | 15:00 | overview | Heat after the ban; guardians; crews not bodies |
| Day two | 15:02 | tool store | Anwar stood down by the rules, privately |
| Chapter 2 · The truck is coming | 15:10 | deck | The decision; Omar and the rules |
| Concrete | truck event | gate | Branch-specific: rotation vs whole crew in sun |
| Six percent | battery event | yard | Wearable dies; estimate continues |
| No signal | network event | overview | Phones keep warning offline |
| Chapter 3 · Suresh | red-flag event (original) or 16:43 (plan) | deck | Red flag and disclosure, or why it didn't happen |
| Dust | weather event | overview | Twin recalculates |
| Chapter 4 · End of shift | 18:00 | overview | Outcome numbers; decide again, compare, or explore |

Beats that follow engine events (truck, battery, network, red flag, dust) take their time from the run, so they stay correct whatever plan is approved.

**Scene (rebuilt 6 Nov, `apps/web/src/scene/`).** A fenced plot on Saadiyat Island with hoarding, gate and guard hut; Saadiyat Tower at Level 12 with core, columns, curtain wall on floors 1–4, blockwork, green netting, edge barriers, formwork props, rebar mat and fresh concrete; material hoist; hammerhead crane; concrete mixer and boom pump during the pour; rebar bundles and bending shed; shade shelter with benches, fans and water coolers; welfare cabins, tool store, first aid; site offices, toilets, generator, water tank, pickups; phase-2 tower at Level 6 with its own crane; a finished residential block, villas, palms, roads, beach, sea and distant silhouettes. Workers wear navy coveralls, lime hi-vis vests with reflective bands, yellow helmets with neck shades (the crew lead an orange vest, the foreman a white helmet and tablet, façade crew harnesses) and are articulated: they walk between places, work in task-specific poses, sit to rest and lie down when being cooled. Dust surges thicken and tint the haze.


**Implemented (first playable, 6 Nov):** `apps/web` with the site twin (React Three Fiber, real sun direction and shadows, tower, scaffold, yard, tents, truck, concrete filling the deck during the pour), labels projected to the DOM, top bar, supervisor console (Noor's brief, crew cards with counts only, red-flag disclosure, decision card with Omar's streamed tool steps, site log), worker phone (featured-worker tabs, native script + English, readings with source, stale-message indicator), timeline with event markers and speeds, and the rewind comparison table. The engine runs in the browser; only model calls go to the server.

Still to do from the list below: heat shimmer, voice, captions, keyboard paths beyond play/pause, phone/narrow layout, 2D fallback.


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
  research/            sources, weather data and evidence documents
  scripts/{backtest.ts, eval-planner.ts, eval-guardian.ts, wbgt-golden.py}
```

## 12. Calendar and milestone gates

| Date (GST) | Milestone | Gate |
| --- | --- | --- |
| **Fri 6 Nov** | M0 spikes: repo scaffold; Liljegren TS port + golden file from thermofeel; OpenAI strict tool loop and structured output; `gpt-4o-mini-tts` samples in 6 languages; 3D asset licences | Golden WBGT within 0.15 °C on 744 hours (done); 4+ languages have acceptable voices |
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
| Voices missing or poor for a language (Bengali, Malayalam not listed by OpenAI) | Written warning in the worker's language + audio cue; list the gap honestly |
| `gpt-4o-mini-tts` shutdown on 6 Jan 2027 | Fine for the event; production migration to the Realtime API successor noted |
| 3D scope slips | Cut order: dust visual → second tent → façade detail → keep a 2D top-down twin (still shadow-accurate) |
| Model latency | Effort `low` for guardians; prefetch the next warning text when a level change is imminent; rules-only fallback |
| Back-test runtime | Rules-only policy, no model calls; parallel workers; cache weather per day |
| Deadline is actually 15 Nov | Release candidate is already 15 Nov; record a short video on 15 Nov as insurance |

Cut order overall (last cut first): forecast mode → Tagalog/Malayalam audio → dust event → debrief model (keep template) → second scenario window.

## 15. Three-minute demo

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | Site at 15:00, shadow sweeping, top bar | "19 August 2025, Saadiyat. Real weather. The midday break just ended. WBGT is still 34 degrees." |
| 0:15 | Anwar's phone, Bengali voice | "Anwar is on his second day. His guardian tells him, in Bengali, to rest now. Only he sees his heart rate." |
| 0:35 | Noor's crew request; supervisor asks "Can we still pour at 15:30?" | "I see crews, not people's bodies. That line is enforced in code." |
| 0:55 | Omar's tool steps; plan refused (unacclimatised worker in buffer zone), revised, approved | "The planner can propose anything. The rules decide what's allowed." |
| 1:25 | Wearable dies, Wi-Fi drops: warnings continue in rules-only mode | "Field-ready means it still works when the battery and the network don't." |
| 1:45 | (In the as-played branch) Suresh's red flag at 16:43: escalation, cooling a minute later | "A red flag is the one time his name reaches me, and he can see that it did." |
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
3. Spike: one `gpt-6-luna` structured-output call and one `gpt-6.1-sol` strict tool loop from the server; record latency at `low` and `medium` effort.
4. Spike: `gpt-4o-mini-tts` samples in EN, AR, HI, UR, BN, ML; listen to Bengali and Malayalam before committing to them.
5. Pick 3D construction assets with clear licences (CC0 preferred) and record them in `docs/assets-and-licenses.md`.
6. Email Hack2skill support to confirm the challenge switch and the deadline.
