# 02 · Heat-stress science and standards

> Review update, 7 November 2026: the prototype uses explicitly labelled demonstration WBGT bands, not measured TWL. An independent NIOSH rolling-hour exposure screen now reports exceedances. See [current scientific basis](../Heatline/docs/scientific-basis.md) for formulas, primary sources, corrected evaluation and limitations. No prototype plan is certified safe or UAE-compliant.

Researched 6 November 2026. This is the evidence base for Heatline's physiology and warning engine. It is **not** clinical guidance; values used in the build must cite the row they come from.

## The indices and what each is good for

| Index | Inputs | Used by | Heatline use |
| --- | --- | --- | --- |
| **Heat index (HI)** | Air temperature, relative humidity | Dubai Municipality guideline; OSHA-NIOSH app | Quick public-facing band; shown to workers as "feels like" |
| **WBGT** (wet-bulb globe temperature) | Air, natural wet-bulb, globe temperature (radiant heat), wind | ACGIH TLVs, ISO 7243, NIOSH, Abu Dhabi PHC's planned index | Primary environmental exposure, computed from weather with the Liljegren model |
| **TWL** (thermal work limit, W/m²) | Dry bulb, wet bulb, globe, wind | Abu Dhabi OSHAD CoP 11.0, Sharjah OSHJ CoP 33 | The **regulatory zone** shown on site; drives rest/water schedule |
| **PSI** (physiological strain index, 0–10) | Core temperature, heart rate | Research, wearable vendors | Per-worker strain, from simulated or consented signals |

### WBGT

- Outdoor WBGT = 0.7·T_nw + 0.2·T_g + 0.1·T_a (natural wet bulb, globe, air). Indoor/shade drops the air term. ([pythermalcomfort source](https://pythermalcomfort.readthedocs.io/en/stable/_modules/pythermalcomfort/models/wbgt.html), [thermofeel docs](https://thermofeel.readthedocs.io/en/stable/examples/))
- **Liljegren et al. (2008)** estimates WBGT from standard weather data (temperature, humidity, pressure, wind, solar radiation, direct-beam fraction, solar zenith). Implementations: ECMWF **thermofeel** `calculate_wbgt_liljegren` (used operationally by KNMI), and **lwbgt** (C kernel from Argonne's code, redistribution requires keeping the NOTICE). Verified by running thermofeel 2.3.0 on our data ([03](03-abu-dhabi-heat-data.md)).

### ACGIH TLV / Action Limit (screening)

Screening table by metabolic category (light, moderate, heavy, very heavy) and percent of each hour worked; separate columns for **acclimatised (TLV)** and **unacclimatised (Action Limit)**. One reproduced version gives, for 75–100% work: TLV 31.0 / 28.0 °C WBGT (light / moderate), Action Limit 28.0 / 25.0. **Versions disagree by ~0.2–1 °C**; verify against the current ACGIH booklet before quoting numbers in the product. ([Cal/OSHA TLV PDF](https://www.dir.ca.gov/dosh/doshreg/Heat-illness-prevention-indoors/heat-tlv.pdf), [USF screening sheet](https://health.usf.edu/-/media/v3/usf-health/COPH/Thomas-Bernard/Heat-Stress/HSSTLVScreen22.ashx))

Clothing adjustment factors are added to measured WBGT: work clothes / woven coveralls 0 °C, SMS polypropylene +0.5, polyolefin +1, double-layer woven +3. Not additive across layers. (same sources)

### TWL zones — the UAE regulatory frame

Primary source read: **Sharjah OSHJ-CoP-33 "Safety in Heat", Version 2 Rev 0, July 2024** (read in full; available from Sharjah OSHJ). The official [Abu Dhabi ADOSH-SF CoP 11.0 v4.0, July 2024](https://www.adphc.gov.ae/-/media/Project/ADPHC/ADPHC/PDF/OSHAD-SF/Codes-of-Practise/11---Safety-in-the-Heat-v31-English.pdf) was retrieved during the 7 November review; it explicitly requires environmental assessment using TWL and a site-specific heat-stress programme.

TWL is "the maximum rate at which heat can be lost to the environment" in W/m², assuming hydrated, acclimatised, self-paced workers. Computed from dry bulb, wet bulb, globe temperature and wind.

| TWL (W/m²) | Zone | Interventions | Water per hour | Work/rest |
| --- | --- | --- | --- | --- |
| **< 115** | High risk (withdrawal) | No ordinary work; essential maintenance or rescue only | 1.5 L | Self-paced light: 45 work / 15 rest. Self-paced heavy: 20 work / 40 rest |
| **115–140** | Medium risk (buffer) | Practical controls (shade, ventilation); no one works alone; *unacclimatised* workers not allowed* | 1.2 L | Continuous self-paced light; heavy: 40 work / 20 rest |
| **140–220** | Low risk (acclimatisation) | No limit on self-paced work for educated workers; acclimatised may work but not alone | 1.0 L | Continuous self-paced light and heavy |
| **> 220** | Unrestricted | No thermal limits | 0.5 L | Continuous paced light and heavy |

\* The PDF row reads "Acclimatised employees not allowed to work", which contradicts the zone logic and other sources; it is almost certainly a typo for *unacclimatised*. Flag in product docs.

Definitions from the same code: *unacclimatised* = new employees or anyone off work for more than 14 days; *self-paced* = the worker may adjust work rate; *light* = sitting/standing/light arm work; *heavy* = carrying, climbing, lifting, pushing.

Secondary sources give slightly different boundaries (116/139, 219) and a 2022 study questioned TWL's discrimination for some clothing ensembles ([Wikipedia overview](https://en.wikipedia.org/wiki/Thermal_work_limit), [Columbia Weather TWL note](https://columbiaweather.com/resources/thermal-work-limit.pdf), [National](https://thenationalnews.com/uae/what-is-the-thermal-work-limit-1.394827)). Foundational paper: Brake & Bates (2002), *Applied Occupational and Environmental Hygiene*.

**Build note:** computing TWL needs the Brake & Bates heat-balance model. If the full model cannot be implemented and tested in time, Heatline shows TWL zones only when a TWL value is supplied (e.g., from a site instrument) and otherwise uses WBGT, labelled as such. Never present an approximated TWL as compliant measurement.

### Heat index bands — Dubai Municipality

Dubai Municipality *Technical Guidelines for Management of Heat Stress at Work*. Text read: **v2.0 (8 Oct 2019)**; a v3.0 (9 May 2024) exists at [dm.gov.ae](https://www.dm.gov.ae/wp-content/uploads/2024/07/DM-HSD-GU38-MHSW2_Technical-Guidelines-for-Management-of-Heat-Stress-at-Work_V3.pdf) but blocked automated download.

| Heat index | Risk | Control approach | Flag colour |
| --- | --- | --- | --- |
| ≤ 34 °C | Low (caution) | Basic heat safety and planning | Green |
| 35–39 °C | Moderate | Planned controls, awareness | Yellow |
| 40–45 °C | High | Additional controls | Amber |
| ≥ 46 °C | Very high | Enhanced controls | Red |

The guideline recommends communicating changes "through telecommunication/mobile messaging or using flag system", separate measurement per area where conditions differ, rest in cool places, and core temperature ≤ 38.5 °C (acclimatised) / ≤ 38 °C (unacclimatised; the text repeats "acclimatized", another typo). Hydration example: a glass of water every hour and electrolyte after every two glasses as a minimum; checklist variant "1 cup every 20 min".

## Acclimatisation

- **NIOSH (2016 criteria document):** new workers — no more than **20%** of usual heat-exposure duration on day 1, and no more than 20% more each day. Workers with previous experience: **50% / 60% / 80% / 100%** on days 1–4. Full acclimatisation takes 7–14 days. ([NIOSH bulletin](https://www.cdc.gov/niosh/bulletin/2016/extreme-heat.html), [OSHA new workers](https://www.osha.gov/heat-exposure/protecting-new-workers); criteria doc 2016-106 not read directly.)
- **UAE codes:** acclimatisation about 7–8 days minimum, up to 14+ (Dubai v2.0); absence >14 days resets status (Sharjah CoP 33).
- Heatline models each worker's acclimatisation day count and enforces exposure caps; it is one of the risk factors invisible to a supervisor today.

## Physiological strain

**PSI (Moran, Shitzer & Pandolf, 1998):**
`PSI = 5·(Tc − Tc0)/(39.5 − Tc0) + 5·(HR − HR0)/(180 − HR0)`, baselines ~37.0 °C and ~70 bpm; 0–10 scale. Bands used in a US briefing: <5 low, 5–6 moderate, 7–8 high, 9–10 very high, >10 extreme. ([EPA-hosted Buller briefing](https://nrt.response.epa.gov/sites/58/files/RT%20PSI%20Assessment%20-%20M.%20Buller.pdf), [typeset copy of Moran 1998](https://typeset.io/pdf/a-physiological-strain-index-to-evaluate-heat-stress-4zrriemcuu.pdf))

**Core temperature from heart rate:** Buller's Kalman-filter estimator predicts core temperature from heart-rate series; it is the basis for most non-invasive wearables. Equations and validation were not retrieved — cite as a direction, not a component, unless the paper is obtained.

Evidence caveat: some studies question PSI's ability to identify at-risk individuals ([Coventry 2016](https://pureportal.coventry.ac.uk/en/publications/the-accuracy-of-the-physiological-heat-strain-index-to-identify-i/)). Heatline uses PSI as a simulated signal, never as a diagnosis.

## Heat illness: what workers and supervisors must recognise

From OSHA's current first-aid guidance ([OSHA](https://www.osha.gov/heat-exposure/illness-first-aid), [OSHA/NIOSH infosheet](https://elcosh.org/document/1262/d001135/Protecting%2BWorkers%2Bfrom%2BHeat%2BIllness%253A%2BOSHANIOSH%2BInfosheet.html)):

| Condition | Signs | Action |
| --- | --- | --- |
| **Heat stroke** (emergency) | Confusion, slurred speech, loss of consciousness, seizures, very high body temperature, rapid heart rate; skin may be hot and dry **or** sweating heavily | Call emergency services (UAE: 998 ambulance). Cool immediately: shade/AC, remove outer layers, cold wet towels or ice at head, neck, armpits, groin; cold-water immersion is fastest. Someone stays with the worker |
| Heat exhaustion | Fatigue, irritability, thirst, nausea/vomiting, dizziness, heavy sweating | Stop work, cool, drink, medical evaluation |
| Heat cramps / rash / syncope | Cramps, rash, fainting | Rest, cool, fluids; evaluate fainting |

Design rule: **"stopped sweating" is not a reliable sign** (older guidance said so; current guidance does not). Heatline's red-flag prompt asks about confusion and speech first. Any red flag escalates to a human immediately and is never handled by a model alone.

## The burden: why this matters in the Gulf

- **Pradhan et al., *Cardiology* 2019** (Nepali migrant workers in Qatar, 2009–2017): cardiovascular causes were 22% of deaths in the cool season and **58% in the hot season**, against ~15% expected for ages 25–35; deaths correlated with afternoon WBGT; the authors estimated **~200 of 571** cardiovascular deaths could have been prevented by effective heat protection, and most workers were exposed to WBGT > 31 °C on hot-month working days. Cause of death was poorly recorded, so heat attribution is inferred. ([PubMed 31302648](https://www.pubmed.gov/31302648/), [ANU](https://researchportalplus.anu.edu.au/en/publications/heat-stress-impacts-on-cardiac-mortality-in-nepali-migrant-worker/))
- Our own analysis shows August 2025 working-hour WBGT near Saadiyat above 31 °C on every day from 12:00–18:00 ([03](03-abu-dhabi-heat-data.md)).

## Implications for Heatline's engine

1. **Environment:** Liljegren WBGT from hourly weather (sun and shade variants), plus heat index for worker-facing language. TWL only from a supplied measurement or a tested implementation.
2. **Worker model:** metabolic rate by task (light/moderate/heavy), clothing factor, acclimatisation day, hydration debt, cumulative exposure, rest location (shade vs cooled room) → simulated core temperature and heart rate → PSI. Coefficients documented and labelled as a simulation.
3. **Rules engine (non-negotiable, in code):** midday ban window and exemptions, TWL/WBGT work-rest and water schedule, unacclimatised exposure caps, no lone working in buffer zone, red-flag escalation, no individual data to supervisors.
4. **Warnings:** four levels aligned to the Dubai flag colours (green/yellow/amber/red) so they match what UAE sites already use.

## Sources

Listed inline. Primary documents read: Sharjah OSHJ-CoP-33 v2 (2024); Dubai Municipality guideline v2.0 (2019). They are not redistributed in this repository.
