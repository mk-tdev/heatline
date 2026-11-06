# Heatline status

Updated 6 November 2026 (GST).

## Decisions

- Challenge switch to **Population Health → Climate-Resilient Worker Health** confirmed accepted (6 Nov).

## M0 spikes

| Task | Status | Evidence |
| --- | --- | --- |
| Monorepo scaffold (npm workspaces, strict TypeScript, Vitest) | Done | `npm run check` |
| Liljegren WBGT TypeScript port | **Done** | Matches ECMWF thermofeel on all 744 August 2025 hours: worst error 0.0000 °C at 4 dp (`tests/climate.test.ts`) |
| Solar position (NOAA) | Done | Reproduces the golden cos(zenith) to 1e-6; azimuth sanity tests |
| Heat index + Dubai flag bands | Done | NWS regression check; band boundaries |
| Claude call with strict tool + structured output, latency at `low`/`medium` | **Blocked: needs `ANTHROPIC_API_KEY`** | — |
| Azure Speech voices for ar-AE, hi-IN, ur-PK, bn-IN/BD, ml-IN, en | **Blocked: needs an Azure Speech key and region** | — |
| 3D asset licences | Candidates listed | `docs/assets-and-licenses.md` |

## Next (M1, 7–8 Nov)

Scenario JSON for Saadiyat Tower; `packages/sim` (zones, shade from the computed sun, crews, physiology with calibration tests); `packages/rules` (midday ban, zone schedule, acclimatisation caps, warning levels, plan validator); golden default run and comparison fixture.
