import type { Child, Completion, Person, State } from './domain.ts';
import { childrenOf } from './family.ts';
import { discoveryIdForCompletion, discoveryWords, monthlyEarnedXp } from './discoveries.ts';
import { settleWeeklyBonuses } from './weekly-bonuses.ts';

const lifetimeThresholds = [
  ['xp-twenty-five',25],['xp-fifty',50],['xp-hundred',100],['xp-two-fifty',250],['xp-five-hundred',500],
] as const;
const madridDay = (at: string) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const madridMonth = (at: string) => madridDay(at).slice(0,7);
const shiftDay = (day: string, amount: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+amount); return date.toISOString().slice(0,10); };
const eventAt = (item: Completion) => item.effectiveAt ?? item.at;
const missions = (state: State, child: Child) => state.completions.filter(item => item.child === child && !item.reversed && item.xp > 0 && !item.taskId.startsWith('egg-'));
const missionXp = (state: State, child: Child) => missions(state,child).reduce((sum,item) => sum + item.xp,0);
const recentMissionXp = (state: State, child: Child, day: string) => missions(state,child).filter(item => item.day >= shiftDay(day,-6) && item.day <= day).reduce((sum,item) => sum + item.xp,0);
const claimedKey = (item: Completion) => discoveryIdForCompletion(item);
const hasClaim = (state: State, child: Child, key: string) => state.completions.some(item => item.child === child && item.taskId.startsWith('egg-') && !item.discoveryReset && claimedKey(item) === key);

type Crossing = { at: string; day: string; xp: number; id: string };
function monthlyEvents(state: State, child: Child, month: string): Crossing[] {
  return [
    ...state.completions.filter(item => item.child === child && !item.reversed && item.xp > 0 && item.day.slice(0,7) === month)
      .map(item => ({ at:eventAt(item),day:item.day,xp:item.xp,id:item.id })),
    ...(state.weeklyBonuses ?? []).filter(item => item.child === child && madridMonth(item.at) === month)
      .map(item => ({ at:item.at,day:madridDay(item.at),xp:item.xp,id:item.id })),
  ].sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}
function monthCrossing(state: State, child: Child, month: string): Crossing | null {
  let earned = 0;
  for (const event of monthlyEvents(state,child,month)) { earned += event.xp; if (earned >= 100) return event; }
  return null;
}
function addAward(state: State, child: Child, key: string, actor: Person, at: string, day: string, id: string, effectiveAt = at) {
  if (hasClaim(state,child,key)) return false;
  const title = discoveryWords(key);
  if (!title) return false;
  state.completions.push({ id,taskId:`egg-${key}`,child,title,xp:1,originalXP:1,icon:'sparkles',category:'afternoon',day,at,effectiveAt,actor,reversed:false });
  if (id.startsWith('legacy-xp-')) {
    const cycle=state.cycles?.find(item => item.closed && item.snapshot?.[child] && effectiveAt >= item.start && effectiveAt < item.end && at < item.end);
    if (cycle?.snapshot?.[child]) cycle.snapshot[child].xp += 1;
  }
  return true;
}

// Existing thresholds are replayed once at their original crossing. A reset claim is
// left reset; it may be earned again through the explicit reset flow.
export function settlePastXpDiscoveries(state: State): State {
  if (state.xpAwardsVersion === 1) return state;
  for (const child of childrenOf(state)) {
    const blocked = new Set(state.completions.filter(item => item.child === child && item.discoveryReset && item.taskId.startsWith('egg-')).map(claimedKey));
    const rows = missions(state,child).sort((a,b) => eventAt(a).localeCompare(eventAt(b)) || a.id.localeCompare(b.id));
    let earned = 0;
    const seenRows: Completion[] = [];
    for (const row of rows) {
      earned += row.xp;
      seenRows.push(row);
      for (const [key,threshold] of lifetimeThresholds) {
        if (earned >= threshold && !blocked.has(key)) addAward(state,child,key,child,eventAt(row),row.day,`legacy-xp-${child}-${key}`);
      }
      const recent = seenRows.filter(item => item.day >= shiftDay(row.day,-6) && item.day <= row.day).reduce((sum,item) => sum + item.xp,0);
      if (recent >= 25 && !blocked.has('cycle-twenty-five')) addAward(state,child,'cycle-twenty-five',child,eventAt(row),row.day,`legacy-xp-${child}-cycle-twenty-five`);
    }
    const months = new Set([
      ...state.completions.filter(item => item.child === child && !item.reversed).map(item => item.day.slice(0,7)),
      ...(state.weeklyBonuses ?? []).filter(item => item.child === child).map(item => madridMonth(item.at)),
    ]);
    for (const month of [...months].sort()) {
      const key = `month-hundred-${month}`;
      if (blocked.has(key) || hasClaim(state,child,key)) continue;
      const crossing = monthCrossing(state,child,month);
      if (crossing) addAward(state,child,key,child,crossing.at,crossing.day,`legacy-xp-${child}-${key}`);
    }
  }
  state.xpAwardsVersion = 1;
  return state;
}

// Run after the action and weekly-bonus reconciliation, inside the same state write.
export function awardCrossedXpDiscoveries(before: State, after: State, actor: Person | null, at: string, actionId: string) {
  const today = madridDay(at);
  for (const child of childrenOf(after)) {
    const oldXp = missionXp(before,child), newXp = missionXp(after,child);
    for (const [key,threshold] of lifetimeThresholds) {
      if (oldXp < threshold && newXp >= threshold) addAward(after,child,key,actor??child,at,today,`earned-${actionId}-${child}-${key}`);
    }
    if (recentMissionXp(before,child,today) < 25 && recentMissionXp(after,child,today) >= 25)
      addAward(after,child,'cycle-twenty-five',actor??child,at,today,`earned-${actionId}-${child}-cycle-twenty-five`);
    const months = new Set([
      today.slice(0,7),
      ...after.completions.filter(item => item.child === child).map(item => item.day.slice(0,7)),
      ...(after.weeklyBonuses ?? []).filter(item => item.child === child).map(item => madridMonth(item.at)),
    ]);
    for (const month of months) {
      const key = `month-hundred-${month}`;
      if (monthlyEarnedXp(before,child,month) >= 100 || monthlyEarnedXp(after,child,month) < 100 || hasClaim(after,child,key)) continue;
      const crossing = monthCrossing(after,child,month);
      const day = crossing?.day ?? `${month}-01`;
      addAward(after,child,key,actor??child,at,day,`earned-${actionId}-${child}-${key}`,crossing?.at ?? at);
    }
  }
  return after;
}

export function settleXpDiscoveries(state: State, now: Date, actor: Person | null, id: string) {
  const before=state.xpAwardsVersion===1?structuredClone(state):null;
  settleWeeklyBonuses(state,now);
  if (before) awardCrossedXpDiscoveries(before,state,actor,now.toISOString(),id);
  else settlePastXpDiscoveries(state);
  return state;
}
