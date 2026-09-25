import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, isParent, visibleState } from '../lib/domain.ts';
import { childrenOf, parseFamilyMembers } from '../lib/family.ts';

test('custom setup supports two mothers and one child without demo-only missions', () => {
  const members = parseFamilyMembers([{ name:'Ana',role:'adult' },{ name:'Clara',role:'adult' },{ name:'Noa',role:'child' }]);
  const state = initialState('2026-09-26T12:00:00.000Z', members, 'custom');
  assert.deepEqual(childrenOf(state), ['member-3']);
  assert.equal(isParent('member-1', state), true);
  assert.equal(isParent('member-2', state), true);
  assert.equal(isParent('member-3', state), false);
  assert.equal(state.tasks.some(task => ['school-homework','new-food','bag-extra-iara'].includes(task.id)), false);
  assert.equal(state.tasks.every(task => task.children.every(child => child === 'member-3')), true);
  assert.equal(visibleState(state, 'member-3').preferences['member-1'], undefined);
});

test('custom setup accepts one adult and several children, with distinct names', () => {
  const members = parseFamilyMembers([{ name:'Alex',role:'adult' },{ name:'Kai',role:'child' },{ name:'Leo',role:'child' }]);
  assert.equal(childrenOf(initialState('2026-09-26T12:00:00.000Z', members, 'custom')).length, 2);
  assert.throws(() => parseFamilyMembers([{ name:'Alex',role:'adult' },{ name:'alex',role:'child' }]));
});
