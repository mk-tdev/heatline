# 04 · UAE regulation and data governance

Researched 6 November 2026. Not legal advice; Heatline's rules engine encodes these as *demonstration* rules with citations, and a pilot needs legal review.

## Federal: the summer midday break (MoHRE)

| Rule | Detail | Status |
| --- | --- | --- |
| Window | No outdoor work under direct sunlight **12:30–15:00**, **15 June–15 September** | Verified for 2025 and 2026 ([WAM](https://www.wam.ae/en/article/c0memda-mohre-announces-return-occupational-heat-stress), [Gulf News](https://gulfnews.com/uae/government/uae-enforces-midday-work-ban-to-protect-workers-from-extreme-summer-heat-1.500158147), [Khaleej Times](https://www.khaleejtimes.com/uae/uae-midday-break-2025-june-15-to-september-15)) |
| Penalty | AED 5,000 per worker, up to AED 50,000 for multiple workers | Verified ([Khaleej Times](https://www.khaleejtimes.com/uae/midday-break-violators-dh50000-fine-suspension-legal-action)) |
| Exemptions | Work that must continue uninterrupted for technical reasons or emergencies (inspectors are trained to distinguish these) | Verified (same) |
| Employer duties | Shaded rest areas or indoor facilities; cooling (fans, air-conditioned rooms); water; first aid | Verified ([People Matters](https://me.peoplemattersglobal.com/news/employee-relations/mohre-outlines-mandatory-requirements-for-summer-mid-day-break-46134)) |
| Reporting | Public can report violations via MoHRE call centre 600590000, website or app | Verified |

**Heatline rule:** between 12:30 and 15:00 in season, any planned outdoor task in direct sun is blocked unless tagged with a documented exemption; the planning agent cannot schedule it, and the supervisor cannot approve it without an exemption reason that is logged.

## Abu Dhabi

- **OSHAD-SF Code of Practice 11.0 "Safety in Heat"** (Abu Dhabi EHSMS, 2013) requires a site-specific heat stress programme using the **Thermal Work Limit** to set work/rest and water. Thresholds quoted in news (TWL < 115 "harsh", 1.2 L/h, light 45/15, heavy 20/40) match the Sharjah table in [02](02-heat-stress-science-and-standards.md). The OSHAD document was not retrieved directly. ([Middle East Construction News](https://meconstructionnews.com/4095/abu-dhabi-introduces-heat-stress-measure-to-protect-outdoor-workers/amp), [Scarlet Tech](https://scarlet-tech.com/?p=7018))
- **Abu Dhabi Public Health Centre "Safety in Heat" programme**: 11th year in 2025; more than 9 million people reached through 22,164 awareness and inspection visits; annual awareness package for workplaces. ([Abu Dhabi Media Office](https://www.mediaoffice.abudhabi/en/health/abu-dhabi-public-health-centre-celebrates-11-years-of-safeguarding-workers-during-summer-season-through-safety-in-heat-programme/))
- **Planned WBGT-based heat index**: in 2024 the Public Health Centre tendered an index tailored to UAE climate, occupational settings and "physiological differences among its diverse population". No confirmation it has launched. ([AGBI](https://www.agbi.com/health/2024/07/heat-health-warning-system-planned-for-abu-dhabi/))
- **Forecast data sharing (Sept 2025)**: the National Centre of Meteorology will share temperature and humidity data with Abu Dhabi health authorities under a new action plan. ([The National](https://www.thenationalnews.com/news/uae/2025/09/15/abu-dhabi-unveils-action-plan-to-protect-public-from-extreme-weather))
- Public guidance names five signs of heat stress and advises drinking at least a litre of water before starting work. ([Gulf News](https://gulfnews.com/uae/abu-dhabi-identifies-five-signs-of-heat-stress-and-four-key-preventive-measures-as-midday-work-ban-takes-effect-1.500573957))

**Opportunity:** the emirate is building the very index and data pipeline Heatline consumes. Heatline should be designed to plug in an official index when it exists, rather than compete with it.

## Other emirates

- **Dubai Municipality** guideline (heat-index bands, flag colours, rest at ≤38.5 °C core) — details in [02](02-heat-stress-science-and-standards.md).
- **Sharjah OSHJ-CoP-33** (v2, July 2024) — full TWL zone table in [02](02-heat-stress-science-and-standards.md); audited by SPSA.

## Data protection

| Instrument | Relevance | Status |
| --- | --- | --- |
| **Federal Decree-Law 45/2021 (PDPL)** | Health and biometric data are *sensitive personal data*; consent must be clear and withdrawable; executive regulations govern details | Verified in commentary; whether executive regulations are in force is **unverified** ([Bird & Bird](https://twobirds.com/en/insights/2021/uae/how-does-the-new-uae-federal-decree-law-on-personal-data-protection-compare-against-the-gdpr), [UAE legislation portal](https://uaelegislation.gov.ae/en/legislations/1972/download)) |
| **Federal Law 2/2019 (ICT in Health Fields)** | Some commentators say health data is governed by this law rather than the PDPL; it includes data localisation obligations | Conflicting commentary; **unverified** |
| Abu Dhabi DoH health information standards (e.g., ADHICS) | Likely applies if Heatline integrates with health providers | Not researched; out of MVP scope |

Practical stance for the prototype: no real worker data at all (synthetic crews), and a design that would satisfy the strictest reading: explicit, granular, revocable consent; minimisation; in-country hosting for a pilot; no employer access to individual physiological data.

## Worker-first governance: Heatline's enforceable rules

The challenge itself warns that over-collection "can become intrusive surveillance" and that individual risk data "could be misused in employment decisions". Heatline encodes these as code-level boundaries, tested like any other rule:

| Rule | How it is enforced |
| --- | --- |
| **G1. Individual signals stay with the worker** | Heart rate, estimated core temperature and symptoms are visible to the worker and their guardian agent only. The supervisor view receives crew-level aggregates and *action requests* ("Crew B: 2 people need shade now"), not readings. |
| **G2. Emergencies are the exception, and it is logged** | A red-flag event (e.g., confusion) shares location, name and the flag itself with the site first-aider and supervisor. Every disclosure is written to an audit log the worker can see. |
| **G3. No disciplinary or productivity use** | No API returns per-worker strain history to the employer. Exports are aggregated with small-cell suppression (< 5). A "productivity" query is not implemented. |
| **G4. Opt-in wearables, never required** | Every worker has an environment-only risk estimate. Signals improve accuracy but are never a condition of work. |
| **G5. Consent is granular and revocable** | Separate toggles for heart rate, location, symptom check-ins. Revoking stops collection immediately and deletes the buffer. |
| **G6. Worker-facing language first** | Warnings speak to the worker in their language before anyone else is told anything. |
| **G7. Models never make the safety call** | Rule tables decide warning levels and red-flag escalation. Models explain, translate and propose schedules; they never downgrade a rule-based warning. |

These rules also map to the separate *Workforce Early Warning* brief's requirement for "clear boundaries against individual employment or disciplinary use".

## Sources

Listed inline. Primary documents read (not redistributed here; available from the publishers): Sharjah OSHJ-CoP-33 v2 (2024); Dubai Municipality guideline v2.0 (2019).
