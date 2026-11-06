# Heatline

**The midday break covers two and a half hours. The heat doesn't stop at three.**

A worker-first heat-safety planning and training prototype: a replayable 3D construction site driven by historical Abu Dhabi weather, multilingual worker guidance, supervisor decisions and comparison of simulated outcomes.

Future Health Digital Innovation Challenge · Population Health → Climate-Resilient Worker Health

## Run

Node ≥22.12. `npm install`, then `npm run dev`. Open http://127.0.0.1:5183. The API runs on port 8787. A local `.env` can contain `OPENAI_API_KEY`; use an empty `.env` for rules-only operation. Never commit credentials.

Start with **The afternoon pour**, ask Omar for a plan, inspect the independent exposure screen, and run the simulated plan. Rewind and compare. Open **Evidence** for the August experiment and sensitivity results. Three additional scenarios cover midday-break timing, stand-down decisions and field failures.

## Evidence boundary

Historical gridded weather is real; workers and physiology are synthetic. The configurable demonstration policy is **not a WBGT-to-TWL conversion or UAE compliance certification**. An independent NIOSH exposure screen can flag a plan that passes the demonstration policy. The browser exposes those findings, censoring and missed warnings, and uncertainty stress tests.

- [Scientific basis, primary sources and pilot requirements](docs/scientific-basis.md)
- [Current status](docs/status.md)
- [Historical implementation plan](docs/implementation-plan.md)
- Research: `../research/`

## Verification

`npm run check` runs TypeScript and unit/regression tests. `npm run build` builds the web app. `npm run backtest` regenerates 31 days × 3 windows × 4 policies, plus five sensitivity variants (2,232 simulated shift-policy runs).

The app demonstrates role projections with synthetic data; it does not implement production authentication or worker consent management. Translations, site operations and clinical escalation require professional review before a pilot.
