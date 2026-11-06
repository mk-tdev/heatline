# 01 · Challenge and event

Researched 6 November 2026. Every claim is marked **Verified** (a source was read) or **Unverified**.

## Decisions and actions for the team

1. **Challenge switch: done.** The team confirmed on 6 Nov 2026 that the entry is accepted under *Population Health → Climate-Resilient Worker Health* (previously *Wellbeing → Sustaining Healthy Behaviors*).
2. **Treat 15 November as a possible deadline until confirmed.** One syndicated report says applications close 15 Nov; the Hack2skill page says prototypes are due 20 Nov. Plan the internal release for **15 Nov**.
3. **Fix the challenge files in `research/challenges/`.** Two are mislabeled (see below).

## The event

| Item | Detail | Status |
| --- | --- | --- |
| Name | Future Health Digital Innovation Challenge | Verified ([Hack2skill](https://hack2skill.com/event/futurehealthchallenge/)) |
| Organiser | *Future Health – A Global Initiative by Abu Dhabi*, with the Department of Health – Abu Dhabi | Verified ([WAM](https://www.wam.ae/en/article/c2r7j8n-future-health-launches-global-challenge-move), [Zawya](https://www.zawya.com/en/press-release/companies-news/future-health-launches-global-challenge-to-move-health-innovation-towards-real-world-application-1680763)) |
| Co-creators | Inception42, MBZUAI and Microsoft are named as co-creators in press coverage | Verified in press coverage; exact roles unverified |
| Ask | AI, software and connected-technology solutions across fertility, population health and wellbeing | Verified |
| Structure | 3 focus areas, 10 challenge statements | Verified (Hack2skill) |
| Eligibility | Open worldwide: start-ups, researchers, developers, clinicians, students; teams up to 5; lead 18+ | Verified (Hack2skill, press) |
| Prizes | USD 50,000 / 35,000 / 20,000 (pool USD 105,000) | Verified (Hack2skill, press) |
| Dates | Registration 15 Oct–10 Nov · Prototypes due 20 Nov · Evaluation 20–30 Nov · Awards at GITEX, 7–11 Dec 2026 | Verified on Hack2skill; "dates may change" |
| Deadline discrepancy | A Chinese-language syndicated report gives 15 Nov as the application close | Unverified ([CNA](https://www.cna.com.tw/postwrite/chi/447255)) |
| Submission | "Working prototype… with technical documentation, assumptions, and limitations" | Verified (Hack2skill). Video/deck/repo requirements not visible; the FAQ answer did not load |

Do not confuse this with the separate **Future Health Challenge 2026 with MIT Solve** (USD 300,000, disease prediction), which is a different programme ([Gulf News](https://gulfnews.com/uae/health/300000-up-for-grabs-as-abu-dhabi-mit-solve-launch-global-health-challenge-1.500433217)).

## Judging criteria (no weights published)

| Criterion | Heatline evidence we must produce |
| --- | --- |
| Health impact and clinical relevance | UAE heat burden, official thresholds (TWL/WBGT/heat index), heat-illness red flags, back-tested warning lead time |
| Technical depth and architecture | Deterministic physiology + environment engine, bounded multi-agent design, rules engine, replay, measured evaluation |
| Working solution and demonstration quality | Playable live twin of a real site, real August 2025 weather, rewind comparison, 3-minute demo |
| Responsible AI, safety and data governance | Worker-first data boundaries enforced in code, no disciplinary use, small-cell suppression, human escalation |
| Scalability and deployment readiness | Field fallbacks (sensor/battery/network), multilingual, standard weather APIs, deployment notes and costs |
| Commercial viability and path to pilot | Buyers bound by the midday ban and OSHAD codes, pricing hypothesis, pilot protocol with measurable outcomes |

Verified list: [Hack2skill event page](https://hack2skill.com/event/futurehealthchallenge/). The rules page (`/tnc`) did not render for us; weights, IP terms and AI-model restrictions are **unverified**.

## The challenge we are answering

Source: the team's copy in [`challenges/[Population Health] Climate-Resilient Worker Health.txt`](challenges/%5BPopulation%20Health%5D%20Climate-Resilient%20Worker%20Health.txt) (copied from the Hack2skill dashboard; not visible on the public page).

**Question:** how might we protect workers exposed to extreme heat and other climate-related occupational risks through earlier warning, personalised prevention and safer operational decisions?

The six desired outcomes, and the Heatline feature that answers each:

| Desired outcome (paraphrased) | Heatline answer |
| --- | --- |
| **Dynamic heat-risk assessment** from environment, workload, shift context and optional consented worker signals | Per-worker and per-crew strain model driven by real weather, task metabolic rate, clothing, acclimatisation and optional wearable signals |
| **Clear, graded, multilingual warnings** with a safe action | Four-level warnings mapped to official UAE bands, spoken and written in workers' languages, each with one concrete action |
| **Worker-first governance**: consent, minimisation, no disciplinary use | Individual signals stay with the worker's guardian agent; supervisors see crew-level risk only; disciplinary use is blocked in code |
| **Field-ready operation** with safe fallback | Simulated sensor dropout, battery death, network loss and dust; falls back to an environment-only estimate and says so |
| **Supervisor decision support** at crew/site level | Planning agent proposes rotations, re-timed pours, shade and cooling; rules engine checks; supervisor approves |
| **Safety and productivity measures**: lead time, false alarms, adherence, incidents, escalations, compliance, lost time | Back-testing over August 2025 plus a branch comparison of every shift; all reported on a dashboard |

The challenge text also warns that "worker protection must come before productivity optimisation" and that over-collection "can become intrusive surveillance". Both are design constraints, not features.

## Mislabeled challenge files

| File name | Actual content |
| --- | --- |
| `[Wellness] Sustaining Healthy Behaviors.txt` | Population and Workforce Health **Early Warning** brief |
| `[Population Health] Population and Workforce Health Early Warning.txt` | Duplicate of **Earlier, Safer Mental-Wellbeing Support** |
| `Earlier, Safer Mental-Wellbeing Support.txt` | Mental-Wellbeing brief (correct) |
| `[Population Health] Climate-Resilient Worker Health.txt` | Climate-Resilient Worker Health (correct) |
| `[Population Health] Protecting Brain Health Earlier.txt` | Brain Health (correct) |

The real *Sustaining Healthy Behaviors* text is not in the folder. The Early Warning brief overlaps with Heatline (multi-signal surveillance, small-cell suppression, back-testing); Heatline's site dashboard can borrow its validation language.

## What we could not verify

- Rule weights, IP terms, code-visibility and pre-existing-code rules, and whether a demo video or deck is required.
- Whether finalists must attend GITEX in person.
- Whether 15 Nov or 20 Nov is the binding deadline.

## Sources

- Hack2skill event page, https://hack2skill.com/event/futurehealthchallenge/ (accessed 5–6 Nov 2026)
- WAM, "Future Health launches global Challenge…", https://www.wam.ae/en/article/c2r7j8n-future-health-launches-global-challenge-move
- Zawya press release, https://www.zawya.com/en/press-release/companies-news/future-health-launches-global-challenge-to-move-health-innovation-towards-real-world-application-1680763
- Abu Dhabi Media Office topic page, https://www.mediaoffice.abudhabi/en/topic/future-health-challenge/
- CNA (Chinese), https://www.cna.com.tw/postwrite/chi/447255
- Gulf News on the separate MIT Solve challenge, https://gulfnews.com/uae/health/300000-up-for-grabs-as-abu-dhabi-mit-solve-launch-global-health-challenge-1.500433217
