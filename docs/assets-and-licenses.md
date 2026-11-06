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
| OpenAI `gpt-6.1-sol`, `gpt-6-luna` (Responses API) | Planner and debrief; guardian and site safety | Server-side `OPENAI_API_KEY` |
| OpenAI `gpt-4o-mini-tts` | Spoken warnings | Deprecated, shuts down 6 Jan 2027; Bengali/Malayalam not in the listed languages |
| OpenAI `gpt-transcribe` | Supervisor voice orders | — |

## Generated landing-page images (7 November 2026)

Two fictional illustrations were created with the built-in image generation tool: `apps/web/public/images/saadiyat-hero.jpg` and `apps/web/public/images/worker-break.jpg`. Neither is a photograph documenting a real site, person or pilot. Generation prompts and usage are recorded in [generated-imagery.md](generated-imagery.md). Both are labelled AI-generated in the product.
