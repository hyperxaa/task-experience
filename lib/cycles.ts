import type { Child, Completion, State } from './domain';

export type CycleRule = { day: number; time: string };
export type Cycle = CycleRule & { id: string; start: string; end: string; closed?: boolean; snapshot?: Record<Child, { xp: number; tasks: number }>; reconstructed?: boolean };
export const madridDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function addDays(day: string, n: number) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function madridTime(date: Date) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date); }
// Convert a Madrid wall-clock time without assuming a fixed summer/winter offset.
// For the autumn repeated hour use the first occurrence; spring gaps advance to the next valid minute.
export function madridInstant(day: string, time: string): string {
  const base = Date.parse(`${day}T${time}:00Z`), matches: number[] = [];
  for (const offset of [120, 60]) { const v = base - offset * 60000, d = new Date(v); if (madridDay(d) === day && madridTime(d) === time) matches.push(v); }
  if (matches.length) return new Date(Math.min(...matches)).toISOString();
  for (let v = base - 120 * 60000; v <= base; v += 60000) { const d = new Date(v); if (madridDay(d) === day && madridTime(d) >= time) return d.toISOString(); }
  throw new Error('Invalid Madrid time');
}
export function nextClose(now: Date, rule: CycleRule) {
  let day = madridDay(now);
  for (let i = 0; i < 8; i++, day = addDays(day, 1)) {
    if (new Date(day + 'T12:00:00Z').getUTCDay() === rule.day) { const end = madridInstant(day, rule.time); if (end > now.toISOString()) return end; }
  }
  throw new Error('Invalid cycle');
}
export function previousClose(end: string, rule: CycleRule) { return madridInstant(addDays(madridDay(new Date(end)), -7), rule.time); }
export function effectiveAt(c: Completion) { return c.effectiveAt ?? (madridDay(new Date(c.at)) === c.day ? c.at : madridInstant(c.day, '12:00')); }
export function xpAt(c: Completion, cutoff?: string) {
  if (!cutoff) return c.reversed ? 0 : c.xp;
  if (c.at >= cutoff) return 0;
  let xp = c.originalXP ?? c.xp;
  if (!c.adjustments?.length && c.reversed) return 0;
  for (const a of c.adjustments ?? []) if (a.at < cutoff) xp = a.to;
  return xp;
}
export function inCycle(c: Completion, cycle: Cycle) { const at = effectiveAt(c); return at >= cycle.start && at < cycle.end; }
export function cycleSummary(s: State, cycle: Cycle, child: Child, cutoff?: string) {
  const rows = s.completions.filter(c => c.child === child && inCycle(c, cycle));
  const bonuses = s.weeklyBonuses?.filter(b => b.child === child && b.at >= cycle.start && b.at < cycle.end && (!cutoff || b.at < cutoff)) ?? [];
  return { xp: rows.reduce((n, c) => n + xpAt(c, cutoff), 0) + bonuses.reduce((n,b)=>n+b.xp,0), tasks: rows.filter(c => xpAt(c, cutoff) > 0 && !c.taskId.startsWith('egg-')).length };
}
export function settleCycles(s: State, now = new Date()) {
  for(const c of s.completions){
    c.originalXP ??= c.xp;
    const task=s.tasks.find(t=>t.id===c.taskId);c.icon ??= task?.icon??'sparkles';c.category ??= task?.category??'afternoon';
    if(c.reversed&&!c.adjustments?.length){
      const title=typeof c.title==='string'?c.title:c.title.es;
      const audit=s.audit.find(a=>a.action==='reverse'&&a.title===title&&a.at>=c.at);
      c.adjustments=[{id:`legacy-${c.id}`,actor:c.correctedBy??c.actor,at:audit?.at??c.at,from:c.xp,to:0,reason:c.reason??'Corrección del historial anterior'}];c.xp=0;
    }
  }
  s.badges ??= [];
  for(const child of ['aina','iara'] as Child[]){const rows=s.completions.filter(c=>c.child===child&&!c.reversed).sort((a,b)=>a.at.localeCompare(b.at));for(const threshold of [1,10,25,50,100])if(rows.length>=threshold&&!s.badges.some(b=>b.child===child&&b.threshold===threshold))s.badges.push({child,threshold,at:rows[threshold-1].at});}
  s.cycleRule ??= { day: 1, time: '00:00' };
  s.cycles ??= [];
  if (!s.cycles.length) {
    const earliest = s.completions.map(effectiveAt).sort()[0] ?? now.toISOString();
    const end = nextClose(new Date(earliest), s.cycleRule);
    s.cycles.push({ ...s.cycleRule, id: end, start: previousClose(end, s.cycleRule), end, reconstructed: s.completions.length > 0 });
  }
  let open = s.cycles[s.cycles.length - 1];
  const earliest = s.completions.map(effectiveAt).sort()[0];
  while(earliest&&earliest<s.cycles[0].start){const first=s.cycles[0],end=first.start;const previous:Cycle={day:first.day,time:first.time,id:end,start:previousClose(end,first),end,closed:true,reconstructed:true};previous.snapshot={aina:cycleSummary(s,previous,'aina',end),iara:cycleSummary(s,previous,'iara',end)};s.cycles.unshift(previous);}
  while (open.end <= now.toISOString()) {
    open.closed = true;
    open.snapshot = { aina: cycleSummary(s, open, 'aina', open.end), iara: cycleSummary(s, open, 'iara', open.end) };
    const end = nextClose(new Date(open.end), s.cycleRule);
    open = { ...s.cycleRule, id: end, start: open.end, end };
    s.cycles.push(open);
  }
  s.weekStart = 1;
  return s;
}
export function weekOrder(s: State) { void s; return [1,2,3,4,5,6,0]; }
