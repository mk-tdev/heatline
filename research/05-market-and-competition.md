# 05 · Market, competition and path to pilot

Researched 6 November 2026. Market sizes below are indicative; no paid market report was used.

## Who is exposed

- Migrants are reported as about 90% of the UAE workforce, mostly from India, Bangladesh, Pakistan, Nepal, Sri Lanka, Egypt and the Philippines; one undated market snapshot puts construction at ~14% of migrant employment. No current official construction headcount by nationality or language was found. ([Wikipedia overview](https://en.wikipedia.org/wiki/Migrant_workers_in_the_United_Arab_Emirates), [HRW 2006](https://www.hrw.org/reports/2006/uae1106/4.htm))
- **Language implication (inference, to validate with a contractor):** Hindi/Urdu (mutually intelligible spoken), Bengali, Malayalam, Tamil, Nepali, Tagalog, Arabic and English cover most construction crews. MVP target: English, Arabic, Hindi, Urdu, Bengali, Malayalam; others as stretch.

## Existing solutions

| Solution | What it does | Gap Heatline fills |
| --- | --- | --- |
| **Kenzen** wearable (EGA, UAE) | Arm-worn sensor estimating core temperature and heart rate; alerts worker by vibration/app and supervisor via dashboard. EGA scaled from 50 volunteers to 350 in 2023 "Beat the Heat". ([EGA](https://media.ega.ae/ega-extends-use-of-wearable-technology-to-beat-the-heat-in-the-uae-summer/), [T&D World](https://www.tdworld.com/electric-utility-operations/article/21131444/kenzen-launches-body-heat-sensor-system-for-worker-safety)) | Needs a device on every worker. Heatline works without wearables, adds crew-level planning, rules for UAE codes, multilingual coaching, and governance by design |
| **Epicore Biosystems** Connected Hydration patch (with DuPont) | Sweat-based hydration tracking; deployed in industrial settings including the Middle East. ([For Construction Pros](https://www.forconstructionpros.com/workwear/article/22941762/epicore-biosystems-epicore-and-dupont-collaborate-on-wearable-tech-to-combat-heat-stress-and-improve-worker-safety)) | Single signal; Heatline can ingest it as one consented input |
| **AIHA Heat Stress App** (free) | WBGT-based risk assessment from location and workload. ([AIHA](https://www.aiha.org/public-resources/healthierworkplaces/workplace-hazards/thermal-heat-stress-resources-oehs-professionals/thermal-heat-stress-resources-for-employers)) | Static assessment, no crew planning, US-oriented |
| **OSHA-NIOSH Heat Safety Tool** (free) | Heat-index risk level and precautions. | Heat index only; no WBGT/TWL or personal factors |
| **Instrument-based TWL meters** | Measure TWL on site (used for OSHAD compliance). ([Scarlet Tech](https://scarlet-tech.com/heat-stress-and-thermal-work-limit/)) | A number per location; no forecasting, personal factors, or decisions |
| **Abu Dhabi PHC WBGT index** (planned) | Population-level index. | Heatline should consume it, not replace it |

Not found: SlateSafety or other 2025 Middle East construction pilots; searching further is low priority.

**Positioning:** the market has *sensors* and *static calculators*. Nobody connects real conditions, personal risk factors, UAE rules and the supervisor's actual decisions (rotation, pour timing, shade, water) while keeping individual data with the worker. Heatline is the decision layer, and it rehearses those decisions before the summer starts.

## Buyers and why they would pay

| Buyer | Driver |
| --- | --- |
| Main contractors and developers on large sites | Midday-ban fines (AED 5,000/worker), OSHAD CoP 11 heat programme duty, incident and lost-time cost, reputational risk |
| Logistics, ports, utilities, oil & gas services | Same duties; EGA's Kenzen roll-out shows demand in UAE heavy industry |
| Government (PHC, municipalities, inspectors) | Training and inspection support; a shared index and alert channel |
| Insurers / occupational health providers | Fewer heat-related claims; evidence of controls |

**Business model hypothesis (to test, not a claim):** per-site subscription for the planning dashboard and worker app (environment-only tier needs no hardware), plus a "drill" mode sold to safety training providers for pre-summer rehearsal. Wearable integration is an add-on that uses the customer's existing devices.

## Path to pilot

1. **Pre-summer 2027 drill pilot (Mar–May):** one contractor's safety team runs Heatline drills on their own site layout and crew mix; measure decision quality and training feedback.
2. **Summer 2027 shadow pilot (Jun–Sep):** live forecast mode on 1–3 sites with environment-only risk; compare Heatline's warnings with site TWL measurements and incident logs; measure alert lead time, false-alarm rate and adherence to recommended controls.
3. **Consented wearable arm:** volunteers with existing devices (as EGA did), under PDPL-grade consent and an ethics review.

Partners to approach: Abu Dhabi Public Health Centre (Safety in Heat programme), OSHAD, a Tier-1 contractor's HSE team, Hub71 for company formation if pursued.

## Name check

No product named "Heatline" appeared in heat-stress or worker-safety searches (6 Nov 2026). "Heatline" may also be in use as a UK heating/boiler brand (from memory, not verified in this research); run a trademark search before any commercial use. Working name stays **Heatline** for the hackathon.
