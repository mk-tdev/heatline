# Scientific basis and claim boundaries

Updated 7 November 2026. Heatline is a worker-first planning and training prototype, demonstrated with synthetic workers. It is not a medical device, a certified exposure monitor, or a UAE compliance assessment.

## What is supported

- Historical ERA5-based gridded weather from Open-Meteo drives the scene. These are estimates near Saadiyat, not measurements at the fictional site.
- The Liljegren implementation is regression-checked against ECMWF thermofeel on 744 hours. This verifies numerical agreement, not site accuracy or physiology.
- NIOSH acclimatisation guidance supports gradual exposure: new workers 20% on day one with increases of no more than 20% daily; experienced returning workers 50/60/80/100%. The current scenario assumes an eight-hour usual exposure day and a conservative 14-day acclimatised classification. These are explicit scenario assumptions, not universal clinical cutoffs.
- Emergency and warning actions are deterministic. Emergency text is fixed; it does not recommend oral fluids to potentially confused workers. Draft translations still require native-speaker and occupational-health review.

## Demonstration policy is not TWL

`packages/rules/src/tables.ts` retains the original configurable scenario bands (28, 30.5, 32.5 °C WBGT) and work/rest defaults solely to reproduce training scenarios. These bands are not a conversion from WBGT to TWL and are not validated ACGIH or NIOSH limits. Passing this policy cannot establish that work is safe or lawful. Pour continuity is a scenario assumption, not a legal exemption.

Abu Dhabi ADOSH-SF CoP 11.0 version 4.0 (July 2024) explicitly calls for TWL assessment and site-specific controls. A real pilot needs measured/validated inputs and a locally reviewed policy. The old reference to the 2013 code through secondary sources is superseded by the official source below. No claim is made that the prototype implements every provision.

## Independent exposure screen

`packages/sim/src/screening.ts` evaluates every complete rolling 60-minute worker window using mean clothing-adjusted WBGT and mean metabolic rate including rest and its location. It compares these to NIOSH's curves:

- Acclimatised REL: `56.7 − 11.5 log10(M)` °C WBGT.
- Unacclimatised RAL: `59.9 − 14.1 log10(M)` °C WBGT.
- M is whole-body metabolic rate in watts; supported input range 115–520 W. Scenario activity estimates are 115/180/300/415 W, not measured workloads.

The screen uses environmental exposure and task estimates, not the teaching physiology or proxy zone table. The first 59 minutes cannot be assessed without previous minute-level exposure. Overlapping windows are not independent observations. Results include pre-decision exposure and appear before running a plan, in replay comparison, and in the August report. Exceedance means further assessment/controls are needed; non-exceedance is not a safety guarantee or UAE compliance certification. Clothing adjustments and workload estimates require review for each actual job.

## Physiology and evaluation

Core temperature, heart rate, hydration deficit and symptom onset are synthetic outputs. Coefficients and calibration targets were chosen for teaching; calibration is not validation. PSI describes simulated strain, not a diagnosis or a validated individual illness predictor. Sensor-free screens suppress precise body temperature and water-deficit values. Wearable values are explicitly simulated.

The observer shares a model family with synthetic truth. This is not an independent clinical benchmark. The August evaluation repeats 31 days × 3 shift windows × 4 policies with one roster, not 93 independent field trials. Standard breaks and emergency detection delays are assumed behaviours.

Metric definitions:

- An episode begins on a transition from PSI <7 to PSI ≥7. Workers already ≥7 at shift start are left-censored and excluded.
- Advance detection requires an amber/red warning 1–60 minutes before onset. Same-minute warnings are separate; they do not count as advance detection. Repeated episodes may share a warning within the preceding hour.
- Lead time is reported only for detected episodes, alongside missed and simultaneous counts.
- False-alert fraction is warning onsets with no PSI ≥7 in the following 60 minutes divided by assessable warning onsets. It is not the conventional false-positive rate. Negative outcomes with insufficient follow-up are excluded and counted. Alerts already at high strain are not early warnings but are not false alerts either.
- A warning for hydration or an exposure cap can be justified even if PSI never reaches 7. The single-endpoint false-alert fraction does not judge every safety action.

`npm run backtest` regenerates the default report and five sensitivity variants across the same 93 shifts each. Variants perturb the truth heat coefficient ±25%, wearable bias −0.3 °C, estimator WBGT −2 °C, and a combined adverse case including +0.2 °C hidden truth offset. These are engineering stress tests, not empirically established error bounds or confidence intervals. No claim of independent validation is made.

## Field behaviour and governance

The browser contains local warning templates and supplies them immediately while model text is pending. API errors/timeouts fall back locally. The simulated outage bypasses guardian and site-brief model calls and hides speech playback. This demonstrates continuity in an already-loaded app, not offline installation or real device integration. Planner and speech depend on connectivity. The separate mobile worker replay can reload offline after its service worker caches the page. It reproduces Anwar’s environment-only 09:40 warning from Racing the midday break. A local outbox stores the self-report while offline. The phone sends a random, shift-specific receipt on reconnect or reopen. The paired dashboard reads the Crew B total. Shift links are bearer capabilities for this synthetic demo. Small counts can permit inference by someone present, and device-level receipts do not establish unique people or verified adherence.

The side-by-side supervisor and worker screens are a synthetic demonstration of role projections. They are not production authentication, access control, consent management or on-device privacy enforcement. No real worker data should be loaded into this demo.

## Before a real pilot

An occupational hygienist must review exposure controls, TWL or WBGT policy, metabolic estimates, clothing and on-site measurements. An occupational clinician must review symptom escalation and messaging. A contractor must verify feasible rotations, water access, cooling capacity and pour procedures. Native speakers must review translations. Independent held-out field observations, consent/access controls and device-level offline testing remain outstanding. Do not substitute prototype tests for these checks.

## Primary sources

- [NIOSH 2016-106](https://www.cdc.gov/niosh/docs/2016-106/pdfs/2016-106.pdf): exposure screening, metabolic workload and acclimatisation.
- [NIOSH workplace recommendations](https://www.cdc.gov/niosh/heat-stress/recommendations/index.html).
- [ADOSH-SF CoP 11.0 v4.0](https://www.adphc.gov.ae/-/media/Project/ADPHC/ADPHC/PDF/OSHAD-SF/Codes-of-Practise/11---Safety-in-the-Heat-v31-English.pdf): Abu Dhabi heat-safety programme requirements.
- [OSHA heat illness first aid](https://www.osha.gov/heat-exposure/illness-first-aid): symptoms, urgent escalation and cooling.
- [ECMWF thermofeel](https://github.com/ecmwf/thermofeel): reference WBGT implementation.
- [Experimental PSI limitation study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8144153/): individual thermal tolerance is not reliably identified by PSI.
