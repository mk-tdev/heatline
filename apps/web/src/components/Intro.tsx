// Entry screen: the scenario, why it matters, the people, and the viewer's role.

import type { Environment } from '@heatline/contracts';
import { CHARACTERS } from '../story';
import { CREW_COLOURS } from '../scene/Site';

const CREW_OF: Record<string, string> = { anwar: 'B', suresh: 'B', ravi: 'A', bilal: 'C', joel: 'C', ahmed: 'B' };

export function Intro({ env, ai, onStory, onExplore }: { env: Environment; ai: boolean; onStory: () => void; onExplore: () => void }) {
  return (
    <div className="intro">
      <div className="intro-inner">
        <header className="intro-head">
          <div className="intro-brand">
            <span className="logo">⌁</span> Heatline
          </div>
          <h1>The midday break covers two and a half hours. The heat doesn’t stop at three.</h1>
          <p className="lede">
            A live digital twin of a construction site on Saadiyat Island, Abu Dhabi, on a real August afternoon. Every worker has a guardian that warns them in their own language. The supervisor sees crews, never bodies, and can rewind the shift to see what a
            different decision would have changed.
          </p>
        </header>

        <section className="intro-grid">
          <div className="intro-card">
            <h2>The afternoon</h2>
            <p>
              <b>Tuesday 19 August 2025, 15:00.</b> Saadiyat Tower, a 14-storey residential frame, is at Level 12. The UAE’s midday break (12:30–15:00) has just ended.
            </p>
            <div className="facts">
              <div>
                <b>{env.airC.toFixed(0)}°C</b>
                <span>air temperature</span>
              </div>
              <div>
                <b>{env.rhPct.toFixed(0)}%</b>
                <span>humidity</span>
              </div>
              <div>
                <b>{env.wbgtSun.toFixed(1)}°C</b>
                <span>WBGT in the sun</span>
              </div>
              <div>
                <b>{env.heatIndex.toFixed(0)}°C</b>
                <span>feels like</span>
              </div>
            </div>
            <small>Real ERA5 weather for this grid point, recomputed every minute.</small>
          </div>
          <div className="intro-card">
            <h2>Why it matters</h2>
            <p>In August 2025 near Saadiyat, the wet-bulb globe temperature stayed at or above 31 °C on every single day from noon to 6 pm. The midday break removes about 2½ of those hours. The rest has to be managed person by person, crew by crew.</p>
            <p>Supervisors today get one flag for the whole site. They don’t see who is new to the heat, who skipped water, or who will not stop until the pour is done.</p>
          </div>
          <div className="intro-card">
            <h2>Your role</h2>
            <p>
              You are the <b>site supervisor</b>. Noor, the safety assistant, tells you which crews need what. Omar, the planning assistant, proposes plans and tests them against the rules. You approve or refuse.
            </p>
            <p>
              At 15:10 a concrete truck is due. <b>Your decision changes the afternoon.</b> At the end, rewind and watch the other one.
            </p>
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
                    {c.role} · {c.from} · speaks {c.language}
                  </small>
                  <p>{c.line}</p>
                </div>
              </div>
            ))}
          </div>
          <small className="fictional">Characters are fictional. Weather, UAE rules and heat-stress standards are real; the body model is a teaching simulation, not clinical advice.</small>
        </section>

        <footer className="intro-actions">
          <button className="primary big" onClick={onStory}>
            Begin the shift
          </button>
          <button className="big" onClick={onExplore}>
            Explore freely
          </button>
          <small>{ai ? 'AI assistants live' : 'AI unavailable: running on rules only'} · about 6 minutes in story mode</small>
        </footer>
      </div>
    </div>
  );
}
