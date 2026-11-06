// Sun position from the NOAA general solar position equations (accurate to well under a
// degree, which is plenty for shade geometry and WBGT). Times are UTC instants.

export interface SunPosition {
  /** cosine of the solar zenith angle, clamped at 0 when the sun is down */
  cosZenith: number;
  /** elevation above the horizon [degrees] */
  elevation: number;
  /** azimuth clockwise from true north [degrees] */
  azimuth: number;
}

const DEG = Math.PI / 180;

function dayOfYear(utc: Date): number {
  const start = Date.UTC(utc.getUTCFullYear(), 0, 1);
  return Math.floor((utc.getTime() - start) / 86_400_000) + 1;
}

export function sunPosition(utc: Date, latitude: number, longitude: number): SunPosition {
  const hour = utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dayOfYear(utc) - 1 + (hour - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const trueSolarMinutes = hour * 60 + eqTime + 4 * longitude;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG;
  const lat = latitude * DEG;
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  const elevation = 90 - zenith / DEG;
  // Azimuth from the NOAA formulation, measured clockwise from north.
  const sinZ = Math.sin(zenith);
  let azimuth = 0;
  if (sinZ > 1e-9) {
    const cosAz = (Math.sin(lat) * Math.cos(zenith) - Math.sin(decl)) / (Math.cos(lat) * sinZ);
    const az = Math.acos(Math.min(1, Math.max(-1, cosAz))) / DEG;
    azimuth = hourAngle > 0 ? (az + 180) % 360 : (540 - az) % 360;
  }
  return { cosZenith: Math.max(0, cosZ), elevation, azimuth };
}
