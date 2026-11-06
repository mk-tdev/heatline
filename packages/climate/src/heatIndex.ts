// US National Weather Service heat index (Rothfusz regression with the standard adjustments).
// Used for the worker-facing "feels like" value and Dubai Municipality's flag bands; WBGT
// remains the exposure measure for work/rest decisions.

export function heatIndexC(airC: number, rhPct: number): number {
  const t = (airC * 9) / 5 + 32;
  const rh = rhPct;
  const simple = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  let hi: number;
  if ((simple + t) / 2 < 80) {
    hi = simple;
  } else {
    hi =
      -42.379 +
      2.04901523 * t +
      10.14333127 * rh -
      0.22475541 * t * rh -
      0.00683783 * t * t -
      0.05481717 * rh * rh +
      0.00122874 * t * t * rh +
      0.00085282 * t * rh * rh -
      0.00000199 * t * t * rh * rh;
    if (rh < 13 && t >= 80 && t <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    else if (rh > 85 && t >= 80 && t <= 87) hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return ((hi - 32) * 5) / 9;
}

export type DubaiFlag = 'green' | 'yellow' | 'amber' | 'red';

/** Dubai Municipality heat-index risk band (guideline v2.0, 2019): ≤34 / 35–39 / 40–45 / ≥46 °C. */
export function dubaiFlag(heatIndex: number): DubaiFlag {
  if (heatIndex < 35) return 'green';
  if (heatIndex < 40) return 'yellow';
  if (heatIndex < 46) return 'amber';
  return 'red';
}
