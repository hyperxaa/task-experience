import { addDays, madridDay, madridInstant } from './cycles.ts';
import type { Child, State, Task, Words } from './domain.ts';

export type WeeklyPlan = { week: string; startsOn?: string; tasks: Task[] };
export type WeeklyBonus = { id: string; week: string; child: Child; kind: 'task' | 'super'; taskId?: string; title: string | Words; baseXp: number; xp: number; at: string };

const children: Child[] = ['aina', 'iara'];
const dayOfWeek = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
export function bonusWeek(day: string) { return addDays(day, -((dayOfWeek(day) + 6) % 7)); }

function paused(state: State, child: Child, day: string) {
  return state.pauses.some(p => p.child === child && day >= p.from && day <= p.to && (!p.cancelledAt || day < madridDay(new Date(p.cancelledAt))));
}

function taskResult(state: State, task: Task, child: Child, week: string, startsOn = week) {
  const dates = Array.from({ length: 7 }, (_, index) => addDays(week, index))
    .filter(day => day >= startsOn && task.days.includes(dayOfWeek(day)) && !paused(state, child, day));
  if (!dates.length) return { expected: 0, complete: false, baseXp: 0 };
  const rows = state.completions.filter(c => c.child === child && c.taskId === task.id && !c.reversed && c.xp > 0 && dates.includes(c.day));
  const expected = task.cadence === 'weekly' ? task.limit : dates.length * task.limit;
  const complete = task.cadence === 'weekly'
    ? rows.length >= task.limit
    : dates.every(day => rows.filter(c => c.day === day).length >= task.limit);
  return { expected, complete, baseXp: rows.reduce((sum, row) => sum + row.xp, 0) };
}

export function weeklyBasePotential(tasks: Task[], child: Child) {
  return tasks.filter(task => task.status === 'approved' && !task.once && task.children.includes(child))
    .reduce((sum, task) => sum + task.xp * task.limit * (task.cadence === 'weekly' ? 1 : task.days.length), 0);
}

// Plans freeze the week's requirements. Task edits start affecting bonuses next Monday.
// Awards are reconciled from valid completions, so a later correction also corrects Xp.
export function settleWeeklyBonuses(state: State, now = new Date()) {
  const today = madridDay(now), currentWeek = bonusWeek(today);
  state.weeklyPlans ??= [];
  state.weeklyBonuses ??= [];
  if (!state.weeklyPlans.some(plan => plan.week === currentWeek)) {
    state.weeklyPlans.push({ week: currentWeek, startsOn: state.weeklyPlans.length ? currentWeek : today, tasks: structuredClone(state.tasks.filter(task => task.status === 'approved' && !task.once)) });
  }
  const awards: WeeklyBonus[] = [];
  for (const plan of state.weeklyPlans) {
    const followingMonday = addDays(plan.week, 7);
    const closed = followingMonday <= today;
    const closedAt = new Date(Date.parse(madridInstant(followingMonday, '00:00')) - 1).toISOString();
    for (const child of children) {
      const results = plan.tasks.filter(task => task.children.includes(child))
        .map(task => ({ task, ...taskResult(state, task, child, plan.week, plan.startsOn) }))
        .filter(result => result.expected > 0);
      if (!results.length) continue;
      if (results.every(result => result.complete)) {
        const baseXp = results.reduce((sum, result) => sum + result.baseXp, 0);
        const id = `super-${plan.week}-${child}`;
        awards.push({ id, week: plan.week, child, kind: 'super', title: { es: 'Superbonus semanal', ca: 'Superbonus setmanal', en: 'Weekly super bonus' }, baseXp, xp: baseXp * 4, at: state.weeklyBonuses.find(b => b.id === id)?.at ?? (closed ? closedAt : now.toISOString()) });
      } else {
        for (const result of results.filter(result => result.complete)) {
          const id = `bonus-${plan.week}-${child}-${result.task.id}`;
          awards.push({ id, week: plan.week, child, kind: 'task', taskId: result.task.id, title: result.task.title, baseXp: result.baseXp, xp: result.baseXp, at: state.weeklyBonuses.find(b => b.id === id)?.at ?? (closed ? closedAt : now.toISOString()) });
        }
      }
    }
  }
  state.weeklyBonuses = awards;
  return state;
}
