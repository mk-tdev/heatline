import { HeroShift } from './HeroShift';
// A cinematic invitation into the fictional site. Generated imagery is illustrative.
import { BrandMark } from './BrandMark';
import { useEffect, useMemo, useState } from 'react';
import { SCENARIOS } from '@heatline/sim';
import { formatClock } from '@heatline/contracts';
import { CHARACTERS } from '../story';
import { health, loadWorld } from '../model';
import type { Mode } from '../App';
import { season } from '../season';

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
const MOODS = ['afternoon', 'morning', 'humid', 'storm'];
const ICONS = ['☀', '◷', '◌', '≋'];

export function Intro({ onStart, onEvidence, onExploreFoot, onPlan }: { onPlan: () => void; onExploreFoot: () => void; onStart: (scenario: string, mode: Mode) => void; onEvidence: () => void }) {
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
          <div className="welcome-nav-links"><button onClick={onPlan}>Shift planner</button><button onClick={choose}>The 3D site</button><button onClick={onEvidence}>The evidence</button></div>
          <span className="challenge-pill">Future Health Challenge</span>
        </nav>
        <div className="hero-copy">
          <p className="location-line"><span className="live-dot" /> Saadiyat Island, Abu Dhabi</p>
          <h1>The heat doesn’t<br />stop at three.</h1>
          <p className="hero-description">The midday break covers two and a half hours. Across the last two summers, Abu Dhabi’s heat was over the safe limit for steady outdoor work for {Math.round(season.overLimitHoursPerDay)} hours a day. Heatline plans the shift around the heat that is left, warns each worker in their own language, and lets a supervisor rehearse the call first.</p>
          <div className="hero-actions"><button className="hero-start" onClick={() => onStart('afternoon-pour', 'story')}><span className="play-glyph" aria-hidden="true">▶</span> Step into the site</button><button className="hero-secondary" onClick={onPlan}>Plan tomorrow’s shift <span aria-hidden="true">→</span></button></div>
          <div className="hero-more">
            <span>Or</span>
            <button onClick={choose} title="Four shifts on real August days">Explore the scenarios</button>
            <button onClick={onExploreFoot} title="Walk the site, ride the lift, work the crane. No shift starts.">Walk the site on foot</button>
            <a href="/worker/index.html" title="Anwar’s phone, working offline, in Bengali">Try the phone demo</a>
            <a href="/worker/supervisor.html" title="The supervisor’s count of crew arrivals in shade">Supervisor dashboard</a>
          </div>
        </div>
        <HeroShift />
        <p className="mobile-notice">The shift planner, the phone demo and the evidence work on any screen. The 3D site needs a desktop or laptop.</p>
        <div className="hero-shift"><span className="shift-clock">15:00</span><div><strong>The break is over.</strong><span>20 workers. Three crews. One afternoon.</span></div><button onClick={() => setMotion(!motion)} aria-pressed={!motion} aria-label={motion ? 'Pause ambient animation' : 'Enable ambient animation'}>{motion ? 'Ⅱ' : '▷'}</button></div>
      </section>

      <main className="welcome-content">
        <section className="season-finding" aria-label="What the weather alone says">
          <div className="season-copy">
            <p className="section-kicker">Real weather, no simulation</p>
            <h2>The break ends.<br />The heat does not.</h2>
            <p>We worked out the heat stress for every working hour of the {season.yearsLabel} midday-break seasons near Saadiyat Island ({season.days} days), and compared it with the US NIOSH limit for steady, moderate work.</p>
            <button onClick={onPlan}>Plan a shift for your site <span aria-hidden="true">→</span></button>
          </div>
          <div className="season-stat"><b>{Math.round(season.overLimitHoursPerDay)} of {season.hoursPerDay}</b><span>working hours a day (05:00–19:00) were over the limit for steady moderate work in the sun</span></div>
          <div className="season-stat"><b>{season.insideBreakPct}%</b><span>of those hours fall inside the 12:30–15:00 break. The rest have to be managed on site</span></div>
          <div className="season-stat"><b>{season.heavyMinShade} → {season.heavyMinCoolRoom} min</b><span>of heavy work per hour after 15:00, when the crew rests in shade and when it rests in a cooled room</span></div>
        </section>

        <section className="experience-intro" aria-label="How Heatline works">
          <h2>Three parts.<br />One site.</h2>
          <div className="experience-step"><span aria-hidden="true">◷</span><h3>Plan the day</h3><p>Tomorrow’s forecast becomes work and rest limits for every hour, the coolest pour window and a crew briefing in seven languages. No hardware.</p><button className="step-link" onClick={onPlan}>Open the shift planner</button></div>
          <div className="experience-step"><span aria-hidden="true">◉</span><h3>Warn each worker</h3><p>A phone guardian speaks each worker’s language, works offline and without a wearable. Supervisors see crew totals, never anyone’s readings.</p><a className="step-link" href="/worker/index.html">Try Anwar’s phone</a></div>
          <div className="experience-step"><span aria-hidden="true">↶</span><h3>Rehearse the call</h3><p>A 3D site with twenty synthetic workers. Ask for a plan, see the rules check it, then rewind the same afternoon and compare.</p><button className="step-link" onClick={choose}>Choose a shift</button></div>
        </section>

        <section id="choose-shift" className="shift-selection">
          <div className="section-heading"><div><p>The rehearsal site · desktop or laptop</p><h2>Four shifts.<br />Very different calls.</h2></div><p>Take the supervisor’s seat on real August days. The weather is real; the twenty workers are synthetic, so nobody is put at risk to test a plan.</p></div>
          <div className="experience-cards">
            {SCENARIOS.map((s, i) => <article key={s.id} className={`experience-card mood-${MOODS[i]}`}>
              <div className="experience-art"><img src="/images/saadiyat-hero.jpg" alt="" loading="lazy" /><span className="weather-symbol" aria-hidden="true">{ICONS[i]}</span><div className="scenario-weather"><span>{dateLabel(s.date)} 2025</span><b>{starts[s.id]!.wbgtSun.toFixed(1)}°<small>Estimated WBGT</small></b></div></div>
              <div className="experience-body"><span className="scenario-time">{formatClock(s.start)}–{formatClock(s.end)}</span><h3>{s.title}</h3><p>{s.tagline}</p><div className="experience-actions"><button onClick={() => onStart(s.id, 'story')}>Play this story <span aria-hidden="true">↗</span></button><button onClick={() => onStart(s.id, 'explore')} aria-label={`Explore ${s.title}`}>Explore</button></div></div>
            </article>)}
          </div>
        </section>

        <section className="people-story">
          <div className="people-photo"><img src="/images/crew-comic.jpg" alt="Three comic panels show a construction worker under the sun, a worker checking his watch, and a crew lead directing the pour" loading="lazy" /></div>
          <div className="people-copy"><p className="section-kicker">Behind every warning, a person</p><h2>Different stories.<br />The same right <br />to go home well.</h2><p>Anwar is on his second day. Ravi’s sensor is running out of battery. Suresh wants to finish the pour. Heatline makes room for the person behind the task.</p><div className="language-ribbon"><span>বাংলা</span><span>हिन्दी</span><span>العربية</span><span>മലയാളം</span><span>اردو</span><span>Tagalog</span></div><details className="meet-crew"><summary>Meet the six featured workers <span>+</span></summary><div>{CHARACTERS.map((c) => <p key={c.id}><strong>{c.fullName}</strong><small>{c.role} · {c.language}</small>{c.line}</p>)}</div></details></div>
        </section>

        <section className="evidence-invitation"><div><span className="evidence-orbit" aria-hidden="true">◎</span><p>Curiosity, backed by transparency.</p><h2>Look beyond the good ending.</h2><p>Two summers of real weather, a month of simulated shifts, missed warnings, and the assumptions that change the result.</p></div><button onClick={onEvidence}>Open the evidence <span aria-hidden="true">↗</span></button></section>
        <section className="pilot-path" aria-label="From prototype to pilot">
          <div className="section-heading"><div><p>From prototype to pilot</p><h2>A pilot for summer 2027.</h2></div><p>The planner needs only a site location. Wearables are optional, and stay the worker’s choice.</p></div>
          <div className="pilot-steps">
            <div><span>March – May 2027</span><h3>Rehearse</h3><p>A contractor’s safety team runs heat drills on its own site layout and crew mix, before the season starts.</p></div>
            <div><span>June – September 2027</span><h3>Shadow</h3><p>Forecast plans on one to three sites, checked against the site’s own heat readings and incident log. Nobody’s work depends on it yet.</p></div>
            <div><span>What we measure</span><h3>Prove</h3><p>Warning lead time, false alarms, whether rest was taken, heat-illness cases, escalations and work time lost.</p></div>
            <div><span>What we need</span><h3>Partners</h3><p>One contractor’s safety team, an occupational hygienist to review the limits, and native speakers to check every message.</p></div>
          </div>
        </section>
        <footer className="welcome-footer"><span className="welcome-brand"><BrandMark /> Heatline</span><p>Historical weather drives synthetic workers and a teaching model. Illustrations are AI-generated. Demonstration policies are not clinical predictions or UAE compliance certification.</p><span className="connection-status"><i />{ai ? 'Assistants connected' : 'Local guidance ready'}</span></footer>
      </main>
    </div>
  );
}
