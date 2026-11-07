// The worker's own phone: their guardian's message in their language, and their own readings.
// Nobody else sees this screen; the banner says so.

import type { GuardianContext, GuardianMessage } from '@heatline/agents';
import { LANGUAGE_NAMES } from '@heatline/agents';
import type { WorkerProfile } from '@heatline/contracts';
import { useEffect, useRef, useState } from 'react';
import type { AgentSource } from '../model';
import { sourceLabel } from './Console';

const LEVEL_COLOURS = { green: '#3aa76d', yellow: '#e2c33b', amber: '#ef8a2e', red: '#e5484d' } as const;
const ACTION_TEXT: Record<string, string> = {
  continue: 'Keep going, keep drinking',
  drink: 'Drink water now',
  'rest-shade': 'Rest in the shade',
  'rest-cabin': 'Rest in the cool cabin',
  'stop-work': 'No more heat work today',
  emergency: 'Stop work · call first aid now',
};
const RTL = new Set(['ar', 'ur']);

export function Phone({
  collapsed,
  onToggle,
  workers,
  selected,
  onSelect,
  ctx,
  message,
  loading,
  stale,
  offline,
}: {
  collapsed: boolean;
  onToggle: () => void;
  workers: WorkerProfile[];
  selected: string;
  onSelect: (id: string) => void;
  ctx: GuardianContext;
  message: (GuardianMessage & AgentSource) | null;
  loading: boolean;
  /** the message shown is from an earlier warning state while a new one is written */
  stale: boolean;
  offline: boolean;
}) {
  return (
    <aside className="phone-wrap">
      <div className="panel-heading"><div className="panel-title"><h2>Worker guardian</h2><p>Private preview · synthetic worker</p></div><button className="panel-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-controls="guardian-content" aria-label={collapsed ? 'Expand worker guardian' : 'Minimize worker guardian'} title={collapsed ? 'Expand worker guardian' : 'Minimize worker guardian'}>{collapsed ? '‹' : '›'}</button></div>
      {collapsed && <span className="panel-rail-label">Worker guardian</span>}
      <div id="guardian-content" hidden={collapsed}>
      <div className="tabs">
        {workers.map((w) => (
          <button key={w.id} className={w.id === selected ? 'active' : ''} onClick={() => onSelect(w.id)}>
            {w.name}
          </button>
        ))}
      </div>
      <div className="phone">
        <div className="phone-banner">Only {ctx.name} sees this screen</div>
        <div className="phone-head">
          <div>
            <strong>{ctx.name}</strong>
            <small>
              {LANGUAGE_NAMES[ctx.language]} · {ctx.acclimatised ? 'used to the heat' : `day ${ctx.daysOnSite} on site`}
            </small>
          </div>
          <span className="level" style={{ background: LEVEL_COLOURS[ctx.level] }}>
            {ctx.level}
          </span>
        </div>
        <div className="action" style={{ borderColor: LEVEL_COLOURS[ctx.level] }}>
          {ctx.action === 'continue' && ctx.indoors ? `Indoors in the ${ctx.placeLabel.replace(/\s*\(.*\)$/, '').toLowerCase()} · keep drinking` : ACTION_TEXT[ctx.action]}
        </div>
        <div className={`guardian lang-${ctx.language}${stale ? ' stale' : ''}`} dir={RTL.has(ctx.language) ? 'rtl' : 'ltr'}>
          {message ? message.message : <span className="muted">…</span>}
          {loading && <span className="spinner" />}
        </div>
        {message?.voice && !stale && !offline && <Listen text={message.message} language={ctx.language} token={message.voice} />}
        {message && <div className={`english${stale ? ' stale' : ''}`}>{stale ? 'Updating… ' : ''}{message.english}</div>}
        <div className="readings">
          <div>
            <span>Body temperature</span>
            <b>{ctx.source === 'wearable' ? `${ctx.estCoreC.toFixed(1)}°C` : 'Not measured'}</b>
          </div>
          <div>
            <span>Simulated heart rate</span>
            <b>{ctx.heartRate ?? '—'}</b>
          </div>
          <div>
            <span>Hydration estimate</span>
            <b>{ctx.waterDeficitL >= 1 ? 'Needs attention' : 'Keep drinking'}</b>
          </div>
          <div>
            <span>Since last break</span>
            <b>{ctx.minutesWorkedWithoutRest} min</b>
          </div>
        </div>
        {ctx.ppe && (
          <div className="ppe">
            Wearing: {ctx.ppe} · traps heat, counted as {ctx.clothingAdjustC}°C hotter
          </div>
        )}
        <small className="muted">
          {ctx.source === 'wearable' ? 'Simulated wearable; body temperature is an estimate' : 'No sensor: exposure-based guidance, not body measurements'} · {ctx.placeLabel}, {ctx.wbgt.toFixed(1)}°C
          <br />
          Guardian: {message ? sourceLabel(message) : '—'} · warning level set by the rules engine
        </small>
      </div>
      </div>
    </aside>
  );
}

/** Reads the guardian's message aloud in the worker's language (OpenAI text-to-speech via the server). */
function Listen({ text, language, token }: { text: string; language: string; token: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'off'>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
      setState((s) => (s === 'off' ? s : 'idle'));
    },
    [text],
  );
  if (state === 'off') return null;
  const play = async () => {
    if (state === 'playing') {
      audio.current?.pause();
      return setState('idle');
    }
    setState('loading');
    try {
      const res = await fetch('/api/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, language, token }) });
      if (!res.ok) return setState(res.status === 503 ? 'off' : 'idle');
      const url = URL.createObjectURL(await res.blob());
      audio.current?.pause();
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => (setState('idle'), URL.revokeObjectURL(url));
      await a.play();
      setState('playing');
    } catch {
      setState('idle');
    }
  };
  return (
    <button className="listen" onClick={play} disabled={state === 'loading'} title="Read the message aloud, for workers who can't read the screen">
      {state === 'loading' ? '… preparing voice' : state === 'playing' ? '■ Stop' : '🔊 Listen'}
    </button>
  );
}
