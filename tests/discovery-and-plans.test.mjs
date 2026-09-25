import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, due, initialState, totals } from '../lib/domain.ts';
import { settleWeeklyBonuses } from '../lib/weekly-bonuses.ts';
import { objectiveDiscoveryCandidates } from '../lib/discoveries.ts';
import { parseExportedState } from '../lib/state-import.ts';

const at = day => new Date(`${day}T12:00:00Z`);
const action = (state, actor, id, day, rest) => applyAction(state, actor, {requestId:id,...rest},at(day));
const small = () => {
  const state=initialState('2026-09-21T08:00:00Z');
  state.tasks=state.tasks.filter(task=>task.id==='bed').map(task=>({...task,children:['aina'],days:[1,2],xp:2}));
  return settleWeeklyBonuses(state,at('2026-09-21'));
};

test('a new Tuesday mission counts for superbonus from Tuesday, but has no individual x2 that week',()=>{
  let state=small();
  state=action(state,'aina','bed-monday','2026-09-21',{type:'complete',child:'aina',taskId:'bed'});
  state=action(state,'xavi','new-tuesday','2026-09-22',{type:'saveTask',title:'Nueva misión',description:'',xp:3,children:['aina'],category:'all-day',days:[2],once:false,limit:1});
  const task=state.tasks.at(-1);
  assert.equal(state.weeklyPlans[0].taskStartsOn[task.id],'2026-09-22');
  assert.deepEqual(state.weeklyPlans[0].noTaskBonus,[task.id]);
  assert.equal(due(task,'aina','2026-09-21',state),false);
  state=action(state,'aina','new-complete','2026-09-22',{type:'complete',child:'aina',taskId:task.id});
  assert.equal(state.weeklyBonuses.some(b=>b.taskId===task.id),false);
  state=action(state,'aina','bed-tuesday','2026-09-22',{type:'complete',child:'aina',taskId:'bed'});
  assert.equal(state.weeklyBonuses.length,1);
  assert.equal(state.weeklyBonuses[0].kind,'super');
  assert.equal(totals(state,'aina').xp,35);
});

test('edits keep the current week requirements and Xp until next Monday',()=>{
  let state=small();
  state=action(state,'xavi','edit-tuesday','2026-09-22',{type:'saveTask',id:'bed',title:'Cama nueva',description:'',xp:8,children:['aina'],category:'morning',days:[1],once:false,limit:1});
  assert.equal(due(state.tasks[0],'aina','2026-09-22',state),true);
  state=action(state,'aina','bed-tuesday-edit','2026-09-22',{type:'complete',child:'aina',taskId:'bed'});
  assert.equal(state.completions[0].xp,2);
  assert.equal(state.completions[0].title.es,'Hacer mi cama');
});

test('weeks skipped while the app is idle still receive a frozen plan',()=>{
  let state=small();
  state=settleWeeklyBonuses(state,at('2026-10-12'));
  assert.deepEqual(state.weeklyPlans.map(p=>p.week),['2026-09-21','2026-09-28','2026-10-05','2026-10-12']);
});

test('only real discoveries can be awarded, and progress discoveries need progress',()=>{
  let state=small();
  assert.throws(()=>action(state,'aina','fake-egg-1','2026-09-21',{type:'egg',child:'aina',egg:'invented-egg'}),/invalid/);
  assert.throws(()=>action(state,'aina','early-egg-1','2026-09-21',{type:'egg',child:'aina',egg:'bed-boss'}),/notDue/);
  state=action(state,'aina','first-bed-1','2026-09-21',{type:'complete',child:'aina',taskId:'bed'});
  assert.deepEqual(objectiveDiscoveryCandidates(state,'aina','2026-09-21').filter(id=>['first-task','bed-boss','early-bird'].includes(id)),['first-task']);
  state=action(state,'aina','real-egg-1','2026-09-21',{type:'egg',child:'aina',egg:'first-task'});
  assert.equal(state.completions.at(-1).xp,1);
  assert.equal(state.badges.filter(b=>b.child==='aina'&&b.threshold===1).length,1);
});

test('backup import rejects forged Xp and unknown missions',()=>{
  const state=small();
  state.completions.push({id:'forged-1',taskId:'invented',child:'aina',title:'Inventada',xp:1,day:'2026-09-21',at:at('2026-09-21').toISOString(),actor:'aina',reversed:false});
  assert.throws(()=>parseExportedState({exportedAt:at('2026-09-21').toISOString(),data:state}),/invalidBackup/);
  state.completions[0].taskId='bed';state.completions[0].xp=1_000_000;
  assert.throws(()=>parseExportedState({exportedAt:at('2026-09-21').toISOString(),data:state}),/invalidBackup/);
});
