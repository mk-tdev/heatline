# Future Health research · Heatline

Selected concept: **Heatline**, a live digital twin of a construction site on an August afternoon in Abu Dhabi. Challenge: **Population Health → Climate-Resilient Worker Health**. Research date: 6 November 2026.

Start with the concept, then read the evidence it rests on.

| Document | What it answers |
| --- | --- |
| [06 · Heatline concept](06-heatline-concept.md) | The experience, users, differentiation, boundaries and success criteria |
| [01 · Challenge and event](01-challenge-and-event.md) | Organisers, dates, judging, the challenge's six desired outcomes, actions for the team |
| [02 · Heat-stress science and standards](02-heat-stress-science-and-standards.md) | WBGT, TWL zones, heat index bands, ACGIH, NIOSH acclimatisation, PSI, heat illness, Gulf burden |
| [03 · Abu Dhabi heat data](03-abu-dhabi-heat-data.md) | Real August 2025 weather near Saadiyat, WBGT by hour, how much exposure the midday ban leaves |
| [04 · UAE regulation and governance](04-uae-regulation-and-governance.md) | Midday ban, OSHAD/Sharjah/Dubai codes, PDPL, and Heatline's code-enforced privacy rules |
| [05 · Market and competition](05-market-and-competition.md) | Wearables, apps, buyers, business model hypothesis, path to pilot |
| Implementation plan | [`../Heatline/docs/implementation-plan.md`](../Heatline/docs/implementation-plan.md) |

## Collected materials

| Path | Contents |
| --- | --- |
| `data/abu-dhabi-saadiyat-2025-08-hourly.json` | Open-Meteo (ERA5) hourly weather, 1–31 Aug 2025, 24.50 N 54.42 E |
| `data/analyse_august.py` | Heat index bands and a simple shade-WBGT approximation (stdlib only) |
| `data/analyse_august_liljegren.py` | Physically based WBGT with ECMWF thermofeel (Liljegren 2008) |
| `evidence/sharjah-oshj-cop33-safety-in-heat.pdf` (+ `.txt`) | Sharjah OSHJ-CoP-33 "Safety in Heat", v2 Rev 0, July 2024 — TWL zone table |
| `evidence/dubai-municipality-heat-stress-guidelines-v2-2019.pdf` (+ `.txt`) | Dubai Municipality heat-stress guideline v2.0 (2019) — heat-index bands, flag system |
| `challenges/` | Challenge statements copied from the event dashboard. **Two files are mislabeled**; see [01](01-challenge-and-event.md#mislabeled-challenge-files) |

## Open items

- Challenge switch confirmed (6 Nov). Still confirm whether the deadline is 15 or 20 Nov.
- Retrieve Abu Dhabi OSHAD CoP 11.0 and the Dubai v3.0 (2024) guideline directly.
- Confirm current ACGIH TLV values before quoting them in the product.
- Validate the worker-language list with a UAE contractor.
