import { createContext } from 'react';
import type { Vector3 } from 'three';
import { clearPath, route, type Rect, type Point } from './worksiteRoutes';

export const CrewLift = createContext<CrewHoist | null>(null);
interface Ride { from:number; to:number; phase:'waiting'|'boarding'|'riding'|'exiting' }
/** The construction lift. It carries everyone waiting for the same trip together (a cage holds
 *  a crew), so moving a crew between the ground and the deck takes one ride, not one per person. */
export class CrewHoist {
  height=.4;
  groundEquipment: Rect[]=[];
  requests=new Map<string,Ride>();
  private trip: { from:number; to:number } | null=null;
  private dwell=0;
  tick(dt:number) {
    if(!this.trip) {
      const first=[...this.requests.values()].find((r)=>r.phase==='waiting');
      if(!first) return;
      this.trip={from:first.from,to:first.to};
    }
    const {from,to}=this.trip;
    const members=[...this.requests.values()].filter((r)=>r.from===from && r.to===to);
    if(!members.length) { this.trip=null; return; }
    const atFrom=this.height===.4+3.5*from;
    // At the boarding floor, hold the door a moment so the rest of the crew can step in.
    if(atFrom) for(const r of members) if(r.phase==='waiting') { r.phase='boarding'; this.dwell=0; }
    // Wait while anyone is stepping in or out.
    if(members.some((r)=>r.phase==='boarding' || r.phase==='exiting')) return;
    const riding=members.some((r)=>r.phase==='riding');
    if(riding && atFrom && (this.dwell+=dt)<2) return;
    const destination=.4+3.5*(riding?to:from);
    const diff=destination-this.height;
    this.height+=Math.sign(diff)*Math.min(Math.abs(diff),dt*14);
    if(this.height!==destination) return;
    for(const r of members) {
      if(riding && r.phase==='riding') r.phase='exiting';
      else if(!riding && r.phase==='waiting') r.phase='boarding';
    }
  }
  release(id:string) {
    this.requests.delete(id);
  }
}

const landing=(floor:number):Point=>({x:floor ? 38 : 46,z:-10.05});
export class CrewWalk {
  private path:Point[]=[];
  private goal='';
  private level:number;
  private atDoor=false;
  constructor(startHeight:number, private slot=0) { this.level=Math.round(startHeight/3.5); }
  advance(id:string,p:Vector3,target:Vector3,hoist:CrewHoist,dt:number) {
    const level=Math.round(target.y/3.5);
    let ride=hoist.requests.get(id);
    if(ride?.phase==='waiting' && ride.to!==level) { hoist.release(id); ride=undefined; }
    const move=(goal:Point,planned:boolean) => {
      const key=this.level+':'+goal.x+','+goal.z;
      const equipment=this.level===0 && planned ? hoist.groundEquipment : [];
      const blocked=this.path[0] && !clearPath(p,this.path[0],equipment);
      if(key!==this.goal || blocked) {
        this.goal=key;
        this.path=planned ? route(p,goal,this.level,equipment) : [goal];
      }
      const next=this.path[0];
      if(!next) {
        if(equipment.length && Math.hypot(goal.x-p.x,goal.z-p.z)>.05) this.goal='';
        return false;
      }
      const dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz);
      const fraction=d ? Math.min(1,dt*4/d) : 1;
      p.x+=dx*fraction; p.z+=dz*fraction;
      if(fraction===1) this.path.shift();
      return d>.001;
    };
    if(ride?.phase==='boarding' || ride?.phase==='riding' || ride?.phase==='exiting') {
      p.y=hoist.height+.14;
      if(ride.phase==='boarding') {
        if(!this.atDoor) {
          const door=landing(this.level);
          if(move(door,true)) return true;
          if(Math.hypot(p.x-door.x,p.z-door.z)>.05) return false;
          this.atDoor=true;
        }
        if(move({x:43.7+(((this.slot+1)%3)-1)*.45,z:-10.05+(((Math.floor(this.slot/3)+1)%3)-1)*.45},false)) return true;
        ride.phase='riding';
      } else if(ride.phase==='exiting') {
        this.level=ride.to;
        if(move(landing(this.level),false)) return true;
        hoist.release(id); this.goal=''; this.atDoor=false;
      }
      return false;
    }
    if(this.level!==level) {
      const door=landing(this.level);
      const entry={x:door.x+(this.level ? -1 : 1)*(this.slot%6)*.85,
        z:door.z-Math.floor(this.slot/6)*.85};
      if(move(entry,true)) return true;
      if(!ride && Math.hypot(p.x-entry.x,p.z-entry.z)<.05)
        hoist.requests.set(id,{from:this.level,to:level,phase:'waiting'});
      return false;
    }
    const walking=move(target,true);
    p.y=this.level && walking && p.x>=0 ? this.level*3.5+.54 : target.y;
    return walking;
  }
}
