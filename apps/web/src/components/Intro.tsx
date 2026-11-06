// Entry screen: the claim, why it matters, the people, and the scenarios to play.

import { useEffect, useMemo, useState } from 'react';
import { SCENARIOS } from '@heatline/sim';
import { formatClock } from '@heatline/contracts';
import { CHARACTERS } from '../story';
import { CREW_COLOURS } from '../scene/Site';
import { health, loadWorld } from '../model';
import type { Mode } from '../App';

const CREW_OF: Record<string, string> = { anwar: 'B', suresh: 'B', ravi: 'A', bilal: 'C', joel: 'C', ahmed: 'B' };
const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export function Intro({ onStart, onEvidence }: { onStart: (scenario: string, mode: Mode) => void; onEvidence: () => void }) {
  const [ai, setAi] = useState(false);
  useEffect(() => void health().then((h) => setAi(h.ai)), []);
  const starts = useMemo(
    () =>
      Object.fromEntries(
        SCENARIOS.map((s) => {
          const { scenario, environment } = loadWorld(s.id);
          return [s.id, environment.at(scenario.start)];
        }),
      ),
    [],
  );
  return (
    <div className="intro">
      <div className="intro-inner">
        <header className="intro-head">
          <div className="intro-brand">
            <span className="logo">⌁</span> Heatline
          </div>
          <h1>The midday break covers two and a half hours. The heat doesn’t stop at three.</h1>
          <p className="lede">
            A replayable training simulation of a construction site on Saadiyat Island, Abu Dhabi, driven by real August 2025 weather. Every worker has a guardian that warns them in their own language. The supervisor sees crews, never bodies, plans with an assistant whose
            proposals are checked against a labelled demonstration policy, and can rewind the shift to see what a different decision would have changed.
          </p>
        </header>

        <section className="intro-grid">
          <div className="intro-card">
            <h2>Why it matters</h2>
            <p>In August 2025 near Saadiyat, our weather-based estimate of wet-bulb globe temperature stayed at or above 31 °C on every day from noon to 6 pm. The midday break (12:30–15:00) removes about 2½ of those hours. The rest has to be managed person by person, crew by crew.</p>
          </div>
          <div className="intro-card">
            <h2>Your role</h2>
            <p>
              You are the <b>site supervisor</b>. Noor, the safety assistant, tells you which crews need what. Omar, the planning assistant, proposes plans and tests them against the rules. You approve or refuse, and every scenario has a decision that
              changes the outcome.
            </p>
          </div>
          <div className="intro-card">
            <h2>What it covers</h2>
            <p>Dynamic heat-risk assessment · graded multilingual warnings · worker-first data governance · field-ready fallback · supervisor decision support · safety and productivity measures across a whole month.</p>
            <button onClick={onEvidence}>Explore the simulation evidence</button>
          </div>
        </section>

        <section>
          <h2 className="people-title">Choose a scenario</h2>
          <div className="scenarios">
            {SCENARIOS.map((s) => {
              const env = starts[s.id]!;
              return (
                <div key={s.id} className="scenario-card">
                  <div className="scenario-meta">
                    {dateLabel(s.date)} 2025 · {formatClock(s.start)}–{formatClock(s.end)} · WBGT {env.wbgtSun.toFixed(1)}°C, {env.rhPct.toFixed(0)}% RH
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.tagline}</p>
                  <div className="covers">
                    {s.covers.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                  <div className="buttons">
                    <button className="primary" onClick={() => onStart(s.id, 'story')}>
                      Play the story
                    </button>
                    <button onClick={() => onStart(s.id, 'explore')}>Explore</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="people-title">The people</h2>
          <div className="people">
            {CHARACTERS.map((c) => (
              <div key={c.id} className="person-card">
                <div className="person-avatar" style={{ borderColor: CREW_COLOURS[CREW_OF[c.id] ?? 'B'] }}>
                  {c.fullName
                    .split(' ')
                    .map((p) => p[0])
                    .join('')}
                </div>
                <div>
                  <strong>
                    {c.fullName}, {c.age}
                  </strong>
                  <small>
                    {c.role} · {c.from} · {c.language}
                  </small>
                  <p>{c.line}</p>
                </div>
              </div>
            ))}
          </div>
          <small className="fictional">
            Characters are fictional. Historical weather drives a teaching model. Demonstration rules are not UAE compliance certification; see the evidence report for independent screening and limitations. {ai ? 'AI assistants are live.' : 'AI is unavailable: running on rules only.'}
          </small>
        </section>
      </div>
    </div>
  );
}
