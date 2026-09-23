import test from 'node:test';
import assert from 'node:assert/strict';
import { ASLEEP_START, CYCLE_SECONDS, DAY_END, WAKE_START, WALK_SPEED, buildCatPlan, buildDayPlan, sampleCat, samplePerson } from '../app/house-motion.ts';

const people = ['A', 'I', 'X', 'M'];
const beds = { A: [55, 585], I: [220, 582], X: [325, 586], M: [348, 586] };
const hub = [188, 385];
const near = (a, b) => Math.abs(a - b) < 1e-7;
const samePoint = (a, b) => a.every((coordinate, index) => near(coordinate, b[index]));

test('all residents visit the rooms in changing orders without jumping or accelerating', () => {
  for (const person of people) {
    const orders = new Set();
    for (let seed = 1; seed <= 50; seed++) {
      const plan = buildDayPlan(person, seed);
      assert.ok(plan.duration < DAY_END);
      const visits = plan.segments.filter(segment => segment.activity).map(segment => segment.activity);
      assert.deepEqual(new Set(visits.slice(0, 5)), new Set(['sofa', 'kitchen', 'bath', 'bedroom', 'terrace']));
      orders.add(visits.slice(0, 5).join(','));
      for (let index = 0; index < plan.segments.length; index++) {
        const step = plan.segments[index];
        const length = Math.hypot(step.to[0] - step.from[0], step.to[1] - step.from[1]);
        if (length) assert.ok(near(length / (step.end - step.start), WALK_SPEED));
        if (index) assert.ok(samePoint(plan.segments[index - 1].to, step.from));
      }
      assert.ok(samePoint(samplePerson(person, plan, DAY_END).point, hub));
    }
    assert.ok(orders.size > 1);
  }
});

test('everyone reaches their bed before the shared night and wakes from that bed', () => {
  for (const person of people) {
    const plan = buildDayPlan(person, 13);
    for (const time of [ASLEEP_START - 0.01, ASLEEP_START, WAKE_START]) {
      assert.ok(samePoint(samplePerson(person, plan, time).point, beds[person]));
    }
    assert.ok(samePoint(samplePerson(person, plan, CYCLE_SECONDS).point, hub));
    assert.ok(samePoint(samplePerson(person, plan, 0).point, hub));
  }
});

test('the cat also returns to its couch and pauses during daytime', () => {
  const plan = buildCatPlan(23);
  assert.ok(plan.duration < DAY_END);
  assert.ok(plan.segments.some(segment => segment.activity && segment.end - segment.start > 2.5));
  assert.ok(samePoint(sampleCat(plan, ASLEEP_START).point, [258, 226]));
  assert.ok(samePoint(sampleCat(plan, WAKE_START).point, [258, 226]));
});
