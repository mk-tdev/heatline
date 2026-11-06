import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { crewSummaries, guardianContext, redFlagDisclosures, type GuardianMessage, type SafetyBrief } from '@heatline/agents';
import { dubaiFlag } from '@heatline/climate';
import { formatClock } from '@heatline/contracts';
import { Site } from './scene/Site';
import { CrewCards, DecisionCard, NoorBrief, RedFlags, SiteLog, type DecisionState } from './components/Console';
import { Phone } from './components/Phone';
import { Compare } from './components/Compare';
import { DECISION_AT, FEATURED, askGuardian, askPlanner, askSafety, health, loadWorld, runBranch, type AgentSource, type Branch, type Health } from './model';

const SPEEDS = [1, 2, 4, 8]; // simulated minutes per real second
const DEFAULT_ASK = 'The concrete truck is booked for 15:30. Can we still pour today without putting anyone at risk?';

export function App() {
  const world = useMemo(() => loadWorld(), []);
  const { scenario } = world;
  const original = useMemo(() => runBranch(world, 'original', 'Original schedule'), [world]);
  const [planBranch, setPlanBranch] = useState<Branch | null>(null);
  const [active, setActive] = useState<Branch['id']>('original');
  const branch = active === 'plan' && planBranch ? planBranch : original;

  const [minute, setMinute] = useState(scenario.start);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [decided, setDecided] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [selected, setSelected] = useState<string>('anwar');
  const [viewKey, setViewKey] = useState(0);
  const [ai, setAi] = useState<Health>({ ai: false, model: null });
  const [decision, setDecision] = useState<DecisionState>({ ask: DEFAULT_ASK, events: [], running: false });

  useEffect(() => void health().then(setAi), []);

  // ---- Playback ------------------------------------------------------------------------------
  const clock = useRef({ last: 0, carry: 0 });
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    clock.current.last = performance.now();
    const step = (now: number) => {
      const dt = (now - clock.current.last) / 1000;
      clock.current.last = now;
      clock.current.carry += dt * speed;
      if (clock.current.carry >= 1) {
        const advance = Math.floor(clock.current.carry);
        clock.current.carry -= advance;
        setMinute((m) => {
          let next = Math.min(scenario.end - 1, m + advance);
          if (!decided && m < DECISION_AT && next >= DECISION_AT) {
            next = DECISION_AT;
            setPlaying(false);
            setShowDecision(true);
          }
          if (next >= scenario.end - 1) setPlaying(false);
          return next;
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, decided, scenario.end]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (!showDecision) setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDecision]);

  const record = branch.run.minutes[Math.min(branch.run.minutes.length - 1, minute - scenario.start)]!;
  const crews = useMemo(() => crewSummaries(scenario, record), [scenario, record]);
  const flags = useMemo(() => redFlagDisclosures(scenario, record), [scenario, record]);
  const activePlan = branch.plan && minute >= branch.plan.effectiveAt ? branch.plan : null;

  // ---- Noor: a crew-level brief every 20 simulated minutes and at the decision ---------------
  const [brief, setBrief] = useState<(SafetyBrief & AgentSource & { clock: string }) | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const lastBrief = useRef(-1);
  useEffect(() => {
    const slot = minute === DECISION_AT ? DECISION_AT : Math.floor((minute - scenario.start) / 20) * 20 + scenario.start;
    const key = slot * 10 + (active === 'plan' ? 1 : 0);
    if (key === lastBrief.current || briefLoading) return;
    lastBrief.current = key;
    setBriefLoading(true);
    const at = formatClock(minute);
    askSafety(at, crews)
      .then((b) => setBrief({ ...b, clock: at }))
      .catch(() => {})
      .finally(() => setBriefLoading(false));
  }, [minute, crews, active, scenario.start, briefLoading]);

  // ---- Guardian: the selected worker's phone, refreshed when their level or action changes ---
  const ctx = useMemo(() => guardianContext(scenario, record, selected), [scenario, record, selected]);
  const [messages, setMessages] = useState<Record<string, GuardianMessage & AgentSource>>({});
  const [guardianLoading, setGuardianLoading] = useState(false);
  const guardianKey = `${active}:${selected}:${ctx.level}:${ctx.action}`;
  const pending = useRef(new Set<string>());
  useEffect(() => {
    if (messages[guardianKey] || pending.current.has(guardianKey)) return;
    pending.current.add(guardianKey);
    setGuardianLoading(true);
    askGuardian(ctx)
      .then((m) => setMessages((all) => ({ ...all, [guardianKey]: m })))
      .catch(() => {})
      .finally(() => {
        pending.current.delete(guardianKey);
        setGuardianLoading(pending.current.size > 0);
      });
  }, [guardianKey, ctx, messages]);
  const lastMessage = useRef<(GuardianMessage & AgentSource) | null>(null);
  if (messages[guardianKey]) lastMessage.current = messages[guardianKey]!;
  const shownMessage = messages[guardianKey] ?? (lastMessage.current && guardianKey.startsWith(`${active}:${selected}:`) ? lastMessage.current : null);

  // ---- Decision ------------------------------------------------------------------------------
  const ask = useCallback(() => {
    setDecision((d) => ({ ...d, events: [], running: true, error: undefined }));
    askPlanner({ date: scenario.date, effectiveAt: DECISION_AT, unavailable: [], ask: decision.ask }, (e) => setDecision((d) => ({ ...d, events: [...d.events, e] })))
      .catch((err: Error) => setDecision((d) => ({ ...d, error: `Planner unavailable: ${err.message}` })))
      .finally(() => setDecision((d) => ({ ...d, running: false })));
  }, [decision.ask, scenario.date]);

  const approve = useCallback(() => {
    const final = decision.events.find((e) => e.type === 'final');
    if (!final || final.type !== 'final' || !final.check.ok) return;
    const plan = final.check.plan;
    setPlanBranch(runBranch(world, 'plan', 'Omar’s plan, approved', [{ at: DECISION_AT, plan }], plan));
    setActive('plan');
    setDecided(true);
    setShowDecision(false);
    setPlaying(true);
  }, [decision.events, world]);

  const keep = useCallback(() => {
    setActive('original');
    setDecided(true);
    setShowDecision(false);
    setPlaying(true);
  }, []);

  const watch = (id: Branch['id']) => {
    setActive(id);
    setMinute(DECISION_AT);
    setShowCompare(false);
    setPlaying(true);
  };

  const restart = () => {
    setMinute(scenario.start);
    setActive('original');
    setDecided(false);
    setShowDecision(false);
    setPlaying(true);
  };

  // ---- Derived scene state -------------------------------------------------------------------
  const started = branch.run.pourStartedAt;
  const finished = branch.run.pourFinishedAt;
  const pourProgress = started === null || minute < started ? 0 : finished !== null && minute >= finished ? 1 : Math.min(0.97, (minute - started) / (finished ? finished - started : scenario.pour.durationMin * 1.5));
  const truckOnSite = minute >= scenario.pour.truckArrives && (finished === null || minute < finished + 8);
  const env = record.env;
  const flag = dubaiFlag(env.heatIndex);
  const markers = original.run.events.filter((e) => ['truck-arrived', 'battery-died', 'network-down', 'weather-modifier'].includes(e.kind));
  const redMarkers = branch.run.events.filter((e) => e.kind === 'red-flag');
  const featured = FEATURED.map((id) => scenario.workers.find((w) => w.id === id)!);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">⌁</span> Heatline <small>Saadiyat Tower · Level 12 pour</small>
        </div>
        <div className="clock">
          <b>{formatClock(minute)}</b>
          <small>Tue 19 Aug 2025 · real weather</small>
        </div>
        <div className="stat">
          <span>WBGT sun / shade</span>
          <b>
            {env.wbgtSun.toFixed(1)} / {env.wbgtShade.toFixed(1)}°C
          </b>
        </div>
        <div className="stat">
          <span>Feels like (heat index)</span>
          <b>
            {env.heatIndex.toFixed(0)}°C <span className={`flag flag-${flag}`}>{flag}</span>
          </b>
        </div>
        <div className="stat">
          <span>Midday break</span>
          <b>ended 15:00</b>
        </div>
        <div className="stat">
          <span>Site network</span>
          <b className={record.networkUp ? '' : 'bad'}>{record.networkUp ? 'up' : 'down · phones on local rules'}</b>
        </div>
        <div className={`ai ${ai.ai ? 'on' : ''}`}>{ai.ai ? `AI: ${ai.model}` : 'AI off · rules only'}</div>
        <div className="top-actions">
          <button onClick={() => setShowCompare(true)} disabled={!planBranch}>
            Rewind & compare
          </button>
          <button onClick={restart}>Restart</button>
        </div>
      </header>

      <main className="stage">
        <Site scenario={scenario} record={record} plan={activePlan} pourProgress={pourProgress} truckOnSite={truckOnSite} selectedWorker={selected} redFlagWorkers={flags.map((f) => f.worker)} viewKey={viewKey} />
        <div className="branch-tag">{branch.label}</div>
        <button className="view-reset" onClick={() => setViewKey((k) => k + 1)}>
          Reset view
        </button>
      </main>

      <aside className="console">
        <RedFlags flags={flags} />
        {showDecision && <DecisionCard state={decision} onAsk={ask} onApprove={approve} onKeep={keep} setAsk={(s) => setDecision((d) => ({ ...d, ask: s }))} />}
        <NoorBrief brief={brief} loading={briefLoading} />
        <CrewCards crews={crews} />
        <SiteLog events={branch.run.events} minute={minute} />
      </aside>

      <Phone workers={featured} selected={selected} onSelect={setSelected} ctx={ctx} message={shownMessage} loading={guardianLoading} stale={!messages[guardianKey]} />

      <footer className="timeline">
        <button className="play" onClick={() => !showDecision && setPlaying((p) => !p)} disabled={showDecision}>
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button key={s} className={s === speed ? 'active' : ''} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <div className="track">
          <input
            type="range"
            min={scenario.start}
            max={scenario.end - 1}
            value={minute}
            onChange={(e) => {
              const m = Number(e.target.value);
              if (!decided && m > DECISION_AT) return setMinute(DECISION_AT);
              setMinute(m);
            }}
          />
          <div className="marks">
            {[...markers, ...redMarkers].map((e) => (
              <span key={e.id} className={`mark ${e.kind}`} style={{ left: `${((e.minute - scenario.start) / (scenario.end - 1 - scenario.start)) * 100}%` }} title={`${formatClock(e.minute)} ${e.detail}`} />
            ))}
            <span className="mark decision" style={{ left: `${((DECISION_AT - scenario.start) / (scenario.end - 1 - scenario.start)) * 100}%` }} title="15:10 decision" />
          </div>
          <div className="ticks">
            {[900, 930, 960, 990, 1020, 1050, 1079].map((m) => (
              <span key={m}>{formatClock(m === 1079 ? 1080 : m)}</span>
            ))}
          </div>
        </div>
        <small className="disclaimer">Simulation with a teaching physiology model and real ERA5 weather. Not clinical advice.</small>
      </footer>

      {showCompare && planBranch && <Compare a={original} b={planBranch} onClose={() => setShowCompare(false)} onWatch={watch} />}
    </div>
  );
}
