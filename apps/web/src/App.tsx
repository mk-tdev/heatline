import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dialogueFor } from './dialogue';
import { fallbackGuardianMessage, crewSummaries, guardianContext, redFlagDisclosures, type GuardianMessage, type SafetyBrief } from '@heatline/agents';
import { dubaiFlag } from '@heatline/climate';
import { formatClock } from '@heatline/contracts';
import { Site } from './scene/Site';
import type { CameraView } from './scene/CameraRig';
import { CrewCards, DecisionCard, NoorBrief, RedFlags, SiteLog, type DecisionState } from './components/Console';
import { Phone } from './components/Phone';
import { Compare } from './components/Compare';
import { StoryCard } from './components/StoryCard';
import { STORIES, type Beat } from './story';
import { FEATURED, askGuardian, askPlanner, askSafety, health, loadWorld, runBranch, type AgentSource, type Branch, type Health } from './model';

const SPEEDS = [1, 2, 4, 8]; // simulated minutes per real second
export type Mode = 'story' | 'explore';

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function App({ scenarioId, startMode, onBrief, onEvidence }: { scenarioId: string; startMode: Mode; onBrief: () => void; onEvidence: () => void }) {
  const world = useMemo(() => loadWorld(scenarioId), [scenarioId]);
  const { scenario } = world;
  const DECISION_AT = scenario.decision!.at;
  const DEFAULT_ASK = scenario.decision!.question;
  const BEATS = STORIES[scenarioId]!;
  const original = useMemo(() => runBranch(world, 'original', 'Original schedule'), [world]);
  const [planBranch, setPlanBranch] = useState<Branch | null>(null);
  const [active, setActive] = useState<Branch['id']>('original');
  const branch = active === 'plan' && planBranch ? planBranch : original;

  const [mode, setMode] = useState<Mode>(startMode);
  const [minute, setMinute] = useState(scenario.start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [decided, setDecided] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [selected, setSelected] = useState<string>('anwar');
  const [view, setView] = useState<CameraView>('establishing');
  const [viewRevision, setViewRevision] = useState(0);
  const [beat, setBeat] = useState<Beat | null>(null);
  const seen = useRef(new Set<string>());
  const [ai, setAi] = useState<Health>({ ai: false, model: null });
  const [decision, setDecision] = useState<DecisionState>({ ask: DEFAULT_ASK, events: [], running: false });

  useEffect(() => void health().then(setAi), []);

  const goTo = useCallback((v: CameraView) => {
    setView(v);
    setViewRevision((r) => r + 1);
  }, []);

  // ---- Story beats -----------------------------------------------------------------------------
  const dialogue = useMemo(() => dialogueFor(world.scenario, branch.run, active === 'plan' && planBranch ? 'plan' : 'original'), [world.scenario, branch.run, active, planBranch]);
  const ctx = useMemo(() => ({ branch: active, run: branch.run }), [active, branch.run]);
  const beatTimes = useMemo(() => BEATS.map((b) => ({ beat: b, at: b.at(ctx) })).filter((x): x is { beat: Beat; at: number } => x.at !== null), [ctx, BEATS]);

  const showBeat = useCallback(
    (b: Beat) => {
      seen.current.add(b.id);
      setBeat(b);
      setPlaying(false);
      goTo(b.view);
      if (b.select) setSelected(b.select);
      if (b.decision) setShowDecision(true);
    },
    [goTo],
  );

  // ---- Playback ------------------------------------------------------------------------------
  const clock = useRef({ last: 0, carry: 0 });
  const minuteRef = useRef(minute);
  minuteRef.current = minute;
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
        const m = minuteRef.current;
        let next = Math.min(scenario.end - 1, m + advance);
        // Story beats (story mode) or just the decision (explore mode) stop the clock on time.
        const due = beatTimes.find(({ beat: b, at }) => at > m && at <= next && !seen.current.has(b.id) && (mode === 'story' || (b.decision && !decided)));
        if (due) {
          setMinute(due.at);
          if (mode === 'story') showBeat(due.beat);
          else {
            seen.current.add(due.beat.id);
            setPlaying(false);
            setShowDecision(true);
            goTo('deck');
          }
          return;
        }
        if (next >= scenario.end - 1) setPlaying(false);
        setMinute(next);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, decided, scenario.end, beatTimes, mode, showBeat, goTo, DECISION_AT]);

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
    const key = slot * 10 + (active === 'plan' ? 1 : 0) + (record.networkUp ? 0 : 2);
    if (key === lastBrief.current || briefLoading) return;
    lastBrief.current = key;
    setBriefLoading(true);
    const at = formatClock(minute);
    askSafety(at, crews, !record.networkUp)
      .then((b) => setBrief({ ...b, clock: at }))
      .catch(() => {})
      .finally(() => setBriefLoading(false));
  }, [minute, crews, active, scenario.start, briefLoading, DECISION_AT, record.networkUp]);

  // ---- Guardian: the selected worker's phone, refreshed when their level or action changes ---
  const gctx = useMemo(() => guardianContext(scenario, record, selected), [scenario, record, selected]);
  const [messages, setMessages] = useState<Record<string, GuardianMessage & AgentSource>>({});
  const [guardianLoading, setGuardianLoading] = useState(false);
  const guardianKey = `${active}:${selected}:${gctx.level}:${gctx.action}:${record.networkUp}`;
  const pending = useRef(new Set<string>());
  useEffect(() => {
    if (messages[guardianKey] || pending.current.has(guardianKey)) return;
    pending.current.add(guardianKey);
    setGuardianLoading(true);
    askGuardian(gctx, !record.networkUp)
      .then((m) => setMessages((all) => ({ ...all, [guardianKey]: m })))
      .catch(() => {})
      .finally(() => {
        pending.current.delete(guardianKey);
        setGuardianLoading(pending.current.size > 0);
      });
  }, [guardianKey, gctx, messages, record.networkUp]);
  // A current local action is always available; never display another worker's stale message.
  const shownMessage = messages[guardianKey] ?? { ...fallbackGuardianMessage(gctx), source: 'rules' as const };

  // ---- Decision and story control ------------------------------------------------------------
  const resume = useCallback(() => {
    setBeat(null);
    setPlaying(true);
  }, []);

  const ask = useCallback(() => {
    setDecision((d) => ({ ...d, events: [], running: true, error: undefined }));
    askPlanner({ scenario: scenario.id, effectiveAt: DECISION_AT, unavailable: [], ask: decision.ask }, (e) => setDecision((d) => ({ ...d, events: [...d.events, e] })))
      .catch((err: Error) => setDecision((d) => ({ ...d, error: `Planner unavailable: ${err.message}` })))
      .finally(() => setDecision((d) => ({ ...d, running: false })));
  }, [decision.ask, scenario.id, DECISION_AT]);

  const approve = useCallback(() => {
    const final = decision.events.find((e) => e.type === 'final');
    if (!final || final.type !== 'final' || !final.check.ok) return;
    const plan = final.check.plan;
    setPlanBranch(runBranch(world, 'plan', 'Omar’s plan, approved', [{ at: DECISION_AT, plan }], plan));
    setActive('plan');
    setDecided(true);
    setShowDecision(false);
    resume();
  }, [decision.events, world, resume, DECISION_AT]);

  const keep = useCallback(() => {
    setActive('original');
    setDecided(true);
    setShowDecision(false);
    resume();
  }, [resume]);

  const continueStory = useCallback(() => {
    if (beat?.id === 'start') goTo('overview');
    resume();
  }, [beat, goTo, resume]);

  /** Back to the 15:10 decision with everything after it unseen. */
  const decideAgain = () => {
    for (const b of beatTimes) if (b.at >= DECISION_AT) seen.current.delete(b.beat.id);
    setShowCompare(false);
    setDecided(false);
    setActive('original');
    setMinute(DECISION_AT);
    setDecision({ ask: DEFAULT_ASK, events: [], running: false });
    const d = BEATS.find((b) => b.decision)!;
    if (mode === 'story') showBeat(d);
    else {
      setBeat(null);
      setPlaying(false);
      setShowDecision(true);
      goTo('deck');
    }
  };

  const watch = (id: Branch['id']) => {
    setActive(id);
    setDecided(true);
    setShowDecision(false);
    setMinute(DECISION_AT);
    setShowCompare(false);
    setBeat(null);
    for (const b of beatTimes) if (b.at > DECISION_AT) seen.current.delete(b.beat.id);
    setPlaying(true);
  };

  const begin = useCallback((m: Mode) => {
    setMode(m);
    seen.current.clear();
    setMinute(scenario.start);
    setDecided(false);
    setActive('original');
    setShowDecision(false);
    if (m === 'story') showBeat(BEATS[0]!);
    else {
      setBeat(null);
      goTo('overview');
      setPlaying(true);
    }
  }, [BEATS, goTo, scenario.start, showBeat]);
  const started0 = useRef(false);
  useEffect(() => {
    if (started0.current) return;
    started0.current = true;
    begin(startMode);
  }, [begin, startMode]);

  const explore = () => {
    setMode('explore');
    setBeat(null);
    setPlaying(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement)) return;
      e.preventDefault();
      if (beat && !beat.decision && !beat.ending) continueStory();
      else if (!showDecision && !beat) setPlaying((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beat, mode, showDecision, continueStory]);

  // ---- Derived scene state -------------------------------------------------------------------
  const started = branch.run.pourStartedAt;
  const finished = branch.run.pourFinishedAt;
  const pourProgress = started === null || minute < started ? 0 : finished !== null && minute >= finished ? 1 : Math.min(0.97, (minute - started) / (finished ? finished - started : scenario.pour.durationMin * 1.5));
  const pourActive = started !== null && minute >= started && (finished === null || minute < finished);
  // The truck leaves after the pour, or straight away if no pour starts within 20 minutes of it arriving.
  const truckLeaves = finished !== null ? finished + 3 : started !== null ? scenario.end : scenario.pour.truckArrives + 20;
  const truckOnSite = minute >= scenario.pour.truckArrives - 2 && minute < truckLeaves + 3 && (started !== null || minute < scenario.pour.truckArrives + 20);
  const dust = scenario.weatherModifiers.some((m) => minute >= m.from && minute < m.to);
  const env = record.env;
  const flag = dubaiFlag(env.heatIndex);
  const markers = original.run.events.filter((e) => ['truck-arrived', 'battery-died', 'network-down', 'weather-modifier'].includes(e.kind));
  const redMarkers = branch.run.events.filter((e) => e.kind === 'red-flag');
  const featured = FEATURED.map((id) => scenario.workers.find((w) => w.id === id)!);

  return (
    <div className={`app mode-${mode}`}>
      <header className="topbar">
        <div className="brand">
          <span className="logo">⌁</span> Heatline <small>{scenario.title}</small>
        </div>
        <div className="clock">
          <b>{formatClock(minute)}</b>
          <small>{longDate(scenario.date)} · real weather</small>
        </div>
        <div className="stat">
          <span>Estimated WBGT sun / shade</span>
          <b>
            {env.wbgtSun.toFixed(1)} / {env.wbgtShade.toFixed(1)}°C
          </b>
        </div>
        <div className="stat">
          <span>Feels like</span>
          <b>
            {env.heatIndex.toFixed(0)}°C <span className={`flag flag-${flag}`}>{flag}</span>
          </b>
        </div>
        <div className="stat">
          <span>Air · humidity</span>
          <b>
            {env.airC.toFixed(1)}°C · {env.rhPct.toFixed(0)}%{dust ? ' · dust' : ''}
          </b>
        </div>
        <div className="stat">
          <span>Midday break</span>
          <b className={minute >= 750 && minute < 900 ? 'bad' : ''}>{minute < 750 ? `starts 12:30` : minute < 900 ? 'in force' : 'ended 15:00'}</b>
        </div>
        <div className="stat">
          <span>Site network</span>
          <b className={record.networkUp ? '' : 'bad'}>{record.networkUp ? 'up' : 'down · phones on local rules'}</b>
        </div>
        <div className={`ai ${ai.ai ? 'on' : ''}`}>{ai.ai ? 'Assistant connected' : 'Local guidance'}</div>
        <div className="top-actions">
          <button onClick={() => { setPlaying(false); setShowCompare(true); }} disabled={!planBranch}>
            Compare
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              onEvidence();
            }}
          >
            Evidence
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              onBrief();
            }}
          >
            Scenarios
          </button>
        </div>
      </header>

      <main className="stage">
        <Site
          scenario={scenario}
          record={record}
          plan={activePlan}
          pourProgress={pourProgress}
          pourActive={pourActive}
          truckOnSite={truckOnSite}
          truckLeaves={truckLeaves}
          dust={dust}
          selectedWorker={selected}
          redFlagWorkers={flags.map((f) => f.worker)}
          speech={dialogue.filter((l) => minute >= l.minute && minute < l.minute + 3).slice(-4)}
          view={view}
          viewRevision={viewRevision}
          showLabels
        />
        <div className="branch-tag">{branch.label}</div>
        <div className="views">
          {(['overview', 'deck', 'yard', 'facade', 'welfare', 'gate'] as CameraView[]).map((v) => (
            <button key={v} className={v === view ? 'active' : ''} onClick={() => goTo(v)}>
              {v === 'welfare' ? 'rest area' : v}
            </button>
          ))}
        </div>
        {beat && mode === 'story' && <StoryCard beat={beat} ctx={ctx} metrics={branch.metrics} onContinue={continueStory} onDecideAgain={decideAgain} onCompare={() => { setPlaying(false); setShowCompare(true); }} onExplore={explore} canCompare={!!planBranch} decisionAt={DECISION_AT} />}
      </main>

      <aside className="console">
        <div className="panel-heading"><div><h2>Site operations</h2><p>Crew needs, not individual health data</p></div></div>
        <RedFlags flags={flags} />
        {showDecision && <DecisionCard clock={formatClock(DECISION_AT)} state={decision} onAsk={ask} onApprove={approve} onKeep={keep} setAsk={(s) => setDecision((d) => ({ ...d, ask: s }))} />}
        <NoorBrief brief={brief} loading={briefLoading} />
        <details className="panel-section" open><summary>Crew overview <span>{crews.length} crews</span></summary><CrewCards crews={crews} /></details>
        <details className="panel-section"><summary>Shift activity</summary><SiteLog events={branch.run.events} minute={minute} /></details>
      </aside>

      <Phone workers={featured} selected={selected} onSelect={setSelected} ctx={gctx} message={shownMessage} loading={guardianLoading} stale={false} offline={!record.networkUp} />

      <footer className="timeline">
        <button className="play" onClick={() => !showDecision && !beat && setPlaying((p) => !p)} disabled={showDecision || !!beat}>
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
            aria-label="Shift time"
            type="range"
            min={scenario.start}
            max={scenario.end - 1}
            value={minute}
            disabled={mode === 'story' && !!beat}
            onChange={(e) => {
              const m = Number(e.target.value);
              setMinute(!decided && m > DECISION_AT ? DECISION_AT : m);
            }}
          />
          <div className="marks">
            {[...markers, ...redMarkers].map((e) => (
              <span key={e.id} className={`mark ${e.kind}`} style={{ left: `${((e.minute - scenario.start) / (scenario.end - 1 - scenario.start)) * 100}%` }} title={`${formatClock(e.minute)} ${e.detail}`} />
            ))}
            <span className="mark decision" style={{ left: `${((DECISION_AT - scenario.start) / (scenario.end - 1 - scenario.start)) * 100}%` }} title={`${formatClock(DECISION_AT)} decision`} />
          </div>
          <div className="ticks">
            {Array.from({ length: 7 }, (_, i) => scenario.start + Math.round(((scenario.end - scenario.start) * i) / 6)).map((m) => (
              <span key={m}>{formatClock(m)}</span>
            ))}
          </div>
        </div>
        <small className="disclaimer">Synthetic workers · historical weather. Demonstration policy, not safety certification.</small>
      </footer>

      {showCompare && planBranch && <Compare a={original} b={planBranch} onClose={() => setShowCompare(false)} onWatch={watch} title={scenario.title} decisionAt={DECISION_AT} />}
    </div>
  );
}
