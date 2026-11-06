// A story beat: chapter, title and narration over the scene, with the next step.

import type { RunMetrics } from '@heatline/sim';
import { formatClock } from '@heatline/contracts';
import type { Beat, BeatContext } from '../story';

export function StoryCard({ beat, ctx, metrics, onContinue, onDecideAgain, onCompare, onExplore, canCompare, decisionAt }: { beat: Beat; ctx: BeatContext; metrics: RunMetrics; onContinue: () => void; onDecideAgain: () => void; onCompare: () => void; onExplore: () => void; canCompare: boolean; decisionAt: number }) {
  const at = formatClock(decisionAt);
  return (
    <div className={`story-card${beat.decision ? ' decision-beat' : ''}`}>
      {beat.chapter && <div className="chapter">{beat.chapter}</div>}
      <h3>{beat.title}</h3>
      <p>{beat.body(ctx)}</p>
      {beat.ending && (
        <div className="ending-stats">
          <div>
            <b>{metrics.redFlags}</b>
            <span>red flags</span>
          </div>
          <div>
            <b>{metrics.minutesPsi7}</b>
            <span>worker-minutes at high strain</span>
          </div>
          <div>
            <b>{metrics.pourFinishedAt === null ? '—' : formatClock(metrics.pourFinishedAt)}</b>
            <span>pour finished</span>
          </div>
          <div>
            <b>{ctx.run.violations.filter((v) => v.minute >= decisionAt).length}</b>
            <span>rule breaches after {at}</span>
          </div>
        </div>
      )}
      <div className="buttons">
        {beat.decision ? (
          <span className="hint">← Ask Omar in the panel on the left, then approve his plan or keep the original schedule.</span>
        ) : beat.ending ? (
          <>
            <button className="primary" onClick={onDecideAgain}>
              Go back to {at} and decide again
            </button>
            <button onClick={onCompare} disabled={!canCompare} title={canCompare ? '' : `Approve a plan at ${at} to have a second shift to compare`}>
              Compare both choices
            </button>
            <button onClick={onExplore}>Explore freely</button>
          </>
        ) : (
          <button className="primary" onClick={onContinue}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
