# Path to a pilot

Written 11 November 2026. Everything here is a plan to be tested with a partner, not a result.

## What would be deployed

| Part | What it needs on site | State today |
| --- | --- | --- |
| **Shift planner** | A site location. Nothing else: no hardware, no worker data | Working. Forecast and past days for any coordinates, at `/#plan` |
| **Worker phone guardian** | Workers' own phones, or one shared phone per crew. Works offline once opened | Working demo for one worker and one stored warning; not yet driven by the day's plan |
| **Crew dashboard** | The supervisor's phone or laptop | Working demo of one crew count; no sign-in yet |
| **Rehearsal site** | A laptop, for the safety team before the season | Working. Four scenarios on one fictional site |
| **Wearables** | Optional. Only for workers who choose to share, on devices the contractor already has | Simulated only |

## Who would use it and why they would pay

| Buyer | Why |
| --- | --- |
| Main contractors and developers | The midday-break fine is AED 5,000 per worker, up to AED 50,000. Abu Dhabi's Safety in the Heat code requires a heat programme. Lost time and incidents cost more than either |
| Logistics, ports, utilities, industrial sites | The same duties. Heavy industry in the UAE already pays for heat wearables |
| Regulators and public health bodies | A shared way to brief sites before a hot day, and training for inspectors |
| Occupational health providers and insurers | Evidence that controls were planned and followed |

**Pricing to test.** About AED 2,000 per site per month for the planner, the crew phones and the dashboard, sold for the May–October season: roughly AED 12,000 per site per season. That is less than the fine for three workers found in the sun during the break. The rehearsal site would be sold separately to safety-training providers. Wearable integration would be an add-on using the customer's devices. These numbers are a starting point for a conversation with a contractor; we have not tested them.

**Running cost.** The planner runs in the browser on free weather data. Model calls are only for wording messages and proposing plans, with pre-written fallbacks, so cost per site is small and capped.

## The pilot

| Stage | When | What happens | What we measure |
| --- | --- | --- | --- |
| **1. Rehearse** | March – May 2027 | One contractor's safety team runs heat drills on its own site layout and crew mix | Do supervisors change their decisions? Do they find the plans workable? |
| **2. Shadow** | June – September 2027 | Forecast plans each evening for one to three sites. Supervisors see them; nobody is required to follow them | Forecast against the site's own heat readings. Plan against what the site actually did |
| **3. Guardian** | From July 2027, volunteers only | Phone warnings for crews who opt in, with no wearable. A small wearable group later, under ethics review | Warning lead time, false alarms, whether rest was taken, symptoms reported, escalations, work time lost |

The measures in stage 3 are the ones the challenge names: alert lead time, false-alarm rate, adherence to controls, heat-related symptoms or incidents, emergency escalations, compliance and lost work time.

## What must be true before any real worker relies on it

1. An occupational hygienist has reviewed the limits, the workload estimates and the clothing adjustments, and compared the forecast with measurements on the site.
2. An occupational clinician has reviewed the symptom escalation and every message.
3. Native speakers have checked every translation, written and spoken. Today they are drafts, cross-checked only by machine back-translation ([record](eval/README.md)).
4. Sign-in, consent and access control exist. Today the role separation is shown with synthetic data only.
5. The contractor has confirmed that the rotations, water points and cooled rest rooms the plans assume are really there.
6. Hosting and data handling meet UAE data-protection law for health data, including in-country hosting if required.

## Partners we are looking for

- One Tier-1 contractor's safety team, for stages 1 and 2.
- An occupational hygienist and an occupational-health clinician.
- Abu Dhabi Public Health Centre's Safety in Heat programme and OSHAD, for alignment with the code.
- Native speakers of Arabic, Hindi, Urdu, Bengali, Malayalam and Tagalog.
