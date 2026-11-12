// Shift planner: a real site, a real day, no simulated workers. Weather in, hour-by-hour work
// and rest limits, the coolest window for a paced task, and a crew briefing in seven languages.
// Everything is computed in the browser by the same climate code the 3D site uses.

import { useEffect, useMemo, useState } from 'react';
import type { Language } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import { BRIEFING_LANGUAGES, briefing, buildDayPlan, nioshLimitC, physiology, type DayPlan, type HourRow, type RestPlace } from '@heatline/sim';
import { BrandMark } from '../components/BrandMark';
import { BUNDLED_DATE, BUNDLED_SITE, addDays, bundledDay, fetchDay, isoDate, type DayWeather } from './weather';
import './planner.css';

const SITES = [
  { id: 'saadiyat', label: 'Saadiyat Island, Abu Dhabi', latitude: 24.54, longitude: 54.43 },
  { id: 'reem', label: 'Al Reem Island, Abu Dhabi', latitude: 24.495, longitude: 54.405 },
  { id: 'mussafah', label: 'Mussafah industrial area', latitude: 24.35, longitude: 54.5 },
  { id: 'kizad', label: 'KEZAD · Khalifa Port', latitude: 24.8, longitude: 54.65 },
  { id: 'alain', label: 'Al Ain', latitude: 24.19, longitude: 55.76 },
  { id: 'ruwais', label: 'Ruwais, Al Dhafra', latitude: 24.11, longitude: 52.73 },
  { id: 'jebelali', label: 'Jebel Ali, Dubai', latitude: 25.01, longitude: 55.06 },
] as const;

const CLOTHING = [
  { value: 0, label: 'Normal work clothes' },
  { value: 1, label: 'Coveralls (+1 °C)' },
  { value: 3, label: 'Double layer (+3 °C)' },
];

const LANGUAGE_LABELS: Record<Language, string> = { en: 'English', ar: 'العربية', hi: 'हिन्दी', ur: 'اردو', bn: 'বাংলা', ml: 'മലയാളം', tl: 'Tagalog' };
const RTL: Language[] = ['ar', 'ur'];
const LEVEL_WORDS = { green: 'Low', yellow: 'Caution', amber: 'High', red: 'Extreme' } as const;
const SOURCE_WORDS: Record<DayWeather['source'], string> = {
  forecast: 'Forecast from Open-Meteo',
  recent: 'Recent weather-model analysis from Open-Meteo',
  reanalysis: 'Historical reanalysis (ERA5) from Open-Meteo',
  bundled: 'Stored sample day (works offline)',
};
const LIMIT_MODERATE = nioshLimitC(physiology.METABOLIC_W.moderate, true);

interface Query {
  site: string;
  latitude: number;
  longitude: number;
  date: string;
  rest: RestPlace;
  clothing: number;
  pour: number;
}

function readQuery(today: string): Query {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  const custom = params.has('lat') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const preset = SITES.find((s) => s.id === params.get('site')) ?? SITES[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : addDays(today, 1);
  return {
    site: custom ? 'custom' : preset.id,
    latitude: custom ? lat : preset.latitude,
    longitude: custom ? lon : preset.longitude,
    date,
    rest: params.get('rest') === 'shade' ? 'shade' : 'cool-room',
    clothing: [0, 1, 3].includes(Number(params.get('clothing'))) ? Number(params.get('clothing')) : 0,
    pour: Math.min(180, Math.max(15, Number(params.get('pour')) || 45)),
  };
}

function writeQuery(q: Query) {
  const params = new URLSearchParams({ date: q.date, rest: q.rest });
  if (q.site === 'custom') {
    params.set('lat', q.latitude.toFixed(3));
    params.set('lon', q.longitude.toFixed(3));
  } else params.set('site', q.site);
  if (q.clothing) params.set('clothing', String(q.clothing));
  if (q.pour !== 45) params.set('pour', String(q.pour));
  history.replaceState(null, '', `#plan?${params}`);
}

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const inUae = (lat: number, lon: number) => lat >= 22.5 && lat <= 26.5 && lon >= 51 && lon <= 56.6;

export function Planner({ onClose, onRehearse }: { onClose: () => void; onRehearse: () => void }) {
  const today = useMemo(() => isoDate(new Date()), []);
  const [query, setQuery] = useState(() => readQuery(today));
  const [day, setDay] = useState<{ key: string; data: DayWeather } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [copied, setCopied] = useState(false);

  const weatherKey = `${query.latitude.toFixed(3)},${query.longitude.toFixed(3)},${query.date}`;
  useEffect(() => {
    writeQuery(query);
  }, [query]);
  useEffect(() => {
    // A pasted or edited link changes the plan without leaving the page.
    const sync = () => window.location.hash.startsWith('#plan') && setQuery(readQuery(today));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [today]);
  useEffect(() => {
    const title = document.title;
    document.title = 'Heatline · Shift planner';
    return () => {
      document.title = title;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    const isSample = query.date === BUNDLED_DATE && Math.abs(query.latitude - BUNDLED_SITE.latitude) < 0.01 && Math.abs(query.longitude - BUNDLED_SITE.longitude) < 0.01;
    if (isSample) {
      // The stored day needs no network at all.
      setDay({ key: weatherKey, data: bundledDay() });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchDay(query.latitude, query.longitude, query.date, today)
      .then((data) => !cancelled && setDay({ key: weatherKey, data }))
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.name === 'TimeoutError' || e.name === 'TypeError' ? 'The weather service could not be reached.' : e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherKey]);

  const current = day?.key === weatherKey ? day.data : null;
  const plan = useMemo<DayPlan | null>(() => {
    if (!current) return null;
    try {
      return buildDayPlan({
        date: query.date, latitude: query.latitude, longitude: query.longitude, utcOffsetHours: current.utcOffsetHours, weather: current.weather,
        rest: query.rest, clothingAdjustC: query.clothing, pourMinutes: query.pour, middayBan: inUae(query.latitude, query.longitude),
      });
    } catch {
      return null;
    }
  }, [current, query]);

  const set = (patch: Partial<Query>) => setQuery((q) => ({ ...q, ...patch }));
  const pickSite = (id: string) => {
    const preset = SITES.find((s) => s.id === id);
    set(preset ? { site: preset.id, latitude: preset.latitude, longitude: preset.longitude } : { site: 'custom' });
  };
  const useSample = () => set({ site: 'saadiyat', ...BUNDLED_SITE, date: BUNDLED_DATE });
  const lines = plan ? briefing(plan, language) : [];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const siteLabel = query.site === 'custom' ? `${query.latitude.toFixed(3)}, ${query.longitude.toFixed(3)}` : SITES.find((s) => s.id === query.site)!.label;
  const restWords = query.rest === 'cool-room' ? 'a cooled room' : 'shade';

  return (
    <div className="planner">
      <header className="planner-top">
        <button className="planner-brand" onClick={onClose} aria-label="Back to Heatline home"><BrandMark /> Heatline</button>
        <span className="planner-tag">Shift planner</span>
        <button className="planner-back" onClick={onClose}>← Home</button>
      </header>

      <main className="planner-main">
        <section className="planner-intro">
          <p className="planner-kicker">A real site · a real day · no wearables needed</p>
          <h1>Plan the shift before the heat arrives.</h1>
          <p>Pick a site and a day. Heatline turns the weather into hour-by-hour work and rest limits, the coolest window for a concrete pour, and a briefing your crews can read in their own language.</p>
        </section>

        <form className="planner-controls" onSubmit={(e) => e.preventDefault()} aria-label="Plan settings">
          <label>
            <span>Site</span>
            <select value={query.site} onChange={(e) => pickSite(e.target.value)}>
              {SITES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value="custom">Other coordinates…</option>
            </select>
          </label>
          {query.site === 'custom' && (
            <div className="planner-coords">
              <label><span>Latitude</span><input type="number" step="0.001" min={-90} max={90} value={query.latitude} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && set({ latitude: e.target.valueAsNumber })} /></label>
              <label><span>Longitude</span><input type="number" step="0.001" min={-180} max={180} value={query.longitude} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && set({ longitude: e.target.valueAsNumber })} /></label>
            </div>
          )}
          <label>
            <span>Day</span>
            <input type="date" value={query.date} max={addDays(today, 15)} min="1990-01-01" onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </label>
          <label>
            <span>Crews rest in</span>
            <select value={query.rest} onChange={(e) => set({ rest: e.target.value as RestPlace })}>
              <option value="cool-room">A cooled room</option>
              <option value="shade">Shade only</option>
            </select>
          </label>
          <label>
            <span>Clothing</span>
            <select value={query.clothing} onChange={(e) => set({ clothing: Number(e.target.value) })}>
              {CLOTHING.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label>
            <span>Pour length</span>
            <select value={query.pour} onChange={(e) => set({ pour: Number(e.target.value) })}>
              {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
          <div className="planner-picks" role="group" aria-label="Quick picks">
            <span>Try</span>
            <button type="button" className={query.date === addDays(today, 1) ? 'on' : ''} onClick={() => set({ date: addDays(today, 1) })}>Tomorrow</button>
            <button type="button" className={query.date === '2026-08-22' ? 'on' : ''} onClick={() => set({ date: '2026-08-22' })}>Hottest day of summer 2026</button>
            <button type="button" className={query.date === '2026-07-18' ? 'on' : ''} onClick={() => set({ date: '2026-07-18' })}>A typical summer day</button>
            <button type="button" className={query.date === BUNDLED_DATE ? 'on' : ''} onClick={useSample}>Stored sample (offline)</button>
          </div>
        </form>

        {loading && !plan && <p className="planner-status" role="status">Fetching the weather for {siteLabel}…</p>}
        {error && (
          <div className="planner-error" role="alert">
            <strong>{error}</strong>
            <p>You can still see how the planner works with a stored day that needs no connection.</p>
            <button onClick={useSample}>Open the stored sample day</button>
          </div>
        )}

        {plan && current && (
          <div className={loading ? 'planner-result stale' : 'planner-result'}>
            <div className="planner-headline">
              <div>
                <h2>{siteLabel}</h2>
                <p>{longDate(query.date)} · {SOURCE_WORDS[current.source]} · grid point {current.grid.latitude.toFixed(2)}°, {current.grid.longitude.toFixed(2)}°</p>
              </div>
              <button className="planner-print" onClick={() => window.print()}>Print this plan</button>
            </div>

            <section className="planner-cards" aria-label="Summary">
              <Card label="Peak heat stress in the sun" value={`${plan.peak.wbgtSun.toFixed(1)} °C`} detail={`WBGT at ${formatClock(plan.peak.minute)}`} />
              {plan.limited ? (
                <Card
                  label="Heavy work in the sun"
                  value={plan.tightestHeavy >= 15 ? `${plan.tightestHeavy} min / hour` : 'Not today'}
                  detail={plan.tightestHeavy >= 15 ? `at the hottest working hour, resting in ${restWords}. Limits apply ${formatClock(plan.limited.from)}–${formatClock(plan.limited.to)}` : `with rest in ${restWords}, the hottest working hours leave no safe heavy-work time`}
                  tone={plan.tightestHeavy >= 30 ? 'amber' : 'red'}
                />
              ) : (
                <Card label="Heavy work in the sun" value="No limit needed" detail="continuous work stays within the exposure limit all day" tone="green" />
              )}
              <Card
                label={plan.seasonBan ? 'After the midday break' : 'Afternoon, 15:00 onwards'}
                value={plan.afterBreakOverLimitHours ? `${plan.afterBreakOverLimitHours} of ${plan.afterBreakHours} hours` : 'Within the limit'}
                detail={plan.afterBreakOverLimitHours ? 'are still too hot for continuous moderate work' : 'continuous moderate work stays within the exposure limit'}
                tone={plan.afterBreakOverLimitHours ? 'red' : 'green'}
              />
              {plan.pour.best && (
                <Card
                  label={`Coolest ${query.pour}-minute pour window`}
                  value={`${formatClock(plan.pour.best.from)}–${formatClock(plan.pour.best.to)}`}
                  detail={`${plan.pour.best.meanWbgtSun.toFixed(1)} °C WBGT${plan.pour.worst ? `, against ${plan.pour.worst.meanWbgtSun.toFixed(1)} °C at ${formatClock(plan.pour.worst.from)}` : ''}. ${plan.pour.best.withinLimit ? 'Within the limit for continuous heavy work.' : 'Still over the limit for continuous heavy work: rotate the crew through it.'}`}
                  tone={plan.pour.best.withinLimit ? 'green' : 'amber'}
                />
              )}
            </section>

            <section className="planner-chart" aria-label="Heat stress through the day">
              <h3>Heat stress through the day</h3>
              <DayChart plan={plan} />
            </section>

            <section className="planner-hours">
              <h3>Hour by hour: how long a crew can work in the sun</h3>
              <p className="planner-sub">Minutes of work in each hour, with the rest of the hour spent resting in {restWords}. Workers used to the heat, then workers who are new or back from leave.</p>
              <div className="planner-table-wrap">
                <table>
                  <thead>
                    <tr><th>Hour</th><th>Risk</th><th>WBGT sun</th><th>WBGT shade</th><th>Feels like</th><th>Light work</th><th>Moderate work</th><th>Heavy work</th><th>New workers, heavy</th></tr>
                  </thead>
                  <tbody>
                    {plan.hours.map((h) => <HourLine key={h.from} h={h} />)}
                  </tbody>
                </table>
              </div>
              <p className="planner-sub">Light work: inspection, tool handling. Moderate: carrying, formwork. Heavy: rebar tying, concrete placing, shovelling. Water: about one cup every 15–20 minutes whenever the risk is Caution or above. Risk shows how much steady moderate work the hour allows with only shade to rest in: Low all hour, Caution at least half, High at least ten minutes, Extreme less.</p>
            </section>

            <section className="planner-briefing">
              <div className="planner-briefing-head">
                <div>
                  <h3>Crew briefing</h3>
                  <p className="planner-sub">The same instructions in each crew’s language. Read it out at the start of the shift or send it to their phones.</p>
                </div>
                <div className="planner-langs" role="tablist" aria-label="Briefing language">
                  {BRIEFING_LANGUAGES.map((l) => <button key={l} role="tab" aria-selected={language === l} className={language === l ? 'on' : ''} onClick={() => setLanguage(l)}>{LANGUAGE_LABELS[l]}</button>)}
                </div>
              </div>
              <ol className="planner-lines" lang={language} dir={RTL.includes(language) ? 'rtl' : 'ltr'}>
                {lines.map((line, i) => <li key={i}>{line}</li>)}
              </ol>
              {language !== 'en' && <ol className="planner-lines english" aria-label="English">{briefing(plan, 'en').map((line, i) => <li key={i}>{line}</li>)}</ol>}
              <div className="planner-briefing-actions">
                <button onClick={copy}>{copied ? 'Copied' : 'Copy briefing'}</button>
                <small>Draft translations. A native speaker must check them before they reach a real crew.</small>
              </div>
            </section>

            <section className="planner-next">
              <div>
                <h3>Rehearse a day like this before you live it</h3>
                <p>Take the supervisor’s seat on a 3D site with twenty workers, a booked concrete truck and an assistant that tests plans against the rules.</p>
              </div>
              <button onClick={onRehearse}>Open the 3D site</button>
            </section>

            <section className="planner-method">
              <h3>How this is worked out, and its limits</h3>
              <ul>
                <li><b>Heat stress</b> is the wet-bulb globe temperature (WBGT), calculated from air temperature, humidity, wind and sunshine with the Liljegren method. Our code matches the ECMWF reference implementation on 744 test hours.</li>
                <li><b>Work minutes</b> are the longest work period in each hour that keeps the hour’s average heat and effort within the US NIOSH recommended limits (publication 2016-106). Continuous moderate work is over the limit above {LIMIT_MODERATE.toFixed(1)} °C WBGT.</li>
                <li><b>The weather</b> is a forecast or reanalysis for a grid square of several kilometres, not a reading on your site. Radiating concrete, wind shadow and work at height can make a real site hotter. Measure on site before relying on it.</li>
                <li><b>This is a planning aid</b>, not a safety certificate and not an assessment under Abu Dhabi’s Safety in the Heat code, which calls for a Thermal Work Limit assessment by a competent person.</li>
                {plan.seasonBan && <li><b>The midday break</b> (12:30–15:00, 15 June to 15 September) is shown as no outdoor work.</li>}
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: 'green' | 'amber' | 'red' }) {
  return (
    <div className={`planner-card ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </div>
  );
}

function Minutes({ value }: { value: number }) {
  return (
    <td className="planner-min">
      <span className="planner-bar" aria-hidden="true"><i style={{ width: `${(value / 60) * 100}%` }} /></span>
      {value >= 60 ? 'All hour' : value === 0 ? 'None' : `${value} min`}
    </td>
  );
}

function HourLine({ h }: { h: HourRow }) {
  if (h.banned) {
    return (
      <tr className="banned">
        <td>{formatClock(h.from)}</td>
        <td><span className="planner-level level-ban">Break</span></td>
        <td>{h.wbgtSun.toFixed(1)}°</td>
        <td>{h.wbgtShade.toFixed(1)}°</td>
        <td>{Math.round(h.heatIndex)}°</td>
        <td colSpan={4}>Midday break: no outdoor work</td>
      </tr>
    );
  }
  return (
    <tr>
      <td>{formatClock(h.from)}{h.partlyBanned && <small>until 12:30</small>}</td>
      <td><span className={`planner-level level-${h.level}`}>{LEVEL_WORDS[h.level]}</span></td>
      <td>{h.wbgtSun.toFixed(1)}°</td>
      <td>{h.wbgtShade.toFixed(1)}°</td>
      <td>{Math.round(h.heatIndex)}°</td>
      <Minutes value={h.work.light} />
      <Minutes value={h.work.moderate} />
      <Minutes value={h.work.heavy} />
      <Minutes value={h.workNew.heavy} />
    </tr>
  );
}

/** WBGT in sun and shade across the working day, the continuous-work limit, and the midday break. */
function DayChart({ plan }: { plan: DayPlan }) {
  const W = 720;
  const H = 230;
  const pad = { l: 38, r: 96, t: 14, b: 28 };
  const values = plan.hours.flatMap((h) => [h.wbgtSun, h.wbgtShade]);
  const lo = Math.floor(Math.min(...values, LIMIT_MODERATE) - 1);
  const hi = Math.ceil(Math.max(...values, LIMIT_MODERATE) + 1);
  const start = plan.input.workStart;
  const end = plan.input.workEnd;
  const x = (minute: number) => pad.l + ((minute - start) / (end - start)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const path = (pick: (h: HourRow) => number) => plan.hours.map((h, i) => `${i ? 'L' : 'M'}${x(h.from + 30).toFixed(1)} ${y(pick(h)).toFixed(1)}`).join(' ');
  const last = plan.hours[plan.hours.length - 1]!;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) ticks.push(v);
  // Keep the two end labels apart when the lines converge in the evening.
  let sunY = y(last.wbgtSun);
  let shadeY = y(last.wbgtShade);
  if (Math.abs(sunY - shadeY) < 13) {
    const mid = (sunY + shadeY) / 2;
    sunY = mid - 7;
    shadeY = mid + 7;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`WBGT in the sun peaks at ${plan.peak.wbgtSun.toFixed(1)} °C at ${formatClock(plan.peak.minute)}. The limit for continuous moderate work is ${LIMIT_MODERATE.toFixed(1)} °C.`}>
      {plan.seasonBan && <rect className="chart-ban" x={x(750)} y={pad.t} width={x(900) - x(750)} height={H - pad.t - pad.b} />}
      {plan.seasonBan && <text className="chart-note" x={(x(750) + x(900)) / 2} y={pad.t + 13} textAnchor="middle">Midday break</text>}
      {ticks.map((v) => (
        <g key={v}>
          <line className="chart-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
          <text className="chart-tick" x={pad.l - 7} y={y(v) + 4} textAnchor="end">{v}°</text>
        </g>
      ))}
      {plan.hours.filter((_, i) => i % 2 === 0).map((h) => <text key={h.from} className="chart-tick" x={x(h.from)} y={H - 8} textAnchor="middle">{formatClock(h.from)}</text>)}
      <line className="chart-limit" x1={pad.l} x2={W - pad.r} y1={y(LIMIT_MODERATE)} y2={y(LIMIT_MODERATE)} />
      <text className="chart-limit-label" x={W - pad.r + 6} y={y(LIMIT_MODERATE) + 4}>Work limit</text>
      <path className="chart-shade" d={path((h) => h.wbgtShade)} />
      <path className="chart-sun" d={path((h) => h.wbgtSun)} />
      <text className="chart-label sun" x={W - pad.r + 6} y={sunY + 4}>In the sun</text>
      <text className="chart-label shade" x={W - pad.r + 6} y={shadeY + 4}>In shade</text>
    </svg>
  );
}
