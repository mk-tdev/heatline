# Heatline

**The midday break covers two and a half hours. The heat doesn't stop at three.**

Heatline is a 3D model of a construction site in Abu Dhabi on a hot August day. It uses real weather from August 2025 to work out how much heat each worker is taking. Every worker gets a warning on their phone in their own language. The site supervisor sees how each crew is doing, asks an assistant for a safer plan, approves it, and then watches what that decision changes.

Built for the Future Health Digital Innovation Challenge, track **Population Health → Climate-Resilient Worker Health**.

## The problem

In the UAE, outdoor work in direct sun is banned from 12:30 to 15:00 between 15 June and 15 September. But in August 2025 on Saadiyat Island, heat-stress levels stayed high well after 15:00, often until early evening. The break protects workers for part of the day. Heatline is about the rest of it.

## What you can do in the app

1. **Pick a scenario** on the opening screen. Each one is a real day with a real decision:

   | Scenario | Date | The decision |
   | --- | --- | --- |
   | The afternoon pour | 19 Aug 2025, 15:00–18:00 | The concrete truck is booked for 15:30. Can the crew pour safely? |
   | Racing the midday break | 12 Aug 2025, 09:30–13:00 | Can the stair-core pour finish before the 12:30 ban? |
   | The day nobody should pour | 1 Aug 2025, 15:00–18:00 | The most humid afternoon of the month. The right answer is to send the truck back. |
   | When everything fails | 26 Aug 2025, 15:00–18:00 | Phone batteries die, the network drops for half an hour and a dust storm rolls in. |

2. **Play the story** to be walked through the shift, or **Explore** to move freely through time.
3. **Watch the site.** Workers move between the deck, the scaffold, the rebar yard, the shade shelter and the cool cabins. They talk to each other in Arabic, Malayalam, Hindi, Urdu, Bengali and Tagalog, with English shown underneath.
4. **Open a worker's phone** on the right. It shows only that worker's own warning and readings. Press **Listen** to hear the message read aloud.
5. **Make the decision.** Ask Omar, the planning assistant, for a plan: shade tents, a later or earlier pour, or sending someone home. Every plan is checked against UAE heat rules before you can approve it.
6. **Compare** the original day with your plan side by side: how many people got seriously ill, how much work got done, and when.
7. **Evidence** shows how the warnings would have performed over every working day of August 2025.

## The people

- **Ahmed**, the foreman, runs the site.
- **Suresh**, a crew lead who doesn't like to stop.
- **Anwar**, on his second day and not yet used to the heat.
- **Ravi**, **Bilal** and **Joel**, each with their own situation: a dying phone battery, a heavy protective suit, or just back from leave.
- **Noor**, an assistant that writes the safety brief for the supervisor.
- **Omar**, an assistant that proposes plans.

## How the warnings work

- **The rules decide; the AI only explains.** Warning levels and actions come from fixed rules based on UAE and international heat-stress guidance. The AI writes the message in the worker's language but cannot change what the worker is told to do.
- **Privacy.** The supervisor sees crew totals, not anyone's body readings. A worker's name is shown to the supervisor only if that worker shows signs of serious heat illness. The planning assistant never sees personal readings.
- **It works without the internet.** If the AI or the network is down, the phones fall back to messages written in advance in every language.

## Results from August 2025

We replayed every day of August 2025, three shift windows each (93 shifts):

| Approach | Cases of serious heat illness | Concrete pours finished |
| --- | --- | --- |
| No heat measures | 197 | 93 of 93 |
| Site-wide flag breaks (common practice today) | 52 | 93 of 93 |
| Heatline warnings only | 65 | 93 of 93 |
| Heatline warnings and an approved plan | **0** | 85 of 93 |

On the hottest days the safe choice is to pour later or not at all, which is why 8 pours did not happen.

- Warnings caught **86%** of heat-strain episodes, a median of **36 minutes** before they happened.
- **10%** of warnings were false alarms.

These numbers come from a simplified model of the body, not from real patients. Heatline is a prototype, not a medical device.

## Run it on your machine

You need Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env        # add your OpenAI key (optional)
npm run dev
```

Open http://localhost:5183.

Without an OpenAI key the app still works. Warnings use the pre-written messages, plans are built by the rules alone, and the Listen button is hidden.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs the tests |
| `npm run typecheck` | Checks the code for type errors |
| `npm run backtest` | Re-runs the August 2025 replay and writes `data/backtest/august-2025.json` |
| `npm run build` | Builds the web app for hosting |

## What's in this repository

| Folder | Contents |
| --- | --- |
| `apps/web` | The web app: 3D site, phone, supervisor panels |
| `server` | Small server that talks to OpenAI, so the key never reaches the browser |
| `packages/climate` | Heat-stress calculations from weather data |
| `packages/rules` | UAE heat rules, warning levels and the plan checker |
| `packages/sim` | Simulates each worker minute by minute; the scenarios and the August replay |
| `packages/agents` | The worker guardian, Noor and Omar, plus what each is allowed to see |
| `data` | August 2025 weather, scenario data and replay results |
| `research` | Background research, source documents and the original weather analysis |
| `docs` | Implementation plan, progress notes and licences for third-party work |
| `tests` | Automated tests |

## Limits

- The translations are drafts and still need checking by native speakers.
- Spoken Bengali and Malayalam have not yet been checked by ear.
- The body model is a simplified teaching model calibrated to published studies. It is not clinical advice.

## Sources and licences

Weather comes from Open-Meteo (ERA5 reanalysis). The heat-stress calculation is adapted from ECMWF thermofeel (Apache-2.0); see `NOTICE`. Rules come from the UAE midday break regulation, the Sharjah heat-safety code of practice and the Dubai Municipality heat-stress guidelines. See `research/` and `docs/assets-and-licenses.md` for full references.
