"""Build the WBGT golden file that the TypeScript Liljegren port is tested against.

Reads data/weather/abu-dhabi-2025-08.json (Open-Meteo ERA5, copied from research/data) and
writes data/weather/wbgt-golden.json with, per hour, the exact inputs and ECMWF thermofeel's
Liljegren WBGT. Open-Meteo radiation is the mean over the preceding hour, so the sun position
is evaluated at the middle of that hour (same convention as research/data).

Requires numpy and thermofeel (pip install thermofeel). Run: python3 -I scripts/wbgt-golden.py
"""
import json
import math
import os
from datetime import datetime, timedelta, timezone

import numpy as np
import thermofeel as tf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "weather", "abu-dhabi-2025-08.json")
OUT = os.path.join(ROOT, "data", "weather", "wbgt-golden.json")
GST = timezone(timedelta(hours=4))

data = json.load(open(SRC))
h = data["hourly"]
lat, lon = data["latitude"], data["longitude"]


def cos_zenith(when_utc):
    doy = when_utc.timetuple().tm_yday
    hour = when_utc.hour + when_utc.minute / 60
    g = 2 * math.pi / 365 * (doy - 1 + (hour - 12) / 24)
    eqtime = 229.18 * (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g)
                       - 0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g))
    decl = (0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) - 0.006758 * math.cos(2 * g)
            + 0.000907 * math.sin(2 * g) - 0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g))
    ha = math.radians((hour * 60 + eqtime + 4 * lon) / 4 - 180)
    la = math.radians(lat)
    return max(0.0, math.sin(la) * math.sin(decl) + math.cos(la) * math.cos(decl) * math.cos(ha))


rows = []
for i, stamp in enumerate(h["time"]):
    mid = (datetime.fromisoformat(stamp).replace(tzinfo=GST) - timedelta(minutes=30)).astimezone(timezone.utc)
    ssrd = float(h["shortwave_radiation"][i])
    direct = float(h["direct_radiation"][i])
    rows.append({
        "time": stamp,
        "midUtc": mid.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "airC": h["temperature_2m"][i],
        "rhPct": h["relative_humidity_2m"][i],
        "pressureHpa": h["surface_pressure"][i],
        "wind10": h["wind_speed_10m"][i],
        "ssrd": ssrd,
        "fdir": min(1.0, max(0.0, direct / ssrd)) if ssrd > 0 else 0.0,
        "cossza": cos_zenith(mid),
    })

wbgt = tf.calculate_wbgt_liljegren(
    np.array([r["airC"] for r in rows]) + 273.15,
    np.array([r["rhPct"] for r in rows], dtype=float),
    np.array([r["pressureHpa"] for r in rows], dtype=float),
    np.array([r["wind10"] for r in rows], dtype=float),
    np.array([r["ssrd"] for r in rows]),
    np.array([r["fdir"] for r in rows]),
    np.array([r["cossza"] for r in rows]),
) - 273.15
for r, w in zip(rows, wbgt):
    r["expectedWbgt"] = None if np.isnan(w) else round(float(w), 4)

meta = {
    "source": "Open-Meteo historical (ERA5) via research/data; expected WBGT from ECMWF thermofeel calculate_wbgt_liljegren",
    "thermofeel": getattr(tf, "__version__", "unknown"),
    "latitude": lat,
    "longitude": lon,
    "hours": len(rows),
}
json.dump({"meta": meta, "rows": rows}, open(OUT, "w"), indent=1)
print(f"wrote {OUT}: {len(rows)} hours, {sum(r['expectedWbgt'] is None for r in rows)} non-converged")
