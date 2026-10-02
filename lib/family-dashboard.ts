import type { Child, State } from './domain.ts';
import { addDays, effectiveAt, madridDay, madridInstant, nextClose, previousClose } from './cycles.ts';
import { bonusWeek, excusalForDay, paused, type WeeklyPlan } from './weekly-bonuses.ts';

export type DashboardMode = 'day' | 'week' | 'month' | 'year';
export type DashboardPeriod = { start: number; end: number };
type Event = { at: number; xp: number; kind: 'mission' | 'discovery' | 'bonus' };
export type WeeklyTaskChance = { taskId: string; name: string; possible: boolean; missed: number; pendingBase: number; possibleBonus: number; baseXp: number; expectedBase: number };
export type WeeklyEarningForecast = {
  week: string; current: boolean; taskChances: WeeklyTaskChance[]; earnedThisWeek: number;
  pendingBase: number; possibleTaskBonus: number; lostTaskBonus: number; superPossible: boolean;
  superBaseXp: number; paidTaskBonus: number; superPaid: number; noBonusTotal: number;
  x2Total: number; x5Total: number; noBonusCeiling: number; x2Ceiling: number; x5Ceiling: number;
  configuredBase: number; recommendation: { small: number; medium: number; large: number };
};
const DAY_MS = 86400000;
const midnight = (day: string) => Date.parse(madridInstant(day, '00:00'));
const localDay = (at: number) => madridDay(new Date(at));

// All intervals are [start, end), including configured weekly closing times.
export function dashboardPeriod(state: State, mode: DashboardMode, anchor: number): DashboardPeriod {
  const day = localDay(anchor);
  if (mode === 'day') return { start: midnight(day), end: midnight(addDays(day, 1)) };
  if (mode === 'month') {
    const start = `${day.slice(0, 7)}-01`;
    const next = new Date(`${start}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { start: midnight(start), end: midnight(next.toISOString().slice(0, 10)) };
  }
  if (mode === 'year') return { start: midnight(`${day.slice(0, 4)}-01-01`), end: midnight(`${Number(day.slice(0, 4)) + 1}-01-01`) };
  const saved = state.cycles?.find(cycle => Date.parse(cycle.start) <= anchor && anchor < Date.parse(cycle.end));
  if (saved) return { start: Date.parse(saved.start), end: Date.parse(saved.end) };
  const rule = state.cycleRule ?? { day: 1, time: '00:00' };
  const end = nextClose(new Date(anchor), rule);
  return { start: Date.parse(previousClose(end, rule)), end: Date.parse(end) };
}

function eventsFor(state: State, child: Child): Event[] {
  return [
    ...state.completions.filter(item => item.child === child && !item.reversed).map(item => ({
      at: Date.parse(effectiveAt(item)), xp: item.xp, kind: item.taskId.startsWith('egg-') ? 'discovery' as const : 'mission' as const,
    })),
    ...(state.weeklyBonuses ?? []).filter(item => item.child === child).map(item => ({ at: Date.parse(item.at), xp: item.xp, kind: 'bonus' as const })),
  ].sort((a, b) => a.at - b.at);
}

function sumEvents(events: Event[], period: DashboardPeriod) {
  const result = { earned: 0, mission: 0, discovery: 0, bonus: 0, completions: 0, activeDays: 0 };
  const days = new Set<string>();
  for (const event of events) {
    if (event.at < period.start || event.at >= period.end) continue;
    result.earned += event.xp;
    result[event.kind] += event.xp;
    if (event.kind === 'mission') { result.completions++; days.add(localDay(event.at)); }
  }
  result.activeDays = days.size;
  return result;
}

export function dashboardSummary(state: State, child: Child, period: DashboardPeriod) {
  const spent = state.redemptions.filter(item => item.child === child && item.status !== 'cancelled' && Date.parse(item.at) >= period.start && Date.parse(item.at) < period.end).reduce((sum, item) => sum + item.xp, 0);
  return { ...sumEvents(eventsFor(state, child), period), spent };
}

function weekPlan(state: State, week: string): WeeklyPlan | undefined {
  return state.weeklyPlans?.find(plan => plan.week === week);
}

export function weeklyEarningForecast(state: State, child: Child, week: string, today: string, balance: number): WeeklyEarningForecast {
  const plan = weekPlan(state, week);
  const monday = week;
  const end = addDays(week, 7);
  const planStart = plan?.startsOn ?? monday;
  const taskRows = plan?.tasks ?? state.tasks.filter(task => task.status === 'approved');
  const chances: WeeklyTaskChance[] = [];
  let configuredBase = 0;
  for (const task of taskRows) {
    if (task.once || task.status !== 'approved' || !task.children.includes(child)) continue;
    const taskStart = plan?.taskStartsOn?.[task.id] ?? monday;
    const dates = Array.from({ length: 7 }, (_, offset) => addDays(monday, offset))
      .filter(day => day >= planStart && day >= taskStart && task.days.includes(new Date(day + 'T12:00:00Z').getUTCDay()) && !paused(state, child, day) && !excusalForDay(state, task.id, child, day));
    if (!dates.length || (task.cadence === 'weekly' && excusalForDay(state, task.id, child, week)?.scope === 'week')) continue;
    const completions = state.completions.filter(item => item.child === child && item.taskId === task.id && item.day >= monday && item.day < end && !item.reversed && item.xp > 0);
    const perDay = new Map<string, number>();
    for (const item of completions) perDay.set(item.day, (perDay.get(item.day) ?? 0) + 1);
    const baseXp = completions.reduce((sum, item) => sum + item.xp, 0);
    const expected = task.cadence === 'weekly' ? task.limit : dates.length * task.limit;
    const count = completions.length;
    let missed = 0, pendingSlots = 0, possible: boolean;
    if (task.cadence === 'weekly') {
      const openSlots = dates.filter(day => day >= today).length * task.limit;
      const remaining = Math.max(0, expected - count);
      pendingSlots = Math.min(remaining, openSlots);
      possible = pendingSlots >= remaining;
      missed = Math.max(0, remaining - openSlots);
    } else {
      for (const day of dates) {
        const remaining = Math.max(0, task.limit - (perDay.get(day) ?? 0));
        if (day < today) missed += remaining;
        else pendingSlots += remaining;
      }
      possible = missed === 0;
    }
    const pendingBase = pendingSlots * task.xp;
    const totalTaskXp = baseXp + pendingBase;
    const individualBonusAllowed = !plan?.noTaskBonus?.includes(task.id);
    const possibleBonus = possible && individualBonusAllowed ? totalTaskXp : 0;
    const expectedBase = expected * task.xp;
    chances.push({ taskId: task.id, name: typeof task.title === 'string' ? task.title : task.title.es, possible, missed, pendingBase, possibleBonus, baseXp, expectedBase });
    configuredBase += expected * task.xp;
  }
  const bonusWeekRows = (state.weeklyBonuses ?? []).filter(item => item.child === child && item.week === week);
  const earnedThisWeek = state.completions.filter(item => item.child === child && item.day >= monday && item.day < end && !item.reversed).reduce((sum, item) => sum + item.xp, 0)
    + bonusWeekRows.reduce((sum, item) => sum + item.xp, 0);
  const pendingBase = chances.reduce((sum, item) => sum + item.pendingBase, 0);
  const possibleTaskBonus = bonusWeekRows.some(item => item.kind === 'super') ? 0
    : chances.reduce((sum, item) => sum + Math.max(0, item.possibleBonus - (bonusWeekRows.find(bonus => bonus.kind === 'task' && bonus.taskId === item.taskId)?.xp ?? 0)), 0);
  const lostTaskBonus = chances.filter(item => (item.missed > 0 || !item.possible) && !plan?.noTaskBonus?.includes(item.taskId)).reduce((sum, item) => sum + item.expectedBase, 0);
  const eligibleTasks = chances.length > 0 && chances.every(item => item.possible);
  const superBaseXp = chances.reduce((sum, item) => sum + item.expectedBase, 0);
  const missedBase = chances.reduce((sum, item) => sum + Math.max(0, item.expectedBase - item.baseXp - item.pendingBase), 0);
  const superPossible = eligibleTasks && superBaseXp > 0;
  const paidTaskBonus = bonusWeekRows.filter(item => item.kind === 'task').reduce((sum, item) => sum + item.xp, 0);
  const superPaid = bonusWeekRows.find(item => item.kind === 'super')?.xp ?? 0;
  const noBonusTotal = balance + pendingBase;
  const x2Total = noBonusTotal + possibleTaskBonus;
  const x5Total = superPaid > 0 ? noBonusTotal : noBonusTotal + missedBase - paidTaskBonus + superBaseXp * 4;
  // These ceilings include today's available balance once, then add the full
  // configured week's remaining theoretical earnings (including missed slots).
  const noBonusCeiling = balance + pendingBase + missedBase;
  const taskBonusCeiling = plan?.noTaskBonus?.length
    ? chances.filter(item => !plan.noTaskBonus!.includes(item.taskId)).reduce((sum, item) => sum + item.expectedBase, 0)
    : chances.reduce((sum, item) => sum + item.expectedBase, 0);
  const x2Ceiling = superPaid > 0 ? noBonusCeiling : noBonusCeiling + Math.max(0, taskBonusCeiling - paidTaskBonus);
  const x5Ceiling = superPaid > 0 ? noBonusCeiling : noBonusCeiling - paidTaskBonus + superBaseXp * 4;
  const small = configuredBase ? Math.max(1, Math.round(configuredBase / 7 / 5) * 5) : 0;
  const medium = configuredBase ? Math.max(small, Math.round(configuredBase / 2 / 5) * 5) : 0;
  const large = configuredBase ? Math.max(medium, Math.round(configuredBase / 5) * 5) : 0;
  return { week, current: week === bonusWeek(today), taskChances: chances, earnedThisWeek, pendingBase, possibleTaskBonus, lostTaskBonus,
    superPossible, superBaseXp, paidTaskBonus, superPaid, noBonusTotal, x2Total, x5Total,
    noBonusCeiling, x2Ceiling, x5Ceiling, configuredBase,
    recommendation: { small, medium, large } };
}

function observedPace(state: State, child: Child, events: Event[], now: number) {
  const today = localDay(now);
  // Use completed calendar days, including quiet days, rather than counting today
  // as a whole day. A family's first partial installation day is excluded too.
  const starts = [
    ...state.tasks.filter(task => task.children.includes(child)).map(task => task.created),
    ...(state.weeklyPlans ?? []).flatMap(plan => plan.tasks.filter(task => task.children.includes(child)).map(task => task.created)),
    ...events.filter(event => event.kind === 'mission').map(event => new Date(event.at).toISOString()),
  ].map(Date.parse).filter(at => Number.isFinite(at) && at <= now);
  const first = starts.length ? Math.min(...starts) : now;
  const firstDay = localDay(first);
  const firstFullDay = first === midnight(firstDay) ? firstDay : addDays(firstDay, 1);
  const startDay = [firstFullDay, addDays(today, -28)].sort().at(-1)!;
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(startDay)) / DAY_MS));
  const recent = sumEvents(events, { start: midnight(startDay), end: midnight(today) });
  return { days, daily: days ? recent.mission / days : null };
}

function sampleTimes(mode: DashboardMode, period: DashboardPeriod, now: number, events: Event[]) {
  const values = new Set([period.start, period.end]);
  if (now > period.start && now < period.end) values.add(now);
  // A calendar-only series hides changes until the next day marker. Keep both
  // sides of each earning event so the real line moves when its Xp changes.
  for (const event of events) {
    if (event.at >= period.start && event.at <= now && event.at < period.end) {
      values.add(event.at);
      if (event.at + 1 < period.end && event.at + 1 <= now) values.add(event.at + 1);
    }
  }
  if (mode === 'day') {
    for (let at = period.start + 3600000; at < period.end; at += 3600000) values.add(at);
  } else {
    let day = addDays(localDay(period.start), 1);
    for (let at = midnight(day); at < period.end; day = addDays(day, 1), at = midnight(day)) values.add(at);
  }
  return [...values].sort((a, b) => a - b);
}

// Fractions of local days preserve a daily pace across 23/25-hour DST days.
function daysBetween(start: number, end: number) {
  let days = 0;
  for (let at = start; at < end;) {
    const day = localDay(at), dayStart = midnight(day), dayEnd = midnight(addDays(day, 1));
    const until = Math.min(end, dayEnd);
    days += (until - at) / (dayEnd - dayStart);
    at = until;
  }
  return days;
}

export function dashboardModel(state: State, children: Child[], mode: DashboardMode, anchor: number, now: number) {
  const period = dashboardPeriod(state, mode, anchor);
  const open = period.start <= now && now < period.end;
  const previous = dashboardPeriod(state, mode, period.start - 1);
  const comparison = { ...previous, end: open ? Math.min(previous.end, previous.start + now - period.start) : previous.end };
  const childEvents = new Map(children.map(child => [child, eventsFor(state, child)]));
  const axisTimes = sampleTimes(mode, period, now, []);
  const points = sampleTimes(mode, period, now, [...childEvents.values()].flat());
  let futureDays = 0, futureAt = now;
  const forecastDays = points.map(at => {
    if (at > futureAt) { futureDays += daysBetween(futureAt, at); futureAt = at; }
    return futureDays;
  });
  const series: Array<Record<string, number | null>> = points.map(at => ({ at }));
  const childrenData = children.map(child => {
    const events = childEvents.get(child)!;
    const actual = dashboardSummary(state, child, { start: period.start, end: Math.min(period.end, now + 1) });
    const prior = sumEvents(events, comparison);
    const pace = observedPace(state, child, events, now);
    const future = open && pace.daily !== null ? pace.daily * futureDays : null;
    const rangeEvents = events.filter(event => event.at >= period.start && event.at < period.end);
    let index = 0, cumulative = 0;
    for (let i = 0; i < points.length; i++) {
      const at = points[i];
      while (index < rangeEvents.length && rangeEvents[index].at < at) cumulative += rangeEvents[index++].xp;
      series[i][`${child}Actual`] = at <= now ? cumulative : null;
      if (open && at >= now && pace.daily !== null) {
        const gain = pace.daily * forecastDays[i];
        series[i][`${child}NoBonus`] = actual.earned + gain;
        series[i][`${child}WithBonus`] = actual.earned + gain * 5;
      }
      // The current snapshot includes a completion timestamped exactly at `now`.
      if (at === now) series[i][`${child}Actual`] = actual.earned;
    }
    return { child, actual, prior, pace, delta: actual.earned - prior.earned,
      estimate: future === null ? null : actual.earned + future,
      estimateWithBonus: future === null ? null : actual.earned + future * 5 };
  });
  return { period, previous, comparison, open, series, axisTimes, childrenData };
}
