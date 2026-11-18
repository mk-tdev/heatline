// Site watch: the live scheduler on a page. Replay a real summer day (the forecast issued the day
// before, a site station, real dust), or run today for any site with an optional station.
// Every number on screen comes from the scheduler in packages/sim/src/watch.ts.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import { BROADCAST_LANGUAGES, DUST_ADVICE, broadcast, limitShare, noorTriggers, parseStationCsv, shiftSummary, watchContext, type StationReading, type WatchAlert, type WatchCrew, type WatchMinute, type WatchRun } from '@heatline/sim';
import { BrandMark } from '../components/BrandMark';
import { SITES } from '../planner/sites';
import { REPLAY_DAYS, REPLAY_SITE, crewsFor, evaluation, fetchReplayDay, fetchTelemetry, fetchToday, liveRun, replayRuns, type ReplayDay, type StationMode } from './data';
import './watch.css';

const LANGUAGE_LABELS: Record<Language, string> = { en: 'English', ar: 'العربية', hi: 'हिन्दी', ur: 'اردو', bn: 'বাংলা', ml: 'മലയാളം', tl: 'Tagalog' };
const RTL: Language[] = ['ar', 'ur'];
const SOURCE: Record<WatchMinute['source'], { label: string; tone: string }> = {
  station: { label: 'Site station', tone: 'good' },
  'station-stale': { label: 'Station delayed · +0.5 °C margin', tone: 'warn' },
  forecast: { label: 'Forecast only · +1 °C margin', tone: 'warn' },
};
const STATUS: Record<string, string> = { work: 'Working', rotate: 'Indoor rotation', rest: 'On break', off: 'Off shift', capped: 'Indoor work (cap)' };
const LEVEL_WORD: Record<WatchAlert['level'], string> = { info: 'Info', watch: 'Heads-up', act: 'Act', urgent: 'Urgent' };
const f1 = (x: number) => x.toFixed(1);
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;

type Mode = 'replay' | 'live';
interface Brief { headline: string; priorities: { crew: string; when: string; text: string }[]; trend: string; source: 'model' | 'rules'; model?: string; reason?: string }

const newSiteId = () => (crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-000000000000');
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function Watch({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(() => (window.location.hash.includes('live') ? 'live' : 'replay'));
  useEffect(() => {
    const title = document.title;
    document.title = 'Heatline · Site watch';
    return () => { document.title = title; };
  }, []);
  useEffect(() => { history.replaceState(null, '', mode === 'live' ? '#watch?live' : '#watch'); }, [mode]);

  return (
    <div className="watch">
      <header className="watch-top">
        <button className="watch-brand" onClick={onClose} aria-label="Back to Heatline home"><BrandMark /> Heatline</button>
        <span className="watch-tag">Site watch</span>
        <div className="watch-modes" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === 'replay'} className={mode === 'replay' ? 'on' : ''} onClick={() => setMode('replay')}>Replay a real day</button>
          <button role="tab" aria-selected={mode === 'live'} className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>Live today</button>
        </div>
        <button className="watch-back" onClick={onClose}>← Home</button>
      </header>
      {mode === 'replay' ? <Replay /> : <Live />}
    </div>
  );
}

// ---- Replay ---------------------------------------------------------------------------------

function Replay() {
  const [dayKey, setDayKey] = useState(REPLAY_DAYS[0]!.date);
  const [custom, setCustom] = useState<ReplayDay | null>(null);
  const [customDate, setCustomDate] = useState('2026-07-30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [station, setStation] = useState<StationMode>('on');
  const [policy, setPolicy] = useState<'follow' | 'fixed'>('follow');
  const [rotation, setRotation] = useState(true);
  const [minute, setMinute] = useState(600);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  const day = custom && custom.date === dayKey ? custom : REPLAY_DAYS.find((d) => d.date === dayKey) ?? REPLAY_DAYS[0]!;
  const runs = useMemo(() => replayRuns(day, station, rotation), [day, station, rotation]);
  const run = policy === 'follow' ? runs.follow : runs.fixed;
  const first = run.minutes[0]!.minute;
  const last = run.minutes[run.minutes.length - 1]!.minute;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setMinute((m) => (m >= last ? (setPlaying(false), m) : Math.min(last, m + 1))), 1000 / speed);
    return () => clearInterval(id);
  }, [playing, speed, last]);

  const loadCustom = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchReplayDay(customDate, REPLAY_SITE.latitude, REPLAY_SITE.longitude);
      setCustom(d);
      setDayKey(d.date);
      setMinute(600);
    } catch (e) {
      setError((e as Error).message || 'Could not load that day.');
    } finally {
      setLoading(false);
    }
  };

  const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  return (
    <main className="watch-main">
      <section className="watch-intro">
        <p className="watch-kicker">Live heat-stress monitoring · replayed on real weather</p>
        <h1>Breaks before the limit, not after it.</h1>
        <p>A WBGT station on the work area is fused with the forecast. Every minute, Heatline tracks each crew's last hour of heat and effort against the NIOSH limit, and announces the next break before the crew reaches it, with the reasons. Replay a real summer day: the forecast is the one issued the night before; the station reads the site.</p>
      </section>

      <div className="watch-controls">
        <div className="watch-days" role="group" aria-label="Day">
          {REPLAY_DAYS.map((d) => (
            <button key={d.date} className={dayKey === d.date ? 'on' : ''} onClick={() => { setDayKey(d.date); setMinute(600); setPlaying(false); }}>
              <b>{d.title}</b><small>{new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
            </button>
          ))}
          <div className="watch-custom">
            <label><span>Or any day since 2024</span><input type="date" min="2024-01-02" max={yesterday} value={customDate} onChange={(e) => setCustomDate(e.target.value)} /></label>
            <button onClick={loadCustom} disabled={loading}>{loading ? 'Loading…' : 'Load'}</button>
          </div>
        </div>
        <div className="watch-switches">
          <label><span>Site station</span>
            <select value={station} onChange={(e) => setStation(e.target.value as StationMode)}>
              <option value="on">Working all day</option>
              <option value="outage">Fails 09:00–12:00</option>
              <option value="none">None: forecast only</option>
            </select>
          </label>
          <label><span>Relief</span>
            <select value={rotation ? 'rotate' : 'rest'} onChange={(e) => setRotation(e.target.value === 'rotate')} disabled={policy === 'fixed'}>
              <option value="rotate">Rotate to indoor tasks, rest if needed</option>
              <option value="rest">Rest breaks only</option>
            </select>
          </label>
          <label><span>Crews</span>
            <select value={policy} onChange={(e) => setPolicy(e.target.value as 'follow' | 'fixed')}>
              <option value="follow">Follow Heatline's schedule</option>
              <option value="fixed">Keep a fixed 50/10 routine</option>
            </select>
          </label>
        </div>
      </div>
      {error && <p className="watch-error" role="alert">{error}</p>}
      <p className="watch-story"><b>{day.title}.</b> {day.story}</p>

      <div className="watch-player">
        <button className="watch-play" onClick={() => { if (minute >= last) setMinute(first); setPlaying(!playing); }} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button>
        <span className="watch-clock">{formatClock(minute)}</span>
        <input type="range" min={first} max={last} value={minute} onChange={(e) => { setMinute(Number(e.target.value)); }} aria-label="Time of day" />
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
          {[1, 4, 10, 30].map((s) => <option key={s} value={s}>{s} min/s</option>)}
        </select>
      </div>

      <Board run={run} minute={minute} date={day.date} onSeek={setMinute} rotation={rotation && policy === 'follow'} />
      <Outcome runs={runs} />
      <WatchEvidence />
    </main>
  );
}

function Outcome({ runs }: { runs: { follow: WatchRun; fixed: WatchRun } }) {
  const total = (r: WatchRun, k: 'overLimitMin' | 'workMin' | 'rotateMin' | 'shiftMin') => r.groups.reduce((s, g) => s + g[k] * g.headcount, 0);
  const productive = (r: WatchRun) => total(r, 'workMin') + total(r, 'rotateMin');
  const workers = runs.follow.groups.reduce((s, g) => s + g.headcount, 0);
  const breaks = runs.follow.groups.flatMap((g) => g.breaks);
  const announced = breaks.filter((b) => b.lead !== null && b.lead >= 10).length;
  return (
    <section className="watch-outcome" aria-label="How the day ends">
      <h3>How this day ends</h3>
      <div className="watch-outcome-grid">
        <div><span>Time over the heat limit, per worker</span><b>{Math.round(total(runs.follow, 'overLimitMin') / workers)} min</b><small>with Heatline's breaks, against {Math.round(total(runs.fixed, 'overLimitMin') / workers)} min on a fixed 50/10 routine</small></div>
        <div><span>Productive time, per worker</span><b>{Math.round(productive(runs.follow) / workers)} min</b><small>{total(runs.follow, 'rotateMin') ? `${Math.round(total(runs.follow, 'workMin') / workers)} on the main task and ${Math.round(total(runs.follow, 'rotateMin') / workers)} on indoor rotation; ` : ''}{Math.round(productive(runs.fixed) / workers)} min on the fixed routine</small></div>
        <div><span>Breaks announced at least 10 min ahead</span><b>{breaks.length ? Math.round((100 * announced) / breaks.length) : 0}%</b><small>{breaks.length} breaks across the crews today</small></div>
      </div>
      <p className="watch-note">"Over the limit" is measured on the site's real conditions, which the scheduler never sees. Site conditions are reanalysis weather plus stated site effects; the workers are the demonstration site's twenty. Across both summers: <a href="#watch-evidence" onClick={(ev) => { ev.preventDefault(); document.getElementById('watch-evidence')?.scrollIntoView({ behavior: 'smooth' }); }}>see the evaluation below</a>.</p>
    </section>
  );
}

// ---- Live -------------------------------------------------------------------------------------

function Live() {
  const [siteId, setSiteId] = useState(() => store.get('heatline-live-site') ?? 'saadiyat');
  const site = SITES.find((s) => s.id === siteId) ?? SITES[0];
  const [stationId, setStationId] = useState(() => store.get('heatline-station') ?? '');
  const [today, setToday] = useState<Awaited<ReturnType<typeof fetchToday>> | null>(null);
  const [readings, setReadings] = useState<StationReading[]>([]);
  const [csvReadings, setCsvReadings] = useState<StationReading[]>([]);
  const [csvNote, setCsvNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { store.set('heatline-live-site', siteId); }, [siteId]);
  useEffect(() => { if (stationId) store.set('heatline-station', stationId); }, [stationId]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60_000); return () => clearInterval(id); }, []);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchToday(site.latitude, site.longitude).then((d) => !cancelled && setToday(d)).catch((e: Error) => !cancelled && setError(e.message || 'The weather service could not be reached.'));
    return () => { cancelled = true; };
  }, [site.latitude, site.longitude, Math.floor(tick / 30)]);
  useEffect(() => {
    if (!stationId || !today) return;
    let cancelled = false;
    fetchTelemetry(stationId, today.date).then((r) => !cancelled && setReadings(r)).catch(() => !cancelled && setReadings([]));
    return () => { cancelled = true; };
  }, [stationId, today?.date, tick]);

  const now = useMemo(() => {
    const offset = today?.utcOffsetHours ?? 4;
    const d = new Date(Date.now() + offset * 3_600_000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }, [today, tick]);
  const result = useMemo(() => (today ? liveRun(today.date, today.weather, today.pm10, [...readings, ...csvReadings], site.latitude, site.longitude, today.utcOffsetHours) : null), [today, readings, csvReadings, site.latitude, site.longitude]);

  const importCsv = async (file: File) => {
    if (!today) return;
    const parsed = parseStationCsv(await file.text(), today.date);
    setCsvReadings(parsed.readings);
    setCsvNote(parsed.readings.length ? `${parsed.readings.length} readings for today imported (${[...new Set(parsed.columns)].join(', ')}). ${parsed.skipped ? `${parsed.skipped} rows from other days or unreadable were skipped.` : ''}` : `No readings for ${today.date} found. The file needs a time column and a WBGT column, or globe, natural wet-bulb and air temperature.`);
  };
  const origin = window.location.origin;
  const sample = `curl -X POST ${origin}/api/telemetry \\\n  -H 'content-type: application/json' -H 'x-heatline-site: ${stationId || '<station id>'}' \\\n  -d '{"readings":[{"at":"${today?.date ?? 'YYYY-MM-DD'}T${formatClock(now)}","wbgt":31.4,"ta":38.2,"rh":41,"tg":52.0,"pm10":120}]}'`;
  const onShift = result && now >= result.run.minutes[0]!.minute && now <= result.run.minutes[result.run.minutes.length - 1]!.minute;
  const shown = result ? Math.max(result.run.minutes[0]!.minute, Math.min(now, result.run.minutes[result.run.minutes.length - 1]!.minute)) : 0;

  return (
    <main className="watch-main">
      <section className="watch-intro">
        <p className="watch-kicker">Today · real forecast · your station</p>
        <h1>Watch a site now.</h1>
        <p>Pick a site. Heatline takes today's forecast and air quality, and readings from a WBGT station on the work area if you connect one. Without a station it says so and adds a safety margin. Outside the hot months the board simply shows that no breaks are needed.</p>
      </section>
      <div className="watch-controls">
        <div className="watch-switches">
          <label><span>Site</span>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>{SITES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          </label>
          <label className="watch-station-field"><span>Station ID</span>
            <span className="watch-inline">
              <input value={stationId} onChange={(e) => setStationId(e.target.value.trim())} placeholder="None connected" aria-label="Station ID" />
              <button onClick={() => setStationId(newSiteId())}>New</button>
            </span>
          </label>
          <label><span>Meter export</span>
            <span className="watch-inline"><button onClick={() => fileRef.current?.click()} disabled={!today}>Import CSV</button></span>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      {csvNote && <p className="watch-story">{csvNote}</p>}
      {error && <p className="watch-error" role="alert">{error}</p>}
      {!today && !error && <p className="watch-story" role="status">Fetching today's forecast for {site.label}…</p>}
      {result && today && (
        <>
          <p className="watch-story">
            <b>{new Date(`${today.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, {formatClock(now)} at the site.</b>{' '}
            {onShift ? 'On shift.' : now < result.run.minutes[0]!.minute ? `Shift starts at ${formatClock(result.run.minutes[0]!.minute)}; the board shows the start of the day.` : 'Shift over; the board shows the end of the day.'}{' '}
            {readings.length + csvReadings.length ? `${readings.length + csvReadings.length} station readings today${result.rejected ? `, ${result.rejected} rejected by quality checks` : ''}.` : 'No station readings today, so the forecast is used with a 1 °C safety margin.'}
          </p>
          <Board run={result.run} minute={shown} date={today.date} />
        </>
      )}
      <details className="watch-connect">
        <summary>Connect a WBGT station</summary>
        <p>Any meter or gateway that can send HTTPS can post readings once a minute. Each site has a random station ID; anyone holding it can post and read that site's readings, so treat it like a password. Send a WBGT value, or globe, natural wet-bulb and air temperature (WBGT is then worked out with ISO 7243). Readings are checked for missing values, impossible numbers, duplicates and sudden jumps before use.</p>
        <pre>{sample}</pre>
        <p>Meters that only export files (for example a Kestrel heat-stress meter through its app) can use <b>Import CSV</b> above. To try it without a meter, run <code>npm run station:sim -- --site {stationId || '<station id>'}</code> from the repository.</p>
      </details>
    </main>
  );
}

// ---- The board --------------------------------------------------------------------------------

function Board({ run, minute, date, onSeek, rotation = true }: { run: WatchRun; minute: number; date: string; onSeek?: (m: number) => void; rotation?: boolean }) {
  const rec = run.minutes.find((m) => m.minute === minute) ?? run.minutes[run.minutes.length - 1]!;
  const crews = useMemo(() => crewsFor(date, rotation), [date, rotation]);
  const visible = run.alerts.filter((a) => a.minute <= minute);
  const [alarmsOnly, setAlarmsOnly] = useState(false);
  const feed = visible.filter((a) => !alarmsOnly || a.level === 'act' || a.level === 'urgent').slice(-40).reverse();
  const source = SOURCE[rec.source];
  const dust = DUST_ADVICE[rec.dust];
  return (
    <div className="watch-board">
      <section className="watch-strip" aria-label="Conditions now">
        <div className="watch-card">
          <span>Heat now, in the sun</span>
          <b>{f1(rec.estimate.sun)} °C</b>
          <small>WBGT · {f1(rec.estimate.shade)} °C in shade</small>
          <em className={`watch-badge ${source.tone}`}>{source.label}</em>
        </div>
        <div className="watch-card">
          <span>Site against the forecast</span>
          <b>{rec.source === 'forecast' ? '—' : `${signed(rec.bias)} °C`}</b>
          <small>{rec.source === 'forecast' ? 'No live readings to compare' : `Forecast ${f1(rec.forecast.sun)} °C, station ${rec.station !== null ? f1(rec.station) : '—'} °C`}</small>
        </div>
        <div className={`watch-card dust-${rec.dust}`}>
          <span>Dust</span>
          <b>{rec.pm10 === null ? '—' : `${Math.round(rec.pm10)} µg/m³`}</b>
          <small>PM10 · {rec.dust === 'clear' ? 'no measures needed' : dust.title.toLowerCase()}</small>
        </div>
        <div className="watch-card">
          <span>Alerts so far today</span>
          <b>{visible.filter((a) => a.level === 'act' || a.level === 'urgent').length} to act on</b>
          <small>{visible.filter((a) => a.kind === 'break-soon').length} breaks announced ahead</small>
        </div>
      </section>

      <div className="watch-grid">
        <div className="watch-left">
          <section className="watch-panel">
            <h3>Heat through the day</h3>
            <HeatChart run={run} minute={minute} onSeek={onSeek} />
          </section>
          <section className="watch-panel">
            <h3>Crews</h3>
            <p className="watch-sub">Each bar is the crew's last hour of heat and effort as a share of its NIOSH limit. The scheduler sends the crew to rest before the bar reaches 100%.</p>
            <div className="watch-crews">{crews.map((c) => <CrewCard key={c.id} crew={c} rec={rec} />)}</div>
          </section>
          <NoorPanel run={run} minute={minute} crews={crews} />
          <ShiftRecordPanel run={run} minute={minute} crews={crews} />
          <Privacy />
        </div>
        <section className="watch-panel watch-feed" aria-label="Alerts">
          <div className="watch-feed-head">
            <h3>Alerts</h3>
            <label className="watch-check"><input type="checkbox" checked={alarmsOnly} onChange={(e) => setAlarmsOnly(e.target.checked)} /> Only alerts to act on</label>
          </div>
          {!feed.length && <p className="watch-sub">Nothing yet. Breaks are announced up to 15 minutes ahead.</p>}
          <ol>{feed.map((a) => <AlertCard key={a.id} alert={a} now={minute} crews={crews} />)}</ol>
        </section>
      </div>
    </div>
  );
}

function CrewCard({ crew, rec }: { crew: WatchCrew; rec: WatchMinute }) {
  const groups = rec.groups.filter((g) => g.crew === crew.id);
  const rest = groups.some((g) => g.restPlace === 'cool-room') ? 'cool-room' : crew.rest;
  return (
    <div className="watch-crew">
      <div className="watch-crew-head">
        <span className="watch-crew-badge">{crew.id}</span>
        <div><b>{crew.label}</b><small>{crewTask(crew)} · rests in {rest === 'cool-room' ? 'cooled room' : 'shade'}{rest !== crew.rest ? ' (moved from shade)' : ''}{crew.clothingAdjustC ? ` · coveralls (+${crew.clothingAdjustC} °C)` : ''}{crew.rotation ? ` · rotates to ${crew.rotation.label}` : ''}</small></div>
      </div>
      {groups.map((g) => {
        // Only a real breach shows 100% or more: 99.6% under the limit reads 99%.
        const pct = limitShare(g.ratio);
        const tone = g.ratio > 1 ? 'over' : g.ratio >= 0.9 ? 'near' : 'ok';
        return (
          <div key={g.tier} className="watch-group">
            {crew.groups.length > 1 && <small className="watch-tier">{g.tier === 'standard' ? 'Acclimatised workers' : 'Workers on the new-worker limit'}</small>}
            <div className="watch-gauge" role="meter" aria-valuemin={0} aria-valuemax={120} aria-valuenow={pct} aria-label={`Crew ${crew.id} heat exposure ${pct}% of limit`}>
              <i className={tone} style={{ width: `${Math.min(100, (pct / 120) * 100)}%` }} />
              <span className="watch-limit" style={{ left: `${(100 / 120) * 100}%` }} />
            </div>
            <div className="watch-group-line">
              <span className={`watch-status s-${g.status}`}>{STATUS[g.status]}</span>
              <span>{pct}% of limit</span>
              <span>{g.status === 'work' && g.nextBreak ? `${g.nextBreak.mode === 'rotate' ? 'Rotate' : 'Break'} ${formatClock(g.nextBreak.at)} for ${g.nextBreak.forMin} min` : g.status === 'work' ? 'No break due in 90 min' : g.status === 'capped' ? `Heat-time cap reached (${g.heatMin} min)` : g.resumeAt ? `Back on the main task about ${formatClock(g.resumeAt)}` : ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
const crewTask = (c: WatchCrew) => ({ rebar: 'Rebar tying, heavy', concrete: 'Concrete placing, heavy', facade: 'Façade fixing, moderate' } as Record<string, string>)[c.taskId] ?? c.taskId;

function AlertCard({ alert, now, crews }: { alert: WatchAlert; now: number; crews: WatchCrew[] }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Language>('bn');
  const rest = crews.find((c) => c.id === alert.crew)?.rest ?? 'cool-room';
  const crewText = broadcast(alert, lang, /cooled room/.test(alert.action) ? 'cool-room' : rest);
  return (
    <li className={`watch-alert l-${alert.level}`}>
      <button className="watch-alert-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="watch-alert-time">{formatClock(alert.minute)}{now - alert.minute < 2 ? <em>new</em> : null}</span>
        <span className="watch-alert-level">{LEVEL_WORD[alert.level]}</span>
        <b>{alert.title}</b>
        <span className="watch-alert-action">{alert.action}</span>
        <span className="watch-alert-why">{open ? 'Hide why' : 'Why?'}</span>
      </button>
      {open && (
        <div className="watch-alert-body">
          <ol className="watch-why">{alert.why.map((w, i) => <li key={i}>{w}</li>)}</ol>
          {alert.projection && <Projection points={alert.projection} />}
          {broadcast(alert, 'en') && (
            <div className="watch-broadcast">
              <div className="watch-langs" role="tablist" aria-label="Crew broadcast language">
                {BROADCAST_LANGUAGES.map((l) => <button key={l} role="tab" aria-selected={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{LANGUAGE_LABELS[l]}</button>)}
              </div>
              <p lang={lang} dir={RTL.includes(lang) ? 'rtl' : 'ltr'}>{crewText}</p>
              <small>Sent to the crew's phones as written; draft translation.</small>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Projected share of the limit over the next hour: following the break, and working straight on. */
function Projection({ points }: { points: { minute: number; withAction: number; without: number }[] }) {
  const W = 320, H = 120, pad = { l: 34, r: 10, t: 10, b: 22 };
  const max = Math.max(1.1, ...points.map((p) => p.without));
  const min = Math.min(0.8, ...points.map((p) => p.withAction));
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (Math.min(v, max) - min) / (max - min)) * (H - pad.t - pad.b);
  const line = (k: 'withAction' | 'without') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(' ');
  return (
    <figure className="watch-projection">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected heat exposure over the next hour, with and without the break">
        <line className="p-limit" x1={pad.l} x2={W - pad.r} y1={y(1)} y2={y(1)} />
        <text className="p-tick" x={pad.l - 5} y={y(1) + 4} textAnchor="end">100%</text>
        <path className="p-without" d={line('without')} />
        <path className="p-with" d={line('withAction')} />
        <text className="p-tick" x={pad.l} y={H - 6}>{formatClock(points[0]!.minute)}</text>
        <text className="p-tick" x={W - pad.r} y={H - 6} textAnchor="end">{formatClock(points[points.length - 1]!.minute)}</text>
      </svg>
      <figcaption><span className="k-with">With the break</span> <span className="k-without">Working straight on</span></figcaption>
    </figure>
  );
}

function HeatChart({ run, minute, onSeek }: { run: WatchRun; minute: number; onSeek?: (m: number) => void }) {
  const W = 720, H = 210, pad = { l: 36, r: 112, t: 12, b: 26 };
  const ms = run.minutes;
  const from = ms[0]!.minute, to = ms[ms.length - 1]!.minute;
  const vals = ms.flatMap((m) => [m.forecast.sun, m.estimate.sun, m.station ?? m.forecast.sun]);
  const lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  const x = (m: number) => pad.l + ((m - from) / (to - from)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const step = 5;
  const path = (pick: (m: WatchMinute) => number | null, until = to) => {
    let d = '', pen = false;
    for (let i = 0; i < ms.length; i += step) {
      const m = ms[i]!;
      if (m.minute > until) break;
      const v = pick(m);
      if (v === null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(m.minute).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const ticks: number[] = [];
  for (let v = Math.ceil(lo); v <= hi; v += hi - lo > 8 ? 2 : 1) ticks.push(v);
  const breaks = ms.filter((m) => m.groups.every((g) => g.status === 'off'));
  const breakFrom = breaks.find((m) => m.minute > from + 60)?.minute;
  const breakTo = breakFrom !== undefined ? breaks.filter((m) => m.minute >= breakFrom).slice(-1)[0]?.minute : undefined;
  const seek = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    onSeek(Math.round(Math.max(from, Math.min(to, from + ((px - pad.l) / (W - pad.l - pad.r)) * (to - from)))));
  };
  return (
    <svg className="watch-chart" viewBox={`0 0 ${W} ${H}`} onClick={seek} role="img" aria-label="WBGT in the sun through the day: forecast issued the day before, station readings, and the scheduler's estimate">
      {breakFrom !== undefined && breakTo !== undefined && <rect className="c-break" x={x(breakFrom)} y={pad.t} width={x(breakTo) - x(breakFrom)} height={H - pad.t - pad.b} />}
      {breakFrom !== undefined && breakTo !== undefined && <text className="c-note" x={(x(breakFrom) + x(breakTo)) / 2} y={pad.t + 12} textAnchor="middle">Midday break</text>}
      {ticks.map((v) => <g key={v}><line className="c-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} /><text className="c-tick" x={pad.l - 6} y={y(v) + 4} textAnchor="end">{v}°</text></g>)}
      {[360, 540, 720, 900, 1080].filter((m) => m >= from && m <= to).map((m) => <text key={m} className="c-tick" x={x(m)} y={H - 7} textAnchor="middle">{formatClock(m)}</text>)}
      <path className="c-forecast" d={path((m) => m.forecast.sun)} />
      <path className="c-station" d={path((m) => m.station, minute)} />
      <path className="c-estimate" d={path((m) => m.estimate.sun, minute)} />
      <line className="c-now" x1={x(minute)} x2={x(minute)} y1={pad.t} y2={H - pad.b} />
      <text className="c-label forecast" x={W - pad.r + 8} y={pad.t + 14}>Forecast</text>
      <text className="c-label station" x={W - pad.r + 8} y={pad.t + 30}>Station</text>
      <text className="c-label estimate" x={W - pad.r + 8} y={pad.t + 46}>Heatline's estimate</text>
    </svg>
  );
}

/** Briefs already written, kept across re-renders and scrubbing so a moment is never briefed twice. */
const briefCache = new Map<string, Brief & { at: number; reason: string }>();

function NoorPanel({ run, minute, crews }: { run: WatchRun; minute: number; crews: WatchCrew[] }) {
  const [auto, setAuto] = useState(true);
  const [log, setLog] = useState<(Brief & { at: number; reason: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const runKey = `${run.date}|${run.alerts.length}|${run.groups.map((g) => g.workMin + g.rotateMin).join(',')}`;
  const triggers = useMemo(() => noorTriggers(run), [run]);

  const brief = async (at: number, reason: string) => {
    const key = `${runKey}|${at}`;
    const cached = briefCache.get(key);
    if (cached) return cached;
    let out: Brief & { at: number; reason: string };
    try {
      const r = await fetch('/api/watch-brief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(watchContext(run, at, crews)), signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(String(r.status));
      out = { ...((await r.json()) as Brief), at, reason };
    } catch {
      out = { headline: 'Noor is unavailable. The alerts are complete without her.', priorities: [], trend: '', source: 'rules', at, reason };
    }
    briefCache.set(key, out);
    return out;
  };

  // Rebuild the log for this run and time: cached briefs for every trigger already passed.
  useEffect(() => {
    setLog(triggers.filter((t) => t.minute <= minute).map((t) => briefCache.get(`${runKey}|${t.minute}`)).filter((x): x is NonNullable<typeof x> => !!x).reverse());
  }, [runKey, minute, triggers]);

  // On watch: brief the most recent trigger passed that has no brief yet. One request at a time.
  useEffect(() => {
    if (!auto || busy) return;
    const due = [...triggers].reverse().find((t) => t.minute <= minute && minute - t.minute <= 30 && !briefCache.has(`${runKey}|${t.minute}`));
    if (!due) return;
    setBusy(true);
    void brief(due.minute, due.reason).then(() => setLog((l) => [...l])).finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, busy, minute, triggers, runKey]);

  const askNow = async () => {
    setBusy(true);
    await brief(minute, 'Asked by the supervisor');
    setLog((l) => [briefCache.get(`${runKey}|${minute}`)!, ...l.filter((x) => x.at !== minute)]);
    setBusy(false);
  };

  return (
    <section className="watch-panel watch-noor">
      <div className="watch-feed-head">
        <h3>Noor on watch</h3>
        <div className="watch-inline">
          <label className="watch-check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Brief automatically</label>
          <button onClick={askNow} disabled={busy}>{busy ? 'Noor is reading the board…' : `Ask now (${formatClock(minute)})`}</button>
        </div>
      </div>
      <p className="watch-sub">Noor reads the crew-level board and briefs the supervisor on her own whenever something significant changes: an alert to act on, the station dropping or returning, the site running hotter than forecast, dust, a crew moved to the cooled room, a heat-time cap. She cannot change a break: her answer is checked and replaced with the rules' summary if it mentions a time, crew or name not on the board.</p>
      {!log.length && <p className="watch-sub">{auto ? `Next brief at the next significant change${triggers.find((t) => t.minute > minute) ? ` (around ${formatClock(triggers.find((t) => t.minute > minute)!.minute)})` : ''}.` : 'Automatic briefs are off.'}</p>}
      <ol className="watch-noor-log">
        {log.slice(0, 6).map((b) => (
          <li key={b.at} className="watch-brief">
            <small className="watch-brief-why">{formatClock(b.at)} · {b.reason}</small>
            <p className="watch-brief-head">{b.headline}</p>
            {b.priorities.length > 0 && <ol>{b.priorities.map((p, i) => <li key={i}><em>{p.crew === 'site' ? 'Site' : `Crew ${p.crew}`} · {p.when}</em> {p.text}</li>)}</ol>}
            {b.trend && <p className="watch-sub">{b.trend}</p>}
            <small>{b.source === 'model' ? `Written by ${b.model}, checked against the board` : `Rules summary${b.reason ? '' : ''}`}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface Record_ { summary: string; wentWell: string[]; concerns: string[]; forTomorrow: string[]; source: 'model' | 'rules'; model?: string; reason?: string }

/** The shift recorder: drafts the end-of-shift heat-safety record from the crew-level day. */
function ShiftRecordPanel({ run, minute, crews }: { run: WatchRun; minute: number; crews: WatchCrew[] }) {
  const [record, setRecord] = useState<(Record_ & { at: number; summaryData: ReturnType<typeof shiftSummary> }) | null>(null);
  const [busy, setBusy] = useState(false);
  const end = run.minutes[run.minutes.length - 1]!.minute;
  const draft = async () => {
    setBusy(true);
    const data = shiftSummary(run, crews, minute);
    try {
      const r = await fetch('/api/shift-report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(String(r.status));
      setRecord({ ...((await r.json()) as Record_), at: minute, summaryData: data });
    } catch {
      setRecord({ summary: 'The recorder is unavailable. The figures below are complete without it.', wentWell: [], concerns: [], forTomorrow: [], source: 'rules', at: minute, summaryData: data });
    } finally {
      setBusy(false);
    }
  };
  const text = record ? [
    `Heat-safety record · ${record.summaryData.date} · ${record.summaryData.from}–${record.summaryData.to}`, '', record.summary, '',
    'What went well:', ...record.wentWell.map((x) => `- ${x}`), '', 'Concerns:', ...(record.concerns.length ? record.concerns.map((x) => `- ${x}`) : ['- None recorded']), '',
    'For tomorrow:', ...record.forTomorrow.map((x) => `- ${x}`), '',
    'Crew figures (scheduler estimates):',
    ...record.summaryData.groups.map((g) => `- Crew ${g.crew}${g.workers === 'whole crew' ? '' : ` (${g.workers})`}: ${g.mainTaskMin} min main task, ${g.indoorRotationMin} min indoor rotation, ${g.restMin} min rest, ${g.minutesOverLimitEstimated} min estimated over the limit, peak ${g.peakLimitSharePct}%`),
    '', 'Drafted by Heatline for review. Not a safety certificate. Signed: ______________',
  ].join('\n') : '';
  return (
    <section className="watch-panel watch-record">
      <div className="watch-feed-head">
        <h3>Shift record</h3>
        <button onClick={draft} disabled={busy}>{busy ? 'Drafting…' : minute >= end ? 'Draft the end-of-shift record' : `Draft the record so far (${formatClock(minute)})`}</button>
      </div>
      <p className="watch-sub">The recorder writes the day's heat-safety record for the site file from crew-level figures: conditions, breaks, rotations, station gaps, dust and anything over the limit. Every number in the draft must come from those figures, or the rules write the record instead. A manager reviews and signs it.</p>
      {record && (
        <div className="watch-brief">
          <p className="watch-brief-head">{record.summary}</p>
          {record.wentWell.length > 0 && <><b className="watch-record-h">What went well</b><ul>{record.wentWell.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          <b className="watch-record-h">Concerns</b>
          {record.concerns.length ? <ul>{record.concerns.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="watch-sub">None recorded.</p>}
          {record.forTomorrow.length > 0 && <><b className="watch-record-h">For tomorrow</b><ul>{record.forTomorrow.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          <div className="watch-briefing-actions">
            <button onClick={() => { void navigator.clipboard?.writeText(text).catch(() => undefined); }}>Copy record</button>
            <small>{formatClock(record.at)} · {record.source === 'model' ? `Drafted by ${record.model}; every number checked against the figures` : `Written by the rules${record.reason ? ` (${record.reason})` : ''}`}</small>
          </div>
        </div>
      )}
    </section>
  );
}

function Privacy() {
  return (
    <section className="watch-panel watch-privacy">
      <h3>What this board knows, and what it never receives</h3>
      <div className="watch-privacy-grid">
        <div>
          <b>Receives</b>
          <ul>
            <li>Weather forecast and air quality for the site</li>
            <li>Station readings from the work area (heat, humidity, radiant heat, dust)</li>
            <li>Each crew's task, work area, rest area and clothing</li>
            <li>How many workers are on the new-worker limit, from days worked in the heat (work history, not health data)</li>
          </ul>
        </div>
        <div>
          <b>Never receives</b>
          <ul>
            <li>Names, on any alert or screen</li>
            <li>Body temperature, heart rate, symptoms or wearable data: those stay on the worker's own phone</li>
            <li>Where any individual is</li>
            <li>Anything that could rank or discipline a person</li>
          </ul>
        </div>
      </div>
      <p className="watch-note">The same exposure applies to everyone doing the same task in the same place, so crew-level alerts lose nothing. An automated test checks every alert and every minute of a day for names and body readings.</p>
    </section>
  );
}

/** Two summers, five ways of running the same crews. From data/watch/evaluation.json (npm run eval:watch). */
export function WatchEvidence() {
  const e = evaluation;
  const s = Object.fromEntries(e.strategies.map((x) => [x.id, x]));
  return (
    <section id="watch-evidence" className="watch-panel watch-evidence">
      <h3>Across two summers: {e.days} real days</h3>
      <p className="watch-sub">Every day from 15 June to 15 September, 2025 and 2026, with the same three crews. The scheduler only ever sees the forecast issued the day before and, when present, the station. "Over the limit" is measured on the site's actual conditions.</p>
      <div className="watch-table-wrap">
        <table>
          <thead><tr><th>How breaks are timed</th><th>Time over the limit</th><th>Over the limit, per worker a day</th><th>Productive time, per worker a day</th><th>Breaks announced ≥10 min ahead</th><th>Alerts to act on, per day</th></tr></thead>
          <tbody>
            {e.strategies.map((x) => (
              <tr key={x.id} className={x.id === 'live+rotation' ? 'best' : ''}>
                <td>{x.label}</td><td>{x.overLimitSharePct}%</td><td>{x.overLimitMinPerWorkerDay} min</td><td>{x.productiveMinPerWorkerDay} min{x.rotateMinPerWorkerDay ? <small> incl. {x.rotateMinPerWorkerDay} indoor</small> : null}</td><td>{x.breaksAnnounced10Pct === null ? '—' : `${x.breaksAnnounced10Pct}%`}</td><td>{x.alarmsPerDay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="watch-evidence-notes">
        <p><b>Why live readings matter.</b> With only the forecast, crews were over the limit {s.forecast!.overLimitSharePct}% of the time. Heatline's 1 °C margin cuts that to {s['forecast+1']!.overLimitSharePct}% but costs work. With a station, it falls to {s.live!.overLimitSharePct}% while crews work {s.live!.workMinPerWorkerDay} minutes a day, more than with the margin. When the station fails for three hours a day, the fallback keeps it at {s['live-outage']!.overLimitSharePct}%.</p>
        <p><b>Rotation keeps the work going.</b> Rest-only breaks cost time: {s.live!.productiveMinPerWorkerDay} productive minutes a day against {s.routine!.productiveMinPerWorkerDay} on the fixed routine. Rotating crews to indoor tasks in a cooled workshop before resting brings it to {s['live+rotation']!.productiveMinPerWorkerDay} minutes, with time over the limit at {s['live+rotation']!.overLimitSharePct}%. Rotation to tasks in shade is rarely possible in this heat: shade alone is above the limit for steady work, and the scheduler only rotates to a task that is itself within its limit.</p>
        <p><b>The forecast itself.</b> Against reanalysis, the day-ahead forecast of WBGT in the sun was off by {e.forecastSkill.meanAbsErrorC} °C on average and too cool by more than 1 °C in {e.forecastSkill.coolerBy1Pct}% of working hours. The shift planner built on it allowed more heavy work than the real weather would in {e.dayAheadPlan.tooGenerousPct}% of hours, and in {e.dayAheadPlan.tooGenerousWithMarginPct}% with a 1 °C margin.</p>
        <p><b>Dust.</b> In {e.dust.shiftHours.toLocaleString('en-GB')} shift hours, modelled PM10 was elevated in {e.dust.elevatedHours}, unhealthy in {e.dust.unhealthyHours} and severe in {e.dust.severeHours}.</p>
        <p><b>Assumptions.</b> {e.assumptions} The forecast and reanalysis are real archives from Open-Meteo; the site effects and the station noise are not measurements.</p>
      </div>
    </section>
  );
}
