# 06 · Heatline concept

Status: selected concept, 6 November 2026. Challenge: **Population Health → Climate-Resilient Worker Health**.

**Heatline is a live digital twin of a construction site on an August afternoon in Abu Dhabi. Real weather drives every worker's heat strain; each worker has a guardian that warns them in their own language; the supervisor sees only what crews need, approves the plan, and can rewind the shift to see what a different decision would have changed.**

Pitch: *"The midday break covers two and a half hours. The heat doesn't stop at three."*

## Why this, why now

- In August 2025, near Saadiyat, physically based WBGT stayed **≥ 31 °C every day from 12:00 to 18:00** and on 90–97% of days from 10:00 ([03](03-abu-dhabi-heat-data.md)). The midday ban covers the peak, not the whole exposure.
- 84% of August working hours were "high" or "very high" on Dubai Municipality's heat-index scale.
- In Qatar, cardiovascular deaths among young Nepali workers rose from 22% of deaths in the cool season to 58% in the hot season, with an estimated ~200 of 571 preventable by effective heat protection ([02](02-heat-stress-science-and-standards.md)).
- UAE sites already run under TWL zones (Abu Dhabi, Sharjah), heat-index flags (Dubai) and the federal midday ban ([04](04-uae-regulation-and-governance.md)). Supervisors get a zone or a flag per site, not per crew or per person, and nothing that helps them decide *what to change*.

## Intended users

| User | What they get |
| --- | --- |
| **Site supervisor / HSE officer** (the player) | Crew-level risk, rule-checked plan proposals, rehearsal of hard calls before summer |
| **Worker** | Warnings and coaching in their language, private signals, a red-flag button |
| **Safety trainer / regulator** | Drills on a real site layout and real weather; a debrief that cites events |

## The experience

### Opening (10 seconds to understand)

A sunlit tower site on Saadiyat. Real sun position: the tower's shadow sweeps across the yard as the afternoon moves; the west façade turns orange. A heat haze over the concrete deck. Top bar: **15:05 · 19 Aug 2025 · WBGT 34 °C (sun) · Zone: high risk · Midday ban ended 15:00**. Three crews:

| Crew | Task | Exposure |
| --- | --- | --- |
| **A · Rebar yard** (ground) | Tying rebar, carrying bars | Heavy work, partial shade from the tower by 16:00 |
| **B · Level 12 deck** | Concrete pour at 15:30, truck already booked | Heavy, full sun, no shade, pour cannot stop once started |
| **C · West façade scaffold** | Panel fixing | Moderate, afternoon sun on the west face, work at height |

Featured workers have names, languages and histories: **Anwar** (Bengali, day 2 on site, unacclimatised), **Ravi** (Hindi, third summer, wearable battery at 6%), **Suresh** (Malayalam, Crew B lead, skips breaks to finish the pour), **Bilal** (Urdu), **Joel** (Tagalog), **Ahmed** (Arabic, foreman).

### Warn

Each worker has a **guardian**. Anwar's guardian sees his simulated heart rate, estimated core temperature, his acclimatisation day, water intake and the conditions where he stands, and nothing about anyone else. At 15:12 it speaks to him in Bengali: *"Anwar, it's your second day. Rest 20 minutes in the cabin now; drink a full bottle."* The warning level comes from rule tables (TWL/WBGT, acclimatisation caps, PSI bands); the model only words it and answers his questions.

The supervisor does **not** see Anwar's heart rate. Noor, the site safety agent, sees crew-level aggregates and requests: *"Crew B: 3 workers need shade within 10 minutes. Crew B has no shade on Level 12."*

### Decide

The supervisor asks in plain words: *"Can we still pour at 15:30?"* Omar, the planning agent, works the problem with tools (forecast, task list, crew roster, rule check) and proposes: *"Move Anwar to light duties in the tool store; put a shade tent on the Level 12 deck; borrow six of Crew A for the pour and run three groups on 20/40 so five are always pouring; water at 1.5 L/h."* The rules engine checks it: no unacclimatised worker in the buffer zone, no lone working, water ≥ 1.2 L/h scheduled, no outdoor sun work in the ban window. Refused plans go back to Omar with the reason. The supervisor approves or edits.

### Things go wrong (field-ready)

- Ravi's wearable dies. His guardian says so and switches to an environment-only estimate with wider uncertainty.
- The site network drops for ten minutes. Worker phones keep warning from cached rules and forecast, with no model calls.
- A dust surge raises humidity and blocks the sun; the twin recomputes.
- If the original pour plan stands, at 16:43 Suresh, who has pushed through his guardian's warnings to finish the pour, becomes confused. That is a **red flag**: the rules engine escalates immediately to the first-aider and supervisor with location (the logged exception to the privacy boundary), shows the cooling steps, and the guardian stays with him. No model decides this.

### Rewind

At the end of the shift (18:00) the debrief shows what happened, with citations to events. Then the supervisor picks any decision ("15:10 · approve original pour plan") and **rewinds**. Same weather, same people, same events; one changed decision. Two sites play side by side:

| Measure | As played | With rotation + shade |
| --- | --- | --- |
| Worker-minutes at PSI ≥ 7 | e.g. 46 | e.g. 9 |
| Red-flag events | 1 | 0 |
| Unacclimatised exposure over cap | 22 min | 0 |
| Water shortfall | 3.4 L | 0.2 L |
| Pour finished | 17:10 | 17:35 |
| Rule violations | 2 | 0 |

The productivity cost is shown honestly (the pour finished 25 minutes later). The challenge says worker protection comes before productivity; Heatline makes the trade-off visible rather than hiding it.

### Forecast mode (the bridge to a real pilot)

Type any site coordinates and date: Heatline pulls the Open-Meteo forecast, and Omar drafts tomorrow's plan, e.g. pour at 05:30, Crew B on 40/20 from 10:00, extra water runs at 14:45 and 16:15. Same engine, same rules, no rewind.

## What makes it better than our previous projects

| CrisisCraft / Village of Shadows / BatchLens did | Heatline adds |
| --- | --- |
| Fictional world with authored events | **Real weather** (ERA5 August 2025), real sun position and shadows, real published UAE rule tables |
| Agents with partial knowledge | Partial knowledge **as a privacy guarantee**: what each agent may see is the governance model, tested in code |
| Rewind one decision | Rewind **plus back-testing** across 31 real days: warning lead time and false-alarm rate measured, not asserted |
| Text and voice orders | **Multilingual spoken warnings** to workers in six languages, and voice orders from the supervisor |
| Simulation outcome metrics | **Health outcome proxies** grounded in standards (PSI bands, TWL zones, NIOSH acclimatisation caps) |
| Scenario training tool | Training **and** forecast mode that plans a real tomorrow, which is a path to pilot |

## Boundaries

| In the MVP | Optional once the core works | Excluded |
| --- | --- | --- |
| One site, three crews, ~20 workers (6 featured) | Second site or night-shift scenario | Real worker data of any kind |
| Real Aug 2025 weather replay; forecast mode for any coordinates | Live Open-Meteo "today" mode on the opening screen | Claims of clinical accuracy or validated injury prevention |
| Rule tables: midday ban, TWL zones, acclimatisation caps, red flags | Measured TWL import (CSV) | Diagnosis, medication advice |
| Guardian, site safety, planner and debrief agents with bounded context | Worker voice replies (speech-to-text in their language) | Employer access to individual physiology |
| Multilingual spoken warnings (EN, AR, HI, UR, BN, ML) | Tamil, Nepali, Tagalog | Real device integrations (simulated signals only) |
| One-decision rewind with side-by-side replay | Multi-decision branches | Productivity scoring of individuals |
| Back-test report over 31 days | Sensitivity analysis on model coefficients | |

## Success criteria

1. A first-time viewer understands the situation within ten seconds (site, heat, time, who is at risk).
2. A guardian warning is heard in a worker's language within one simulated minute of the rule triggering.
3. The supervisor never sees an individual reading except in a logged red-flag event, and a test proves it.
4. A planner proposal that breaks a rule is refused with the rule cited, revised once, and the valid plan visibly changes the crews' movements.
5. Rewinding one decision produces a reproducible, explained difference in the outcome measures.
6. The back-test reports lead time and false-alarm rate across all 31 August days.
7. With models disabled or the network down, warnings still fire from rules.

The build plan is in the Heatline repository: [`Heatline/docs/implementation-plan.md`](../Heatline/docs/implementation-plan.md).
