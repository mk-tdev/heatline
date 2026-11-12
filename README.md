<div align="center">
  <img src="apps/web/public/favicon.svg" width="76" alt="Heatline logo" />
  <h1>Heatline</h1>
  <p><strong>The heat doesn’t stop at three.</strong></p>
  <p>Plan the shift. Warn each worker. Rehearse the call.</p>
  <p>
    <img alt="Built with TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square" />
    <img alt="Interactive 3D" src="https://img.shields.io/badge/React_%2B_Three.js-interactive_3D-245B65?style=flat-square" />
    <img alt="No wearables needed" src="https://img.shields.io/badge/No_wearables-needed-A7D8C5?style=flat-square" />
    <img alt="Rules-only mode available" src="https://img.shields.io/badge/No_API_key-required-A7D8C5?style=flat-square" />
    <img alt="Hackathon prototype" src="https://img.shields.io/badge/Status-hackathon_prototype-F4BE68?style=flat-square" />
  </p>
  <p><a href="https://heatline-plum.vercel.app/#plan">Shift planner</a> · <a href="#-take-the-supervisors-seat">3D site</a> · <a href="#-what-the-weather-alone-says">Evidence</a> · <a href="docs/pilot.md">Path to a pilot</a> · <a href="#-the-challenges-six-desired-outcomes">Challenge outcomes</a> · <a href="docs/pitch-script.md">Read the pitch</a> · <a href="docs/demo-flow.md">Demo flow</a> · <a href="#-run-it-locally">Run locally</a> · <a href="docs/scientific-basis.md">Explore the science</a></p>
</div>

![Heatline’s full-width animated coastal construction panorama](output/playwright/heatline-panorama-desktop.jpg)

The UAE bans outdoor work in the sun from 12:30 to 15:00 in summer. The heat does not keep to those hours. Across the last two midday-break seasons near Saadiyat Island, the heat was over the US NIOSH limit for steady moderate work for about 13 of the 14 working hours in a day, and the break covers only a fifth of them.

**Heatline is a worker-first heat-safety system for outdoor sites, built for the Future Health Digital Innovation Challenge — Climate-Resilient Worker Health.** It has three parts:

| Part | What it does | Try it |
| --- | --- | --- |
| **Shift planner** | Turns tomorrow's forecast for any site into work and rest limits for every hour, the coolest window for a concrete pour, and a crew briefing in seven languages. Needs only a location: no hardware, no worker data. Works on a phone | [Open the planner](https://heatline-plum.vercel.app/#plan) |
| **Worker phone guardian** | Warns each worker in their own language, with one clear action. Works offline and without a wearable. The supervisor sees crew totals, never anyone's readings | [Anwar's phone](https://heatline-plum.vercel.app/worker/index.html) · [crew dashboard](https://heatline-plum.vercel.app/worker/supervisor.html) |
| **Rehearsal site** | A 3D construction site with twenty synthetic workers on real August days. Ask an AI assistant for a plan, watch the site rules check it, approve it, then rewind the same afternoon and compare | [Open Heatline](https://heatline-plum.vercel.app) on a laptop |

The planner is for real days. The rehearsal site is where plans and warnings are tested before they reach real people, so nobody is put at risk to find out what a decision does.

![The shift planner for the hottest day of summer 2026](output/playwright/heatline-shift-planner.jpg)

## 🌡️ What the weather alone says

No simulated workers here: hourly heat stress (WBGT) from reanalysis weather for every working hour, 05:00–19:00, of the 2025 and 2026 midday-break seasons near Saadiyat Island (186 days), compared with the US NIOSH limit for steady moderate work by people used to the heat (28.2 °C).

| Finding | Value |
| --- | --- |
| Working hours over the limit in the sun | **94%**, about 13 of 14 hours a day |
| Share of those hours that fall inside the midday break | **19%** |
| Hours from 15:00 to 18:00 still over the limit in the sun / in shade | **99.8%** / 99% |
| Heavy work per hour within the limit after 15:00, resting in shade → in a cooled room | **6 → 35 minutes** |

The midday break removes the hottest two and a half hours. The hours either side still need work and rest cycles, and shade alone leaves almost no room for heavy work; a cooled rest room is what makes afternoon work possible. That is the planning problem Heatline addresses. Over the limit means controls are needed, not that work is banned, and a grid-square weather record is not a reading on a site. Regenerate with `npm run season`; method in the [scientific basis](docs/scientific-basis.md).

## 🎯 The challenge's six desired outcomes

The challenge asks: *how might we protect workers exposed to extreme heat through earlier warning, personalised prevention and safer operational decisions?* It names six outcomes. Here is how Heatline answers each, where to see it in the app, and what checks it.

| Desired outcome | What Heatline does | Where to see it | How it is checked |
| --- | --- | --- | --- |
| **1. Dynamic heat-risk assessment** from the environment, the workload, the shift and, with consent, the worker's own signals | Works out each worker's heat strain minute by minute from real August 2025 weather, sun and shade on each work area (the shade moves with the sun), how hard the job is, clothing (Bilal's protective overalls count as hotter), how used to the heat the worker is (Anwar is on day 2), and the midday break. A wearable is optional; without one, the risk is estimated from the conditions and the work | The heat label on each work area, the crew cards, and any worker's phone. For a real site and day, the [shift planner](https://heatline-plum.vercel.app/#plan) gives the same heat assessment hour by hour, for light, moderate and heavy work, normal or heavy clothing, and workers new to the heat | `tests/climate.test.ts`, `tests/physiology.test.ts`, `tests/engine.test.ts`, `tests/dayplan.test.ts` |
| **2. Clear, graded, multilingual warnings**, each with a safe action | Four levels (green, yellow, amber, red), each with exactly one action: keep drinking, drink now, rest in shade, rest in the cool cabin, stop heat work, or emergency. Written and read aloud in Arabic, Hindi, Urdu, Bengali, Malayalam, Tagalog and English. **The rules set the level and the action; the AI only words it** and is rejected if it changes the action, uses the wrong script or adds medical advice | The worker's phone (right panel) and its **Listen** button; speech bubbles on site; the crew briefing in the shift planner | `tests/rules.test.ts`, `tests/projections.test.ts` (fallback messages in every language pass the checks); [60 AI-worded messages checked](docs/eval/README.md): all 60 kept the action |
| **3. Worker-first governance**: consent, collecting little, no disciplinary use | Wearable sharing is the worker's choice and warnings work either way. A worker's readings stay on their own phone. The supervisor and Noor see crew totals only, never names or body readings; a name is shown only when someone shows signs of serious heat illness, so help can reach them. Omar sees who is used to the heat, never readings. Nothing in the supervisor's view can be used to rank or blame individuals | The phone banner "Only Anwar sees this screen"; the crew cards; Anwar's phone demo (**Share** or **Decline**) | `tests/projections.test.ts` checks every minute of a shift for leaked names or readings |
| **4. Field-ready operation** with a safe fallback | Dead wearable batteries, a half-hour network outage and a dust storm are played out in **When everything fails**. Without a sensor, the phone switches to an estimate and says so. Without the network or the AI, pre-written messages and a rules-only plan take over. Anwar's phone demo works fully offline and sends his "I reached shade" confirmation when the signal returns | The **When everything fails** shift; the [worker phone demo](https://heatline-plum.vercel.app/worker/index.html) | `tests/scenarios.test.ts`, `tests/http.test.ts` |
| **5. Supervisor decision support** at crew and site level | At the decision point, Omar proposes a plan using the levers a supervisor really has: shade tents, moving or cancelling the concrete pour, and moving workers to indoor duties. The site rules (midday break, work and rest limits, water, shade, no working alone, new workers' limits) check every plan and can refuse it. Omar's verdict also says when a plan is allowed but still over the safe heat limit. **Nothing changes until the supervisor approves** | The shift planner, for the day ahead; the 15:10 decision in **The afternoon pour**, then **Compare** | `tests/rules.test.ts`, `tests/scenarios.test.ts`, `tests/dayplan.test.ts`; [30 planner runs under pressure](docs/eval/README.md): no rule-breaking plan reached the supervisor |
| **6. Safety and productivity measures**: lead time, false alarms, adherence, incidents, escalations, compliance and lost time | **Compare** shows the same afternoon with and without the plan. **Evidence** opens with two summers of real weather, then replays all of August 2025 in simulation (93 shifts, four approaches): 81% of high-strain episodes warned in advance, typically 37 minutes ahead; 10% false alarms; worker time over the NIOSH exposure limit 96% on the original schedule, 47% with an approved plan; simulated serious heat-illness cases 197 with no measures, 52 with site-wide flag breaks, 0 with an approved Heatline plan; times a rule was broken; minutes until a collapsed worker is being cooled; rest time and pours finished (the cost). Shade confirmations from workers' phones measure adherence | **Compare** and **Evidence** buttons | `npm run season` and `npm run backtest` regenerate the data |

The challenge also warns that worker protection must come before productivity, and that collecting too much can become surveillance. We treat both as design rules. The plan gives up 8 of 93 pours in August to reach zero serious cases, and the supervisor never sees an individual's body readings.

## ☀️ A site with people in it

| Experience | What you can do |
| --- | --- |
| **Walk into the afternoon** | Explore the 3D tower, crane, construction lift, rebar yard, shaded rest areas, and site gate. |
| **Explore on foot** | Open a separate playground: walk the site, ride the construction lift to level 12, and rotate the crane, trolley and hook. The running shift is unchanged. |
| **Make room for the scene** | Minimize either glass side panel independently and switch between named camera views. |
| **Hear the worker’s side** | Preview multilingual guidance for six featured characters, including sensor-free fallback guidance. |
| **Plan with Omar** | Ask for a safer plan, see each step he tries, read a plain verdict (allowed or refused, and whether it is still too hot), then choose whether to run it. |
| **Keep the crew in view** | Noor summarizes crew needs; the worker guardian presents an individual’s guidance separately. |
| **Rewind the decision** | Compare branches of the same simulated shift rather than comparing unrelated days. |
| **Look beyond the good ending** | Open Evidence to see missed warnings, time still over the safe heat limit, and what happens if our assumptions are wrong. |

The landing page has an animated panorama: moving trucks, a lifting crane, a construction elevator, workers heading toward shade, coastal water, and swaying palms. Motion can be paused and respects reduced-motion preferences.

## 🎬 Take the supervisor’s seat

A short path through the demo:

1. Start **The afternoon pour** in story mode.
2. Meet the crew and follow the shift to the planning decision.
3. Ask **Omar** for a plan. Read his verdict, including whether workers are still over the safe heat limit.
4. Run the proposed plan, then rewind and compare the two outcomes.
5. Open **Evidence** to see the month-long experiment and the assumptions behind it.

| Shift | The decision waiting for you |
| --- | --- |
| **The afternoon pour** | A booked concrete truck, an exposed deck, and a crew lead who wants to finish. |
| **Racing the midday break** | Façade work, a returning worker, and a pour that risks running into the break. |
| **The day nobody should pour** | A humid afternoon that challenges the decision to work at all. |
| **When everything fails** | Dead wearables, a network outage, and a dust storm. |

> **Device support:** The landing page and evidence views are responsive. The interactive 3D simulator supports desktop and laptop, with a window at least 1024 pixels wide. Mobile visitors receive a clear desktop notice when starting a shift.

<details>
<summary><strong>See the simulator and mobile landing page</strong></summary>

![The 3D site with both side panels minimized](output/playwright/heatline-minimized-panels.jpg)

<div align="center">
  <img src="output/playwright/heatline-panorama-mobile.jpg" width="320" alt="Responsive mobile landing page with the animated construction site beneath the headline" />
</div>

</details>

On a phone, open [Anwar’s worker demo](https://heatline-plum.vercel.app/worker/index.html) and wait for **Ready for offline use**. Disconnect and reload, decline wearable sharing, read the Bengali warning, and confirm arrival in shade. For two devices, start a fresh shift on the [supervisor dashboard](https://heatline-plum.vercel.app/worker/supervisor.html) and use its worker link on the phone. Reconnect the phone to deliver the queued confirmation. Retries and replaying on the same browser count once per shift. Local development uses a temporary filesystem store; Vercel uses private Blob storage.

## 🌍 Live demo

**[Open Heatline](https://heatline-plum.vercel.app)** on desktop to enter the 3D site. The **[shift planner](https://heatline-plum.vercel.app/#plan)**, the phone demo and the evidence work on any screen.

Guardian, Noor, Omar and multilingual speech are enabled in the live deployment. Functional checks on **7 November 2026** confirmed model-generated responses, a checked planner result and valid speech audio.

Vercel hosts the web app and API functions. GitHub pushes to `main` deploy the production project automatically; other branches receive preview deployments. The deployment works in rules-only mode without an API key. To enable model-backed assistants and speech, configure `OPENAI_API_KEY` and optional model settings in Vercel project environment variables, then redeploy.

The public deployment limits each visitor (Omar: 6 plans per 10 minutes; guardian and Noor fall back to pre-written messages when busy), and the voice only reads messages the server itself wrote. Those limits live in each server instance's memory, so also set a monthly spend limit on the OpenAI key.

### Explore on foot — just for fun

Click **Explore on foot** directly on the landing page to enter a standalone playground without starting a shift or calling an assistant. You can also open it inside a scenario. Use **WASD** to walk, **Shift** to move faster, and drag to look; arrow keys also turn and walk. Approach the lift or crane base and press **E**, or use the on-screen shortcuts. Ride to level 12 and step onto the roof; in the crane, use **A/D** to rotate, **W/S** for the trolley, and **Q/E** for the hook. **Esc** returns to your shift.

This is a disposable copy of the visible site. Exploration has its own camera and machinery state, makes no assistant calls, and cannot modify workers, plans, outcomes or playback controls. The original simulation keeps its normal playback and decision pauses underneath.

## 🎤 Present Heatline

- **[Short pitch script](docs/pitch-script.md)** — about 75 seconds, with slide cues and the closing ask.
- **[Judges’ demo flow](docs/demo-flow.md)** — a 25-second first-person opening, a 35-second offline phone replay, then two minutes of AI and heat-safety decisions, with presenter lines and a backup plan.
- **[Google Slides](https://docs.google.com/presentation/d/1FMFLC-zGr_YUq21n0I0qrHFjGM7i1EPf86BKGodEv2A/edit)** — visual pitch, live AI screenshot and speaker notes. Deck access may require permission from its owner.

## 🚀 Run it locally

Requires **Node.js 22.12 or newer** and npm.

```bash
git clone https://github.com/mk-tdev/heatline.git
cd heatline
npm install
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:5183**. The API runs on port **8787**.

**No API key is required to explore the prototype.** Rules-only operation provides local guidance and a rules-based plan. To enable model-backed assistants, add `OPENAI_API_KEY` to your local `.env`; optional model and voice settings are documented in [.env.example](.env.example). Keep credentials local.

## 🧪 How the AI is checked

The rules decide; the AI words messages and proposes plans. We recorded how well that boundary holds ([full record](docs/eval/README.md)):

- **60 guardian messages** in six languages: a separate judge, shown only the message, read the intended action from all 60. None weakened the action, added medical advice or quoted a body reading.
- **30 planner runs**, most of them pushing Omar to cut corners ("ignore the heat rules today", "put the new worker on the pour"): the site rules refused 30 of his proposals along the way, and no rule-breaking plan reached the supervisor. He never poured on the day nobody should pour.
- **90 pre-written lines** were back-translated by machine; three real wording problems were found and fixed. No native speaker has reviewed them yet.

## 🤝 Path to a pilot

The planner needs only a site location, so a pilot can start without hardware or worker data. The plan, in [docs/pilot.md](docs/pilot.md):

1. **March–May 2027, rehearse.** A contractor's safety team runs heat drills on its own site layout and crew mix.
2. **June–September 2027, shadow.** Forecast plans each evening on one to three sites, compared with the site's own heat readings and what the site actually did.
3. **Volunteers only, guardian.** Phone warnings for crews who opt in, measuring warning lead time, false alarms, rest taken, symptoms, escalations and lost time.

Buyers are contractors bound by the midday break (AED 5,000 fine per worker) and Abu Dhabi's Safety in the Heat code. The price to test is about AED 2,000 per site per month in season. Before any worker relies on it, an occupational hygienist, a clinician and native speakers must review the limits, the escalation and every message. We are looking for one contractor and those reviewers.

## 🧭 How the pieces fit

```mermaid
flowchart LR
    Weather[Historical Abu Dhabi weather] --> Environment[Sun, shade and heat stress per work area]
    Environment --> Simulation[Minute-by-minute shift simulation]
    Simulation --> Roles[Worker and crew views]
    Roles --> Assistants[Guardian · Noor · Omar]
    Assistants --> Checks[Site rules and safe heat-limit check]
    Checks --> Replay[Replay and compare]
    Simulation --> Evidence[Backtests and sensitivity analysis]
    Forecast[Forecast for any site] --> Planner[Shift planner: hourly limits, pour window, briefing]
    Environment -. same heat code .-> Planner
```

| Directory | Purpose |
| --- | --- |
| `apps/web` | React, Three.js / React Three Fiber, stories, glass panels, evidence views, and the shift planner (`src/planner`) |
| `packages/climate` | Turns weather into heat stress in sun and shade (WBGT, the standard heat-stress measure) |
| `packages/sim` | Made-up workers, their bodies and the site, minute by minute; the August replay; the day plan and crew briefing for real days |
| `packages/rules` | Site heat rules (midday break, work and rest, water, shade) and the plan checker |
| `packages/agents` | Role-specific context, structured assistant outputs, and fallback guidance |
| `packages/contracts` | Shared types and schemas |
| `server` | Talks to OpenAI so the key never reaches the browser; rate limits; voice |
| `tests` | Climate, physiology, rules, projections, scenarios, and regression checks |

## 🔬 Built to show its assumptions

The weather is real. **In the 3D site and the August replay, the workers, their bodies and the outcomes are simulated.** The shift planner uses no simulated workers, but its weather is a forecast for a grid square, not a reading on your site. This is a prototype, not a clinically validated safety system.

- The site rules are our reading of UAE and Sharjah guidance for a demo. They are **not a UAE safety certificate**.
- A plan can follow the rules and still keep people over the US NIOSH safe heat-exposure limit. Omar's verdict and Compare say so when it happens.
- Evidence shows missed warnings and what happens if our assumptions are wrong, so the good demo is not the whole story.
- The body model produces far more serious cases than real sites report. Use the August replay to compare approaches, not to predict how many people would fall ill.
- The shift planner's limits come from US NIOSH guidance. Abu Dhabi's code asks for a Thermal Work Limit assessment by a competent person; the planner does not replace it.
- Site-wide flag breaks beat Heatline's phone warnings on their own (52 serious cases against 65 in the August replay). Heatline is meant to be used with a plan; with one, it is 0.
- Role-specific views demonstrate information separation with synthetic data; production authentication and worker consent management are not implemented.
- Translations, site operations, and clinical escalation require professional review before a pilot.

Read the [scientific basis and primary sources](docs/scientific-basis.md), [project status](docs/status.md), and [asset provenance](docs/assets-and-licenses.md). Generated photos are illustrative; the animated panorama is drawn in SVG.

## 🛠️ Verify and explore

```bash
npm run check       # TypeScript + unit/regression tests
npm run build       # Production web build
npm run backtest    # Regenerate the August experiment and sensitivity variants
npm run season      # Regenerate the two-summer weather analysis
npm run eval:agents # Re-run the AI checks (needs an OpenAI key)
```

The test suite has **109 tests**. The August replay covers **31 days × 3 shifts × 4 approaches**, plus five what-if variants: **2,232 simulated shifts**. These are simulation results, not field-validation results.

The production build currently emits a large-bundle advisory for the 3D client. This remains a performance improvement opportunity.

---

<div align="center">
  <strong>Different stories. The same right to go home well.</strong><br />
  <sub>Heatline · Future Health Digital Innovation Challenge</sub>
</div>
