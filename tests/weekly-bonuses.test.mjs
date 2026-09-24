import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, due, initialState, totals } from '../lib/domain.ts';
import { settleWeeklyBonuses, weeklyBasePotential } from '../lib/weekly-bonuses.ts';

let nextId = 0;
const complete = (state, taskId, day, now = `${day}T12:00:00Z`) => applyAction(state, 'aina', { type: 'complete', requestId: `weekly-${++nextId}`, child: 'aina', taskId, day }, new Date(now));
const smallPlan = () => {
  const state = initialState('2026-09-21T08:00:00Z');
  state.tasks = state.tasks.filter(task => ['bed', 'teeth'].includes(task.id)).map(task => ({ ...task, children: ['aina'], days: [1, 2], xp: task.id === 'bed' ? 2 : 3 }));
  return settleWeeklyBonuses(state, new Date('2026-09-21T08:00:00Z'));
};

test('the configured weekly ceiling is equal for both children', () => {
  const state = initialState();
  assert.equal(weeklyBasePotential(state.tasks, 'aina'), 302);
  assert.equal(weeklyBasePotential(state.tasks, 'iara'), 302);
  assert.equal(state.tasks.find(task => task.id === 'teeth').limit, 2);
  assert.equal(state.tasks.find(task => task.id === 'new-food').cadence, 'weekly');
});

test('weekly objectives can be completed once in a Monday to Sunday week', () => {
  let state = initialState();
  const goal = state.tasks.find(task => task.id === 'new-food');
  state = complete(state, goal.id, '2026-09-22');
  assert.equal(due(goal, 'aina', '2026-09-23', state), false);
  assert.equal(due(goal, 'aina', '2026-09-28', state), true);
});

test('the installation week starts on its first active day', () => {
  let state = initialState('2026-09-23T08:00:00Z');
  state.tasks = state.tasks.filter(task => task.id === 'bed').map(task => ({ ...task, children: ['aina'], days: [1, 2, 3, 4] }));
  state = settleWeeklyBonuses(state, new Date('2026-09-23T08:00:00Z'));
  state = complete(state, 'bed', '2026-09-23');
  state = complete(state, 'bed', '2026-09-24');
  state = settleWeeklyBonuses(state, new Date('2026-09-28T12:00:00Z'));
  assert.equal(state.weeklyBonuses[0].kind, 'super');
  assert.equal(totals(state, 'aina').xp, 10);
});

test('a completed task receives x2 and an incomplete task receives no bonus', () => {
  let state = smallPlan();
  for (const day of ['2026-09-21', '2026-09-22']) {
    state = complete(state, 'bed', day);
    state = complete(state, 'teeth', day);
  }
  state = complete(state, 'teeth', '2026-09-21');
  state = settleWeeklyBonuses(state, new Date('2026-09-28T12:00:00Z'));
  assert.deepEqual(state.weeklyBonuses.map(bonus => [bonus.kind, bonus.taskId, bonus.xp]), [['task', 'bed', 4]]);
  assert.equal(totals(state, 'aina').xp, 17);
});

test('super bonus pays x5 total and replaces all per-task x2 bonuses', () => {
  let state = smallPlan();
  for (const day of ['2026-09-21', '2026-09-22']) {
    state = complete(state, 'bed', day);
    state = complete(state, 'teeth', day);
    state = complete(state, 'teeth', day);
  }
  state = settleWeeklyBonuses(state, new Date('2026-09-28T12:00:00Z'));
  assert.deepEqual(state.weeklyBonuses.map(bonus => [bonus.kind, bonus.baseXp, bonus.xp]), [['super', 16, 64]]);
  assert.equal(totals(state, 'aina').xp, 80);

  const tooth = state.completions.find(record => record.taskId === 'teeth' && record.day === '2026-09-22');
  state = applyAction(state, 'xavi', { type: 'reverse', requestId: `weekly-${++nextId}`, id: tooth.id, reason: 'Registro incorrecto' }, new Date('2026-09-28T12:05:00Z'));
  assert.deepEqual(state.weeklyBonuses.map(bonus => [bonus.kind, bonus.taskId, bonus.xp]), [['task', 'bed', 4]]);
  assert.equal(totals(state, 'aina').xp, 17);
});

test('the full default week pays 1510 Xp to each child with their own schedules', () => {
  let state = settleWeeklyBonuses(initialState('2026-09-21T08:00:00Z'), new Date('2026-09-21T08:00:00Z'));
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(Date.UTC(2026, 8, 21 + offset)).toISOString().slice(0, 10);
    for (const child of ['aina', 'iara']) {
      for (const task of state.tasks.filter(task => task.children.includes(child) && task.days.includes(new Date(`${day}T12:00:00Z`).getUTCDay()))) {
        if (!due(task, child, day, state)) continue;
        for (let repetition = 0; repetition < task.limit; repetition++) {
          state = applyAction(state, child, { type: 'complete', requestId: `weekly-${++nextId}`, child, taskId: task.id, day }, new Date(`${day}T12:00:00Z`));
        }
      }
    }
  }
  state = settleWeeklyBonuses(state, new Date('2026-09-28T12:00:00Z'));
  for (const child of ['aina', 'iara']) {
    assert.equal(state.weeklyBonuses.filter(bonus => bonus.child === child).length, 1);
    assert.equal(state.weeklyBonuses.find(bonus => bonus.child === child).kind, 'super');
    assert.equal(totals(state, child).xp, 1510);
  }
});

test('a super objective is gated by an unused super bonus for that child', () => {
  let state = smallPlan();
  state = applyAction(state, 'xavi', { type: 'saveReward', requestId: `weekly-${++nextId}`, title: 'Amiga a dormir', description: '', xp: 0, requiresSuperBonus: true, children: ['aina', 'iara'], limit: 99 }, new Date('2026-09-21T08:00:00Z'));
  const reward = state.rewards.at(-1);
  assert.throws(() => applyAction(state, 'aina', { type: 'redeem', requestId: `weekly-${++nextId}`, child: 'aina', rewardId: reward.id }, new Date('2026-09-21T12:01:00Z')), /bonus/);
  for (const day of ['2026-09-21', '2026-09-22']) {
    state = complete(state, 'bed', day);
    state = complete(state, 'teeth', day);
    state = complete(state, 'teeth', day);
  }
  state = settleWeeklyBonuses(state, new Date('2026-09-28T12:00:00Z'));
  assert.throws(() => applyAction(state, 'iara', { type: 'redeem', requestId: `weekly-${++nextId}`, child: 'iara', rewardId: reward.id }, new Date('2026-09-28T12:02:00Z')), /bonus/);
  state = applyAction(state, 'aina', { type: 'redeem', requestId: `weekly-${++nextId}`, child: 'aina', rewardId: reward.id }, new Date('2026-09-28T12:03:00Z'));
  assert.equal(state.redemptions[0].bonusWeek, '2026-09-21');
  assert.equal(state.redemptions[0].xp, 0);
  assert.throws(() => applyAction(state, 'aina', { type: 'redeem', requestId: `weekly-${++nextId}`, child: 'aina', rewardId: reward.id }, new Date('2026-09-28T12:04:00Z')), /bonus/);
});
