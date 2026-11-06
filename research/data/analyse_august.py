"""Summarise heat conditions for August 2025 working hours near Saadiyat, Abu Dhabi.

Input: abu-dhabi-saadiyat-2025-08-hourly.json (Open-Meteo historical archive, ERA5-based).
Output: printed tables used in research/03-abu-dhabi-heat-data.md.

Approximations, clearly not instrument readings:
- Heat index: US NWS Rothfusz regression with the standard adjustments (Fahrenheit inside).
- Shade WBGT: Australian Bureau of Meteorology approximation
  WBGT = 0.567*T + 0.393*e + 3.94, e = vapour pressure in hPa. It assumes moderate wind and
  no direct sun, so it under-states WBGT for workers in full sun.
Run: python3 -I analyse_august.py
"""
import json
import math
import os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "abu-dhabi-saadiyat-2025-08-hourly.json")))
h = data["hourly"]


def heat_index_c(t_c, rh):
    t = t_c * 9 / 5 + 32
    simple = 0.5 * (t + 61.0 + (t - 68.0) * 1.2 + rh * 0.094)
    if (simple + t) / 2 < 80:
        hi = simple
    else:
        hi = (-42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh
              - 0.00683783 * t * t - 0.05481717 * rh * rh + 0.00122874 * t * t * rh
              + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh)
        if rh < 13 and 80 <= t <= 112:
            hi -= ((13 - rh) / 4) * math.sqrt((17 - abs(t - 95)) / 17)
        elif rh > 85 and 80 <= t <= 87:
            hi += ((rh - 85) / 10) * ((87 - t) / 5)
    return (hi - 32) * 5 / 9


def shade_wbgt(t_c, rh):
    e = rh / 100 * 6.105 * math.exp(17.27 * t_c / (237.7 + t_c))
    return 0.567 * t_c + 0.393 * e + 3.94


def dm_band(hi):  # Dubai Municipality heat-index risk bands (guideline v2.0, 2019)
    if hi < 35:
        return "low (<35)"
    if hi < 40:
        return "moderate (35-39)"
    if hi < 46:
        return "high (40-45)"
    return "very high (>=46)"


rows = []
for i, ts in enumerate(h["time"]):
    hour = int(ts[11:13])
    t, rh = h["temperature_2m"][i], h["relative_humidity_2m"][i]
    rows.append({"ts": ts, "hour": hour, "t": t, "rh": rh, "hi": heat_index_c(t, rh), "wbgt": shade_wbgt(t, rh),
                 "sw": h["shortwave_radiation"][i], "wind": h["wind_speed_10m"][i]})

work = [r for r in rows if 7 <= r["hour"] <= 17]  # 07:00-17:59 local, typical site day
print(f"Working hours analysed: {len(work)} (07:00-17:59, 31 days)")
bands = Counter(dm_band(r["hi"]) for r in work)
for band in ["low (<35)", "moderate (35-39)", "high (40-45)", "very high (>=46)"]:
    print(f"  heat index {band:18s} {bands[band]:4d} h  {100 * bands[band] / len(work):5.1f}%")

print("\nBy hour of day (mean air temp / mean RH / mean heat index / mean shade WBGT / share of days WBGT>=31):")
for hour in range(7, 18):
    sel = [r for r in work if r["hour"] == hour]
    mean = lambda k: sum(r[k] for r in sel) / len(sel)
    over = sum(r["wbgt"] >= 31 for r in sel) / len(sel)
    print(f"  {hour:02d}:00  T {mean('t'):4.1f}  RH {mean('rh'):4.1f}  HI {mean('hi'):4.1f}  WBGTshade {mean('wbgt'):4.1f}  >=31: {100 * over:3.0f}%")

worst = max(work, key=lambda r: r["wbgt"])
print(f"\nHighest shade WBGT in working hours: {worst['wbgt']:.1f} at {worst['ts']} (T {worst['t']}, RH {worst['rh']})")
humid = max(work, key=lambda r: r["hi"])
print(f"Highest heat index in working hours: {humid['hi']:.1f} at {humid['ts']} (T {humid['t']}, RH {humid['rh']})")
ban = [r for r in work if r["hour"] in (12, 13, 14)]
print(f"Mean heat index 12:00-14:59 (midday-ban window overlaps 12:30-15:00): {sum(r['hi'] for r in ban) / len(ban):.1f}")
morning = [r for r in work if r["hour"] in (7, 8, 9)]
print(f"Mean RH 07:00-09:59: {sum(r['rh'] for r in morning) / len(morning):.0f}%  vs 13:00-14:59: "
      f"{sum(r['rh'] for r in work if r['hour'] in (13, 14)) / len([r for r in work if r['hour'] in (13, 14)]):.0f}%")
