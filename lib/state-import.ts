import { z } from 'zod';
import { DomainError, migrateState, type State } from './domain.ts';
import { DISCOVERY_IDS } from './discoveries.ts';
import { childrenOf, familyMembers } from './family.ts';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed=new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
});
const instant = z.string().refine(value => !Number.isNaN(Date.parse(value)));
const person = z.string().regex(/^(?:aina|iara|xavi|mireia|member-[1-9][0-9]*)$/);
const child = person;
const member = z.object({ id:person,name:z.string().trim().min(1).max(40),role:z.enum(['adult','child']) }).strict();
const words = z.union([z.string(),z.object({ es:z.string(),ca:z.string(),en:z.string() }).strict()]);
const status = z.enum(['pending','changes','approved','archived']);
const task = z.object({ id:z.string(),title:words,description:words,xp:z.number().int().min(1).max(100),category:z.enum(['all-day','morning','afternoon','evening']),children:z.array(child).min(1).max(12),days:z.array(z.number().int().min(0).max(6)).max(7),once:z.boolean(),limit:z.number().int().min(1).max(5),cadence:z.enum(['daily','weekly']).optional(),status,author:person,note:z.string(),icon:z.string(),created:instant }).strict();
const reward = z.object({ id:z.string(),title:words,description:words,xp:z.number().int().min(0).max(10000),requiresSuperBonus:z.boolean().optional(),children:z.array(child).min(1).max(12),status,author:person,note:z.string(),icon:z.string(),limit:z.number().int().min(1).max(99),created:instant }).strict();
const adjustment = z.object({ id:z.string(),at:instant,actor:person,from:z.number().int().min(0).max(100),to:z.number().int().min(0).max(100),reason:z.string(),undoneBy:z.string().optional(),undoOf:z.string().optional() }).strict();
const completion = z.object({ id:z.string(),taskId:z.string(),child,title:words,xp:z.number().int().min(0).max(100),day:date,at:instant,actor:person,reversed:z.boolean(),reason:z.string().optional(),correctedBy:person.optional(),originalXP:z.number().int().min(0).max(100).optional(),icon:z.string().optional(),category:z.enum(['all-day','morning','afternoon','evening']).optional(),effectiveAt:instant.optional(),adjustments:z.array(adjustment).optional(),discoveryReset:z.object({at:instant,actor:person,requestId:z.string().min(8).max(100)}).strict().optional() }).strict();
const redemption = z.object({ id:z.string(),rewardId:z.string(),child,title:words,xp:z.number().int().min(0),bonusWeek:date.optional(),status:z.enum(['pending','confirmed','fulfilled','cancelled']),at:instant,note:z.string(),actor:person.optional() }).strict();
const pause = z.object({ id:z.string(),child,from:date,to:date,reason:z.string(),cancelledAt:instant.optional() }).strict();
const weeklyPlan = z.object({ week:date,startsOn:date.optional(),tasks:z.array(task),taskStartsOn:z.record(date).optional(),noTaskBonus:z.array(z.string()).optional() }).strict();
const weeklyBonus = z.object({ id:z.string(),week:date,child,kind:z.enum(['task','super']),taskId:z.string().optional(),title:words,baseXp:z.number().int().min(0).max(10_000_000),xp:z.number().int().min(0).max(40_000_000),at:instant }).strict();
const cycleRule = z.object({ day:z.number().int().min(0).max(6),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict();
const cycle = cycleRule.extend({ id:instant,start:instant,end:instant,closed:z.boolean().optional(),snapshot:z.record(z.object({xp:z.number().int(),tasks:z.number().int().min(0)}).strict()).optional(),reconstructed:z.boolean().optional() }).strict();
const change = z.object({ id:z.string(),at:instant,actor:person,title:z.string(),collection:z.enum(['tasks','rewards','pauses','redemptions']),key:z.string(),before:z.union([task,reward,pause,redemption]).optional(),after:z.union([task,reward,pause,redemption]).optional(),undoneBy:z.string().optional() }).strict();
const preference = z.object({ lang:z.enum(['es','ca','en']),goal:z.string().nullable() }).strict();
const stateSchema = z.object({
  version:z.literal(1),rulesVersion:z.literal(2).optional(),members:z.array(member).min(2).max(12).optional(),setupMode:z.enum(['demo','custom']).optional(),tasks:z.array(task),rewards:z.array(reward),completions:z.array(completion),redemptions:z.array(redemption),pauses:z.array(pause),weeklyPlans:z.array(weeklyPlan).optional(),weeklyBonuses:z.array(weeklyBonus).optional(),seenCelebrations:z.record(z.array(z.string())).optional(),
  preferences:z.record(preference),weekStart:z.number().int().min(0).max(6),cycleRule:cycleRule.optional(),cycles:z.array(cycle).optional(),changes:z.array(change).optional(),badges:z.array(z.object({child,threshold:z.number().int().min(1),at:instant}).strict()).optional(),processed:z.array(z.string()),audit:z.array(z.object({at:instant,actor:person,action:z.string(),title:z.string()}).strict()),
}).strict();

export function parseExportedState(value: unknown): State {
  const envelope = z.object({ exportedAt:instant,data:stateSchema }).strict().safeParse(value);
  if (!envelope.success) throw new DomainError('invalidBackup');
  const state = migrateState(envelope.data.data as State);
  const members = familyMembers(state);
  const ids = new Set(members.map(member=>member.id));
  const childIds = new Set(childrenOf(state));
  if(ids.size!==members.length || !members.some(member=>member.role==='adult') || !childIds.size || Object.keys(state.preferences).length!==ids.size || Object.keys(state.preferences).some(id=>!ids.has(id))) throw new DomainError('invalidBackup');
  const validPerson = (id:string)=>ids.has(id);
  const validChild = (id:string)=>childIds.has(id);
  if(state.tasks.some(item=>!validPerson(item.author)||item.children.some(id=>!validChild(id))) || state.rewards.some(item=>!validPerson(item.author)||item.children.some(id=>!validChild(id))) || state.completions.some(item=>!validChild(item.child)||!validPerson(item.actor)||item.correctedBy&&!validPerson(item.correctedBy)||item.discoveryReset&&!validPerson(item.discoveryReset.actor)||item.adjustments?.some(a=>!validPerson(a.actor))) || state.redemptions.some(item=>!validChild(item.child)||item.actor&&!validPerson(item.actor)) || state.pauses.some(item=>!validChild(item.child)) || state.weeklyBonuses?.some(item=>!validChild(item.child)) || state.audit.some(item=>!validPerson(item.actor)) || state.badges?.some(item=>!validChild(item.child)) || state.weeklyPlans?.some(plan=>plan.tasks.some(item=>!validPerson(item.author)||item.children.some(id=>!validChild(id)))) || state.changes?.some(item=>!validPerson(item.actor))) throw new DomainError('invalidBackup');
  if(state.cycles?.some(item=>item.snapshot&&Object.keys(item.snapshot).some(id=>!validChild(id))) || Object.keys(state.seenCelebrations??{}).some(id=>!validPerson(id))) throw new DomainError('invalidBackup');
  for (const list of [state.tasks,state.rewards,state.completions,state.redemptions,state.pauses]) {
    if (new Set(list.map(item => item.id)).size !== list.length) throw new DomainError('invalidBackup');
  }
  const knownTasks = new Set([...state.tasks,...(state.weeklyPlans??[]).flatMap(plan=>plan.tasks)].map(item=>item.id));
  const knownRewards = new Set(state.rewards.map(item=>item.id));
  const discoveries = new Set<string>(DISCOVERY_IDS);
  if (state.completions.some(item=>item.xp>(item.originalXP??item.xp)||item.reversed!== (item.xp===0)||item.discoveryReset&&(!item.taskId.startsWith('egg-')||item.xp!==0)||(
    item.taskId.startsWith('egg-') ? !discoveries.has(item.taskId.slice(4)) || item.originalXP!==undefined&&item.originalXP!==1 : !knownTasks.has(item.taskId)
  ))) throw new DomainError('invalidBackup');
  const discoveryClaims=state.completions.filter(item=>item.taskId.startsWith('egg-')&&!item.discoveryReset).map(item=>`${item.child}:${item.taskId}`);
  if(new Set(discoveryClaims).size!==discoveryClaims.length) throw new DomainError('invalidBackup');
  if (state.redemptions.some(item=>!knownRewards.has(item.rewardId))) throw new DomainError('invalidBackup');
  const plans=state.weeklyPlans??[];
  if(new Set(plans.map(plan=>plan.week)).size!==plans.length) throw new DomainError('invalidBackup');
  for(const plan of plans){
    const end=new Date(plan.week+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+6);const last=end.toISOString().slice(0,10);
    const ids=new Set(plan.tasks.map(item=>item.id));
    if(new Date(plan.week+'T12:00:00Z').getUTCDay()!==1 || plan.startsOn && (plan.startsOn<plan.week||plan.startsOn>last) || ids.size!==plan.tasks.length) throw new DomainError('invalidBackup');
    if(Object.entries(plan.taskStartsOn??{}).some(([id,day])=>!ids.has(id)||day<plan.week||day>last)) throw new DomainError('invalidBackup');
    if((plan.noTaskBonus??[]).some(id=>!ids.has(id))) throw new DomainError('invalidBackup');
  }
  return state;
}
