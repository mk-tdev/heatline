import { useMemo } from 'react';
import { loadWorld } from '../model';
import { World } from './World';
import { Life } from './Life';
import { SiteA } from './SiteA';
import { WorksiteExplore } from './WorksiteExplore';

/** Static scenery only: never mounts App, runs a shift, or calls an assistant. */
export function LandingExplore({ onClose }: { onClose: () => void }) {
  const scenario = useMemo(() => loadWorld('afternoon-pour').scenario, []);
  return <WorksiteExplore onClose={onClose} returnLabel="Back to home">
    <color attach="background" args={['#bdd5e6']} />
    <fog attach="fog" args={['#bdd5e6', 420, 1700]} />
    <hemisphereLight args={['#fff1dc', '#b8925c', .7]} />
    <directionalLight position={[100, 180, 80]} intensity={2.7} color="#fff2dc" />
    <World />
    <Life />
    <SiteA scenario={scenario} minute={scenario.start} plan={null} pourProgress={0} pourActive={false} truckOnSite={false} truckLeaves={scenario.end} />
  </WorksiteExplore>;
}
