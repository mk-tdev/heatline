# 03 · Abu Dhabi heat data: August 2025 near Saadiyat

Collected 6 November 2026. Reproducible: data and scripts are in `research/data/`.

## Data

| Item | Value |
| --- | --- |
| Source | Open-Meteo Historical Weather API (ERA5-based reanalysis), https://archive-api.open-meteo.com/v1/archive |
| Location requested | 24.54 N, 54.43 E (Saadiyat Island, Abu Dhabi); grid point returned 24.499 N, 54.423 E, elevation 3 m |
| Period | 1–31 August 2025, hourly, local time (Asia/Dubai, GST) |
| Variables | Air temperature, relative humidity, dew point, 10 m wind, shortwave, direct and diffuse radiation, surface pressure, cloud cover |
| File | `data/abu-dhabi-saadiyat-2025-08-hourly.json` (744 hours) |

Reanalysis is a grid-cell estimate, not a site instrument. It smooths local effects such as concrete radiating heat, wind shadows between structures, and work at height. Heatline uses it as realistic forcing for the simulation and for back-testing, not as a claim about any real site's conditions.

## Results

Timing convention: Open-Meteo temperature, humidity, pressure and wind are instantaneous values at the hour; radiation is the mean over the preceding hour (the sun position is evaluated at the middle of that hour). Each row pairs the two, so a row labelled 13:00 reflects conditions around 12:30–13:00. The engine interpolates each kind on its own time base.

### 1. Physically based WBGT in full sun (Liljegren, thermofeel 2.3.0) — the headline

`data/analyse_august_liljegren.py`

| Local hour | Mean WBGT °C | Max | Days ≥ 31 °C | Days ≥ 33 °C |
| --- | --- | --- | --- | --- |
| 07:00 | 28.5 | 33.2 | 10% | 3% |
| 08:00 | 30.0 | 34.7 | 26% | 3% |
| 09:00 | 31.3 | 36.6 | 42% | 16% |
| 10:00 | 32.6 | 37.3 | 90% | 32% |
| 11:00 | 33.5 | 37.6 | 97% | 48% |
| 12:00 | 34.1 | 37.3 | **100%** | 87% |
| 13:00 | 34.6 | 37.5 | **100%** | 90% |
| 14:00 | 34.4 | 36.9 | **100%** | 87% |
| 15:00 | 34.2 | 36.7 | **100%** | 87% |
| 16:00 | 33.8 | 35.9 | **100%** | 71% |
| 17:00 | 33.1 | 35.3 | **100%** | 52% |

- Peak working-hour WBGT: **37.6 °C** (1 Aug, hour ending 11:00).
- Mean WBGT in the midday-ban window (hours ending 13:00–14:00): **34.5 °C**; after the ban (16:00–17:00): **33.4 °C**.

**What this means:** the 12:30–15:00 ban covers the hottest hours, but WBGT stayed at or above 31 °C on **every** August day from 12:00 to 18:00 and on 90–97% of days from 10:00. For context, one reproduced ACGIH table puts the acclimatised TLV for continuous *moderate* work at 28 °C WBGT ([02](02-heat-stress-science-and-standards.md)). The ban removes about 2.5 of roughly 6–8 high-exposure hours; the rest must be managed with work-rest, water, shade, rotation and task timing. **That residual exposure is the problem Heatline addresses.**

### 2. Heat index bands (Dubai Municipality) during 07:00–17:59

`data/analyse_august.py`

| Dubai band | Hours | Share |
| --- | --- | --- |
| Low (< 35 °C) | 3 | 0.9% |
| Moderate (35–39 °C) | 53 | 15.5% |
| High (40–45 °C) | 169 | 49.6% |
| Very high (≥ 46 °C) | 116 | 34.0% |

Under the Dubai guideline, **84% of August working hours** were "high" or "very high" heat-stress risk.

### 3. A caution we learned the hard way

A simple shade-WBGT approximation (Australian Bureau of Meteorology formula, 0.567·T + 0.393·e + 3.94) suggested the worst conditions came *after* the ban (15:00–18:00), because humidity rises in the late afternoon. The physically based Liljegren model does **not** support that: it peaks at 12:00–15:00 and declines after. The approximation over-weights humidity at very high temperatures. Heatline must use the Liljegren model (or measured WBGT/TWL) and never the shortcut. The heat index is still shown, because Dubai's flag system uses it.

### 4. Other observations

- Early mornings are humid: mean RH 50% at 07:00–09:59 versus 34% at 13:00–14:59. Sharjah CoP 33 makes the same point. Early pours are cooler but not risk-free.
- Highest heat index in working hours: about 61 °C (1 Aug, 12:00; 38.3 °C at 66% RH), a humid sea-breeze day.
- Maximum shortwave radiation: 904 W/m².

## How Heatline uses this

1. **Scenario forcing:** the demo shift replays a real August 2025 afternoon (candidate: 1 Aug, the most humid day, or a typical 34–35 °C WBGT day) hour by hour, interpolated to minutes.
2. **Back-test set:** all 31 days × crew profiles drive the evaluation of warning lead time and false-alarm rate ([implementation plan](../Heatline/docs/implementation-plan.md)).
3. **Live mode:** the same pipeline accepts Open-Meteo's forecast API for "today" at any site coordinates.

## Reproduce

```sh
cd research/data
python3 -I analyse_august.py                       # heat index + simple approximation, stdlib only
python3 -m venv venv && venv/bin/pip install thermofeel
venv/bin/python -I analyse_august_liljegren.py     # Liljegren WBGT
```
