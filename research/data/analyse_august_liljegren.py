"""Physically based outdoor WBGT (in full sun) for August 2025 near Saadiyat, Abu Dhabi.

Uses ECMWF thermofeel's Liljegren et al. (2008) implementation. Requires numpy + thermofeel:
  python3 -m venv venv && venv/bin/pip install thermofeel && venv/bin/python -I analyse_august_liljegren.py

Open-Meteo radiation is the mean over the preceding hour, so the sun position is evaluated at
the middle of that hour. The solar zenith angle uses the NOAA general solar position equations.
"""
import json
import math
import os
from datetime import datetime, timedelta, timezone

import numpy as np
import thermofeel as tf

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "abu-dhabi-saadiyat-2025-08-hourly.json")))
h = data["hourly"]
LAT, LON = data["latitude"], data["longitude"]
GST = timezone(timedelta(hours=4))


def cos_zenith(when_utc):
    doy = when_utc.timetuple().tm_yday
    hour = when_utc.hour + when_utc.minute / 60
    g = 2 * math.pi / 365 * (doy - 1 + (hour - 12) / 24)
    eqtime = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                       - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    decl = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g)
            + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    true_solar_min = hour * 60 + eqtime + 4 * LON
    ha = math.radians(true_solar_min / 4 - 180)
    lat = math.radians(LAT)
    return max(0.0, math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(ha))


times = [datetime.fromisoformat(t).replace(tzinfo=GST) for t in h["time"]]
mid_utc = [(t - timedelta(minutes=30)).astimezone(timezone.utc) for t in times]
cossza = np.array([cos_zenith(t) for t in mid_utc])
ssrd = np.array(h["shortwave_radiation"], dtype=float)
direct = np.array(h["direct_radiation"], dtype=float)
fdir = np.where(ssrd > 0, np.clip(direct / np.maximum(ssrd, 1e-6), 0, 1), 0)
wbgt = tf.calculate_wbgt_liljegren(
    np.array(h["temperature_2m"]) + 273.15,
    np.array(h["relative_humidity_2m"], dtype=float),
    np.array(h["surface_pressure"], dtype=float),
    np.array(h["wind_speed_10m"], dtype=float),
    ssrd, fdir, cossza,
) - 273.15

hours = np.array([t.hour for t in times])
print("Liljegren outdoor WBGT (sun), August 2025, by local hour (mean / max / share of days >=31 / >=33):")
for hr in range(7, 18):
    v = wbgt[hours == hr]
    print(f"  {hr:02d}:00  mean {v.mean():4.1f}  max {v.max():4.1f}  >=31 {100 * (v >= 31).mean():3.0f}%  >=33 {100 * (v >= 33).mean():3.0f}%")
work = (hours >= 7) & (hours <= 17)
i = int(np.argmax(np.where(work, wbgt, -99)))
print(f"Peak working-hour WBGT: {wbgt[i]:.1f} at {h['time'][i]}")
ban = np.isin(hours, [13, 14])  # hourly means ending 13:00 and 14:00, inside the 12:30-15:00 ban
after = np.isin(hours, [16, 17])  # hourly means ending 16:00 and 17:00, after the ban
print(f"Mean WBGT inside ban window (13-14h): {wbgt[ban].mean():.1f}; after the ban (16-17h): {wbgt[after].mean():.1f}")
