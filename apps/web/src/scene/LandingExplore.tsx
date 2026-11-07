import { useMemo } from 'react';
import { loadWorld } from '../model';
import { World } from './World';
import { Life } from './Life';
import { SiteA } from './SiteA';
import { WorksiteExplore } from './WorksiteExplore';
import { StaticCrew } from './Site';
import { runShift } from '@heatline/sim';

/** Scenery and a still crew only: never mounts App or calls an assistant. */
export function LandingExplore({ onClose }: { onClose: () => void }) {
  const { scenario, environment } = useMemo(() => loadWorld('afternoon-pour'), []);
  // The crew as they are twenty minutes into the shift, so the site has people on it.
  const record = useMemo(() => runShift(scenario, { policy: 'heatline', environment }).minutes[20]!, [scenario, environment]);
  return <WorksiteExplore onClose={onClose} returnLabel="Back to home">
    <color attach="background" args={['#bdd5e6']} />
    <fog attach="fog" args={['#bdd5e6', 420, 1700]} />
    <hemisphereLight args={['#fff1dc', '#b8925c', .7]} />
    <directionalLight position={[100, 180, 80]} intensity={2.7} color="#fff2dc" />
    <World />
    <Life />
    <StaticCrew scenario={scenario} record={record} />
    <SiteA scenario={scenario} minute={scenario.start} plan={null} pourProgress={0} pourActive={false} truckOnSite={false} truckLeaves={scenario.end} />
  </WorksiteExplore>;
}
