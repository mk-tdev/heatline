import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, type Mode } from './App';
import { Intro } from './components/Intro';
import { LandingExplore } from './scene/LandingExplore';
import { Evidence } from './components/Evidence';
import { Planner } from './planner/Planner';
import './styles.css';
import './experience.css';

function DesktopNotice({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="desktop-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="desktop-title">
    <img src="/favicon.svg" width="56" height="56" alt="" />
    <p className="section-kicker">A little more room to explore</p>
    <h2 id="desktop-title">Meet us on desktop.</h2>
    <p>The interactive 3D site is supported on desktop and laptop with a window at least 1024 pixels wide. Open this page there to step into a shift.</p>
    <p>You can still discover the scenarios, meet the crew and read the evidence on your phone.</p>
    <button autoFocus onClick={onClose}>Keep exploring</button>
  </dialog>;
}
function Root() {
  const [run, setRun] = useState<{ scenario: string; mode: Mode; key: number } | null>(null);
  const [desktopNotice, setDesktopNotice] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const [playground, setPlayground] = useState(false);
  // The shift planner has its own address (#plan) so it can be linked and opened on a phone.
  const [planner, setPlanner] = useState(() => window.location.hash.startsWith('#plan'));
  useEffect(() => {
    const sync = () => setPlanner(window.location.hash.startsWith('#plan'));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const openPlanner = () => { window.location.hash = '#plan'; };
  const closePlanner = () => { history.replaceState(null, '', window.location.pathname); setPlanner(false); };
  const needsDesktop = () => window.innerWidth < 1024 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return (
    <>
      {run && <App key={run.key} scenarioId={run.scenario} startMode={run.mode} onBrief={() => setRun(null)} onEvidence={() => setEvidence(true)} />}
      {planner && !run && <Planner onClose={closePlanner} onRehearse={() => { closePlanner(); if (needsDesktop()) setDesktopNotice(true); else setRun({ scenario: 'afternoon-pour', mode: 'story', key: Date.now() }); }} />}
      {!run && !planner && <Intro onPlan={openPlanner} onExploreFoot={() => { if (needsDesktop()) setDesktopNotice(true); else setPlayground(true); }} onStart={(scenario, mode) => { if (needsDesktop()) setDesktopNotice(true); else setRun({ scenario, mode, key: Date.now() }); }} onEvidence={() => setEvidence(true)} />}
      {playground && <LandingExplore onClose={() => setPlayground(false)} />}
      {desktopNotice && <DesktopNotice onClose={() => setDesktopNotice(false)} />}
      {evidence && <Evidence onClose={() => setEvidence(false)} />}
    </>
  );
}

// No StrictMode: the scene's projected labels and the canvas are mounted once by design.
createRoot(document.getElementById('root')!).render(<Root />);
