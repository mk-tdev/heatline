// Warning levels come only from these rules. Agents may phrase a warning or raise a level
// from something a worker says, but nothing downstream may lower what this returns.

import type { Warning, WarningAction, WarningLevel, WarningReason, WorkerObservation } from '@heatline/contracts';
import {
  WARNING_THRESHOLDS as T,
  ZONE_RULES,
  exposureCapMin,
  heatZone,
  isAcclimatised,
  twlWorkClass,
} from './tables';

export interface WarningContext {
  observation: WorkerObservation;
  acclimatisationDay: number;
  experienced: boolean;
  /** WBGT where the worker is (shade-adjusted) */
  wbgt: number;
  /** other workers working in the same zone this minute */
  coworkersInZone: number;
}

const RANK: Record<WarningLevel, number> = { green: 0, yellow: 1, amber: 2, red: 3 };
export const maxLevel = (a: WarningLevel, b: WarningLevel): WarningLevel => (RANK[a] >= RANK[b] ? a : b);
export const levelRank = (level: WarningLevel): number => RANK[level];

export function evaluateWarning(ctx: WarningContext): Warning {
  const o = ctx.observation;
  const reasons: WarningReason[] = [];
  let level: WarningLevel = 'green';
  const raise = (to: WarningLevel, reason: WarningReason) => {
    level = maxLevel(level, to);
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  if (o.symptomReported) raise('red', 'red-flag');
  if (o.estPsi >= T.psi.red) raise('red', 'strain-severe');
  else if (o.estPsi >= T.psi.amber) raise('amber', 'strain-high');
  else if (o.estPsi >= T.psi.yellow) raise('yellow', 'strain-rising');

  if (o.deficitL >= T.deficitL.amber) raise('amber', 'water-deficit');
  else if (o.deficitL >= T.deficitL.yellow) raise('yellow', 'water-deficit');

  const working = o.activity !== 'rest';
  const workClass = twlWorkClass(o.activity);
  const zone = heatZone(ctx.wbgt);
  const rule = ZONE_RULES[zone];
  if (working && workClass) {
    const allowed = rule.workPerHour[workClass];
    if (allowed < 60) {
      if (o.continuousWorkMin > allowed + T.restOverdueMin) raise('amber', 'rest-overdue');
      else if (o.continuousWorkMin >= allowed - T.restDueSoonMin) raise('yellow', 'rest-overdue');
    }
    if (!rule.unacclimatisedAllowed && !isAcclimatised(ctx.acclimatisationDay)) raise('amber', 'zone-over-limit');
    if (rule.noLoneWork && ctx.coworkersInZone === 0) raise('yellow', 'alone-in-heat');
  }
  if (!isAcclimatised(ctx.acclimatisationDay) && o.exposureMin >= exposureCapMin(ctx.acclimatisationDay, ctx.experienced)) {
    if (working) raise('amber', 'acclimatisation-cap');
  }

  return { worker: o.worker, level, reasons, action: actionFor(level, reasons) };
}

function actionFor(level: WarningLevel, reasons: WarningReason[]): WarningAction {
  if (level === 'red') return 'emergency';
  if (level === 'amber') {
    if (reasons.includes('zone-over-limit') || reasons.includes('acclimatisation-cap')) return 'stop-work';
    return 'rest-cabin';
  }
  if (level === 'yellow') return reasons.includes('water-deficit') ? 'drink' : 'rest-shade';
  return 'continue';
}
