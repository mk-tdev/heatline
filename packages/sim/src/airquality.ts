// Dust and particulate advice for outdoor work. Bands use the US EPA AQI breakpoints for PM10
// (µg/m³). EPA defines them on 24-hour averages; Heatline applies them to hourly values as a
// screen, which is stricter. The actions are Heatline's defaults for a site to review, not
// UAE regulation. CAMS model data covers a grid of about 45 km; a site PM sensor overrides it.

export type DustLevel = 'clear' | 'elevated' | 'unhealthy' | 'severe';

export const PM10_BANDS = { elevated: 155, unhealthy: 255, severe: 355 } as const;

export function dustLevel(pm10: number | null | undefined): DustLevel {
  if (pm10 === null || pm10 === undefined || !Number.isFinite(pm10)) return 'clear';
  if (pm10 >= PM10_BANDS.severe) return 'severe';
  if (pm10 >= PM10_BANDS.unhealthy) return 'unhealthy';
  if (pm10 >= PM10_BANDS.elevated) return 'elevated';
  return 'clear';
}

export const DUST_RANK: Record<DustLevel, number> = { clear: 0, elevated: 1, unhealthy: 2, severe: 3 };

export const DUST_ADVICE: Record<DustLevel, { title: string; action: string }> = {
  clear: { title: 'Dust back to normal', action: 'No dust measures needed.' },
  elevated: { title: 'Dust elevated', action: 'Offer FFP2/N95 masks, damp down dusty work, and watch workers with asthma.' },
  unhealthy: { title: 'Dust unhealthy', action: 'FFP2/N95 masks for all outdoor work. Postpone cutting, grinding and sweeping. Masks make heavy work harder: keep to the break schedule.' },
  severe: { title: 'Dust severe', action: 'Move heavy outdoor work indoors or postpone it. Masks for anyone outside. Check visibility before crane lifts.' },
};
