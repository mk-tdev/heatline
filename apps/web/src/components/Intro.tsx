import { HeroShift } from './HeroShift';
// A cinematic invitation into the fictional site. Generated imagery is illustrative.
import { BrandMark } from './BrandMark';
import { useEffect, useMemo, useState } from 'react';
import { SCENARIOS } from '@heatline/sim';
import { formatClock } from '@heatline/contracts';
import { CHARACTERS } from '../story';
import { health, loadWorld } from '../model';
import type { Mode } from '../App';

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
const MOODS = ['afternoon', 'morning', 'humid', 'storm'];
const ICONS = ['☀', '◷', '◌', '≋'];

export function Intro({ onStart, onEvidence, onExploreFoot }: { onExploreFoot: () => void; onStart: (scenario: string, mode: Mode) => void; onEvidence: () => void }) {
  const [ai, setAi] = useState(false);
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => void health().then((h) => setAi(h.ai)), []);
  const starts = useMemo(() => Object.fromEntries(SCENARIOS.map((s) => {
    const { scenario, environment } = loadWorld(s.id);
    return [s.id, environment.at(scenario.start)];
  })), []);
  const choose = () => document.getElementById('choose-shift')?.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });

  return (
    <div className={`welcome ${motion ? 'motion-on' : 'motion-off'}`}>
      <section className="welcome-hero" aria-label="Welcome to Heatline">
        <nav className="welcome-nav" aria-label="Main navigation">
          <a className="welcome-brand" href="#"><BrandMark /> Heatline</a>
          <div className="welcome-nav-links"><button onClick={choose}>The experiences</button><button onClick={onEvidence}>The evidence</button></div>
          <span className="challenge-pill">Future Health Challenge</span>
        </nav>
        <div className="hero-copy">
          <p className="location-line"><span className="live-dot" /> Saadiyat Island, Abu Dhabi</p>
          <h1>The heat doesn’t<br />stop at three.</h1>
          <p className="hero-description">The midday break is over. The people building tomorrow still need protecting. Step onto their site—and see what one better decision can change.</p>
          <div className="hero-actions"><button className="hero-start" onClick={() => onStart('afternoon-pour', 'story')}><span className="play-glyph" aria-hidden="true">▶</span> Step into the site</button><button className="hero-secondary" onClick={choose}>Explore the scenarios <span aria-hidden="true">↓</span></button></div>
          <div className="hero-playground"><button className="hero-secondary" onClick={onExploreFoot}>Explore on foot</button><span>Walk, ride the lift, operate the crane.<br />Just for fun. No simulation started.</span></div>
          <div className="hero-playground"><a className="hero-secondary" href="/worker/index.html">Open Anwar’s worker demo →</a><span>Try the offline warning on your phone.<br /><a href="/worker/supervisor.html">Open supervisor dashboard →</a></span></div>
          <p className="hero-footnote">A playable 3D experience. Historical weather. Human decisions.</p>
        </div>
        <HeroShift />
        <p className="mobile-notice">The interactive simulator supports desktop and laptop. Explore the scenarios and evidence on any screen.</p>
        <div className="hero-shift"><span className="shift-clock">15:00</span><div><strong>The break is over.</strong><span>20 workers. Three crews. One afternoon.</span></div><button onClick={() => setMotion(!motion)} aria-pressed={!motion} aria-label={motion ? 'Pause ambient animation' : 'Enable ambient animation'}>{motion ? 'Ⅱ' : '▷'}</button></div>
      </section>

      <main className="welcome-content">
        <section className="experience-intro" aria-label="How Heatline works">
          <h2>A warning is only<br />the beginning.</h2>
          <div className="experience-step"><span aria-hidden="true">◉</span><h3>Notice the risk</h3><p>Changing heat, different workloads, and a guardian speaking each worker’s language.</p></div>
          <div className="experience-step"><span aria-hidden="true">⌁</span><h3>Make the call</h3><p>Move shade. Rotate crews. Rethink the pour. See the checks before you decide.</p></div>
          <div className="experience-step"><span aria-hidden="true">↶</span><h3>See another future</h3><p>Rewind the same afternoon. Change your decision. Compare what happens.</p></div>
        </section>

        <section id="choose-shift" className="shift-selection">
          <div className="section-heading"><div><p>Welcome to your shift</p><h2>Four shifts.<br />Very different calls.</h2></div><p>Take the supervisor’s seat. Each scenario brings a different challenge—and people counting on your next decision.</p></div>
          <div className="experience-cards">
            {SCENARIOS.map((s, i) => <article key={s.id} className={`experience-card mood-${MOODS[i]}`}>
              <div className="experience-art"><img src="/images/saadiyat-hero.jpg" alt="" loading="lazy" /><span className="weather-symbol" aria-hidden="true">{ICONS[i]}</span><div className="scenario-weather"><span>{dateLabel(s.date)} 2025</span><b>{starts[s.id]!.wbgtSun.toFixed(1)}°<small>Estimated WBGT</small></b></div></div>
              <div className="experience-body"><span className="scenario-time">{formatClock(s.start)}–{formatClock(s.end)}</span><h3>{s.title}</h3><p>{s.tagline}</p><div className="experience-actions"><button onClick={() => onStart(s.id, 'story')}>Play this story <span aria-hidden="true">↗</span></button><button onClick={() => onStart(s.id, 'explore')} aria-label={`Explore ${s.title}`}>Explore</button></div></div>
            </article>)}
          </div>
        </section>

        <section className="people-story">
          <div className="people-photo"><img src="/images/worker-break.jpg" alt="AI-generated illustration of three fictional construction workers sharing a relaxed break in the shade" loading="lazy" /><span>Fictional people. A very real reason to care.</span></div>
          <div className="people-copy"><p className="section-kicker">Behind every warning, a person</p><h2>Different stories.<br />The same right <br />to go home well.</h2><p>Anwar is on his second day. Ravi’s sensor is running out of battery. Suresh wants to finish the pour. Heatline makes room for the person behind the task.</p><div className="language-ribbon"><span>বাংলা</span><span>हिन्दी</span><span>العربية</span><span>മലയാളം</span><span>اردو</span><span>Tagalog</span></div><details className="meet-crew"><summary>Meet the six featured workers <span>+</span></summary><div>{CHARACTERS.map((c) => <p key={c.id}><strong>{c.fullName}</strong><small>{c.role} · {c.language}</small>{c.line}</p>)}</div></details></div>
        </section>

        <section className="evidence-invitation"><div><span className="evidence-orbit" aria-hidden="true">◎</span><p>Curiosity, backed by transparency.</p><h2>Look beyond the good ending.</h2><p>Explore a month of simulated shifts, missed warnings, exposure screening and the assumptions that change the result.</p></div><button onClick={onEvidence}>Open the evidence <span aria-hidden="true">↗</span></button></section>
        <footer className="welcome-footer"><span className="welcome-brand"><BrandMark /> Heatline</span><p>Historical weather drives synthetic workers and a teaching model. Illustrations are AI-generated. Demonstration policies are not clinical predictions or UAE compliance certification.</p><span className="connection-status"><i />{ai ? 'Assistants connected' : 'Local guidance ready'}</span></footer>
      </main>
    </div>
  );
}
