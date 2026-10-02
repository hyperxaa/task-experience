import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain.ts';
import { madridInstant } from '../lib/cycles.ts';
import { dashboardModel, dashboardPeriod, dashboardSummary, weeklyEarningForecast } from '../lib/family-dashboard.ts';

const at = (day, time = '00:00') => Date.parse(madridInstant(day, time));
const fixture = (created = '2026-09-01') => {
  const state = initialState(madridInstant(created, '00:00'));
  state.tasks = state.tasks.filter(task => task.id === 'bed');
  state.completions = [];
  state.weeklyBonuses = [];
  state.cycles = [];
  state.weeklyPlans = [];
  return state;
};
const completion = (day, xp, time = '12:00', extra = {}) => ({ id: day + time, child: 'aina', taskId: 'bed', title: 'Bed', actor: 'aina', day, at: madridInstant(day, time), xp, reversed: false, ...extra });

test('dashboard respects exact stored cycle boundaries and configured close time', () => {
  const state = fixture();
  state.cycleRule = { day: 0, time: '22:00' };
  state.cycles = [{ id: 'transition', day: 0, time: '22:00', start: madridInstant('2026-09-20', '21:00'), end: madridInstant('2026-09-27', '22:00') }];
  const period = dashboardPeriod(state, 'week', at('2026-09-27', '21:30'));
  assert.deepEqual(period, { start: at('2026-09-20', '21:00'), end: at('2026-09-27', '22:00') });
  state.completions.push(completion('2026-09-27', 5, '21:59'), completion('2026-09-27', 10, '22:00'));
  assert.equal(dashboardSummary(state, 'aina', period).earned, 5);
  const next = dashboardPeriod(state, 'week', period.end);
  assert.equal(next.start, period.end);
  assert.equal(dashboardSummary(state, 'aina', next).earned, 10);
});

test('dashboard separates earnings and spending, and attributes backdated entries to their effective day', () => {
  const state = fixture();
  state.completions.push(completion('2026-09-21', 5, '12:00', { at: madridInstant('2026-09-24', '14:00') }), completion('2026-09-21', 100, '13:00', { reversed: true }), completion('2026-09-21', 3, '14:00', { taskId: 'egg-house' }));
  state.weeklyBonuses.push({ child: 'aina', xp: 20, at: madridInstant('2026-09-21', '19:00') });
  state.redemptions = ['pending', 'fulfilled', 'cancelled'].map((status, index) => ({ child: 'aina', xp: [4, 6, 80][index], at: madridInstant('2026-09-21', '20:00'), status }));
  const summary = dashboardSummary(state, 'aina', dashboardPeriod(state, 'day', at('2026-09-21')));
  assert.deepEqual(summary, { earned: 28, mission: 5, discovery: 3, bonus: 20, completions: 1, activeDays: 1, spent: 10 });
});

test('the real chart changes at each Xp event and keeps calendar ticks stable', () => {
  const state = fixture();
  const day = '2026-09-21';
  const now = at(day, '16:00');
  state.completions.push(completion(day, 5, '10:15'), completion(day, 3, '14:15'));
  const model = dashboardModel(state, ['aina'], 'day', now, now);
  assert.equal(model.series.find(point => point.at === at(day, '10:15')).ainaActual, 0);
  assert.equal(model.series.find(point => point.at === at(day, '10:15') + 1).ainaActual, 5);
  assert.equal(model.series.find(point => point.at === at(day, '14:15') + 1).ainaActual, 8);
  assert.equal(model.series.find(point => point.at === now).ainaActual, model.childrenData[0].actual.earned);
  assert.equal(model.axisTimes.includes(at(day, '10:15')), false);
  state.completions[1].xp = 0;
  const corrected = dashboardModel(state, ['aina'], 'day', now, now);
  assert.equal(corrected.series.find(point => point.at === now).ainaActual, 5);
});

test('current periods compare equal elapsed time, and forecast lines reach the last-hour closing point', () => {
  const state = fixture('2026-09-26');
  state.completions.push(completion('2026-09-26', 8), completion('2026-09-27', 12), completion('2026-09-27', 200, '23:59'), completion('2026-09-28', 7));
  const now = at('2026-09-28', '23:45');
  const model = dashboardModel(state, ['aina'], 'day', now, now);
  const child = model.childrenData[0];
  assert.equal(child.actual.earned, 7);
  assert.equal(child.prior.earned, 12); // Yesterday's 23:59 is beyond the comparison cutoff.
  assert.equal(child.pace.days, 2);
  assert.equal(child.pace.daily, 110);
  assert.equal(model.series.at(-1).at, at('2026-09-29'));
  assert.equal(model.series.at(-1).ainaNoBonus, child.estimate);
  assert.equal(model.series.at(-1).ainaWithBonus, child.estimateWithBonus);
  assert.ok(child.estimateWithBonus > child.estimate && child.estimate > 7);
  assert.equal(model.series.at(-1).ainaActual, null);
  const joint = model.series.find(point => point.at === now);
  assert.equal(joint.ainaActual, joint.ainaNoBonus);
  assert.equal(joint.ainaActual, joint.ainaWithBonus);
});

test('forecast uses full calendar days, includes quiet days, and excludes bonuses and discoveries from the pace', () => {
  const state = fixture('2026-09-01');
  state.completions.push(completion('2026-09-27', 56), completion('2026-09-27', 1000, '13:00', { taskId: 'egg-house' }), completion('2026-09-29', 500));
  state.weeklyBonuses.push({ child: 'aina', xp: 2000, at: madridInstant('2026-09-27', '20:00') });
  const now = at('2026-09-29', '12:00');
  const model = dashboardModel(state, ['aina'], 'month', now, now);
  assert.equal(model.childrenData[0].pace.days, 28);
  assert.equal(model.childrenData[0].pace.daily, 2);
  assert.equal(model.childrenData[0].estimate, model.childrenData[0].actual.earned + 3);
  assert.equal(model.childrenData[0].estimateWithBonus, model.childrenData[0].actual.earned + 15);
});

test('no forecasts before a full observation day, or for closed periods', () => {
  const state = fixture('2026-09-28');
  const now = at('2026-09-28', '18:00');
  const fresh = dashboardModel(state, ['aina'], 'week', now, now);
  assert.equal(fresh.childrenData[0].estimate, null);
  assert.equal(fresh.series.some(point => 'ainaWithBonus' in point), false);
  state.completions.push(completion('2026-09-27', 8));
  const closed = dashboardModel(state, ['aina'], 'day', at('2026-09-27'), now);
  assert.equal(closed.open, false);
  assert.equal(closed.series.at(-1).ainaActual, 8);
  assert.equal(closed.series.some(point => 'ainaNoBonus' in point), false);
});

test('calendar days retain their forecast weight during daylight-saving changes', () => {
  const state = fixture('2026-03-28');
  state.completions.push(completion('2026-03-28', 10));
  const now = at('2026-03-29');
  const model = dashboardModel(state, ['aina'], 'day', now, now);
  assert.equal(model.period.end - model.period.start, 23 * 3600000);
  assert.ok(Math.abs(model.childrenData[0].estimate - 10) < 1e-9);
  assert.ok(Math.abs(model.childrenData[0].estimateWithBonus - 50) < 1e-9);
});

test('a missed daily mission loses its ×2 and makes the ×5 unreachable; totals include current balance', () => {
  const state = fixture('2026-09-28');
  state.tasks[0].children = ['aina'];
  const result = weeklyEarningForecast(state, 'aina', '2026-09-28', '2026-09-30', 40);
  assert.equal(result.taskChances[0].possible, false);
  assert.equal(result.taskChances[0].missed, 2);
  assert.equal(result.lostTaskBonus, 7);
  assert.equal(result.superPossible, false);
  assert.equal(result.noBonusTotal, 45); // Current balance plus five remaining daily completions.
  assert.equal(result.x2Total, 45);
  assert.equal(result.x5Total, 75); // Theoretical full-week comparison remains visible despite being unreachable.
  assert.equal(result.noBonusCeiling, 47);
  assert.equal(result.x2Ceiling, 54);
  assert.equal(result.x5Ceiling, 75);
});

test('weekly ceilings keep the balance once and count ×2 only for missions still achievable', () => {
  const state = fixture('2026-09-28');
  state.tasks[0].children = ['aina'];
  const futureMission = { ...state.tasks[0], id: 'future', title: 'Future mission', xp: 3, days: [4, 5, 6, 0] };
  state.tasks.push(futureMission);
  const result = weeklyEarningForecast(state, 'aina', '2026-09-28', '2026-09-30', 40);
  const missed = result.taskChances.find(item => item.taskId === 'bed');
  const stillPossible = result.taskChances.find(item => item.taskId === 'future');
  assert.equal(missed.possible, false);
  assert.equal(missed.possibleBonus, 0);
  assert.equal(stillPossible.possible, true);
  assert.equal(stillPossible.possibleBonus, 12);
  assert.equal(result.possibleTaskBonus, 12);
  assert.equal(result.noBonusTotal, 57);
  assert.equal(result.noBonusCeiling, 59);
  assert.equal(result.x2Total, 69);
  assert.equal(result.x2Ceiling, 78);
  assert.equal(result.superPossible, false);
});

test('excused dates do not block the weekly bonuses and award no XP themselves', () => {
  const state = fixture('2026-09-28');
  state.tasks[0].children = ['aina'];
  state.missionExcusals = [{ id: 'skip-tue', taskId: 'bed', child: 'aina', scope: 'day', from: '2026-09-29', to: '2026-09-29', actor: 'xavi', at: madridInstant('2026-09-29', '09:00') }];
  state.completions.push(completion('2026-09-28', 1));
  const result = weeklyEarningForecast(state, 'aina', '2026-09-28', '2026-09-30', 10);
  assert.equal(result.taskChances[0].possible, true);
  assert.equal(result.taskChances[0].missed, 0);
  assert.equal(result.possibleTaskBonus, 6);
  assert.equal(result.superPossible, true);
  assert.equal(result.noBonusTotal, 15);
  assert.equal(result.x2Total, 21);
  assert.equal(result.x5Total, 39);
});

test('a task added midweek is eligible for ×5 from its start but never receives a ×2', () => {
  const state = fixture('2026-09-28');
  state.tasks[0].children = ['aina'];
  const added = { ...state.tasks[0], id: 'new', title: 'New mission', xp: 3, days: [1,2,3,4,5], created: madridInstant('2026-09-30', '00:00') };
  state.tasks = [added];
  state.weeklyPlans = [{ week: '2026-09-28', startsOn: '2026-09-28', tasks: [structuredClone(added)], taskStartsOn: { new: '2026-09-30' }, noTaskBonus: ['new'] }];
  const result = weeklyEarningForecast(state, 'aina', '2026-09-28', '2026-09-30', 0);
  const chance = result.taskChances.find(item => item.taskId === 'new');
  assert.equal(chance.possible, true);
  assert.equal(chance.possibleBonus, 0);
  assert.equal(result.superPossible, true);
});

test('a weekly cadence mission stays achievable while a required future day remains', () => {
  const state = fixture('2026-09-28');
  state.tasks[0].children = ['aina'];
  state.tasks[0].cadence = 'weekly';
  state.tasks[0].days = [1,4]; // Monday passed; Thursday remains.
  const result = weeklyEarningForecast(state, 'aina', '2026-09-28', '2026-09-30', 0);
  assert.equal(result.taskChances[0].possible, true);
  assert.equal(result.taskChances[0].missed, 0);
});

test('missing one past repetition loses the whole daily mission bonus', () => {
  const state = fixture('2026-09-28');
  state.tasks[0].children = ['aina'];
  state.tasks[0].limit = 2;
  state.completions.push(
    completion('2026-09-28', 1, '10:00'), completion('2026-09-28', 1, '18:00'),
    completion('2026-09-29', 1, '10:00'), completion('2026-09-29', 1, '18:00'),
    completion('2026-09-30', 1, '10:00'),
  );
  const result = weeklyEarningForecast(state, 'aina', '2026-09-28', '2026-10-01', 0);
  assert.equal(result.taskChances[0].missed, 1);
  assert.equal(result.taskChances[0].possible, false);
  assert.equal(result.lostTaskBonus, 14);
});
