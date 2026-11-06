# Assets and licences

Every third-party asset, dataset and library used in the build is listed here with its licence. Nothing is added to the repository until its licence is confirmed on the source page.

## Code and data in use

| Item | Use | Licence | Status |
| --- | --- | --- | --- |
| ECMWF thermofeel 2.3.0, Liljegren module | Ported to `packages/climate/src/liljegren.ts`; also generates the golden file | Apache-2.0 | In use; attribution in `NOTICE` |
| Open-Meteo Historical Weather API (ERA5) | `data/weather/abu-dhabi-2025-08.json` | CC BY 4.0 (attribution) | In use; attribution in `NOTICE` |

## 3D asset candidates (M3; confirm licence before download)

| Candidate | Contents relevant to Heatline | Stated licence | Source |
| --- | --- | --- | --- |
| Low Poly Construction Pack | Scaffolding, crane, site props (80 assets) | CC0 | https://lowpolyassets.itch.io/low-poly-construction-pack |
| 3D House Construction Site | Cranes, trucks, containers | CC0 | https://opengameart.org/content/3d-house-construction-site-lowpoly-cc0 |
| Kenney Building Kit | Modular building parts | CC0 | https://kenney-assets.itch.io/building-kit |
| Kenney City Kit (Industrial) | Industrial buildings and props | CC0 | https://opengameart.org/content/city-kit-industrial |
| Worker characters | Not yet found; search CC0 character packs (e.g., Quaternius) or build simple stylised figures in code | — | To do |

## Services (M0 spikes, pending credentials)

| Service | Use | Notes |
| --- | --- | --- |
| Anthropic Claude (`claude-opus-5-5`) | Guardian, site safety, planner and debrief agents | Server-side key; optionally via Microsoft Foundry |
| Azure AI Speech | Neural text-to-speech for EN, AR, HI, UR, BN, ML; English speech-to-text | Verify voices per locale in the M0 spike |
