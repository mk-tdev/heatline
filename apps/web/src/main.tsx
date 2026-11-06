import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, type Mode } from './App';
import { Intro } from './components/Intro';
import { Evidence } from './components/Evidence';
import './styles.css';

function Root() {
  const [run, setRun] = useState<{ scenario: string; mode: Mode; key: number } | null>(null);
  const [evidence, setEvidence] = useState(false);
  return (
    <>
      {run && <App key={run.key} scenarioId={run.scenario} startMode={run.mode} onBrief={() => setRun(null)} onEvidence={() => setEvidence(true)} />}
      {!run && <Intro onStart={(scenario, mode) => setRun({ scenario, mode, key: Date.now() })} onEvidence={() => setEvidence(true)} />}
      {evidence && <Evidence onClose={() => setEvidence(false)} />}
    </>
  );
}

// No StrictMode: the scene's projected labels and the canvas are mounted once by design.
createRoot(document.getElementById('root')!).render(<Root />);
