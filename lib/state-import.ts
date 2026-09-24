import { z } from 'zod';
import { DomainError, migrateState, type State } from './domain';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed=new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
});
const instant = z.string().refine(value => !Number.isNaN(Date.parse(value)));
const person = z.enum(['aina','iara','xavi','mireia']);
const child = z.enum(['aina','iara']);
const words = z.union([z.string(),z.object({ es:z.string(),ca:z.string(),en:z.string() }).strict()]);
const status = z.enum(['pending','changes','approved','archived']);
const task = z.object({ id:z.string(),title:words,description:words,xp:z.number().int().min(1).max(100),category:z.enum(['all-day','morning','afternoon','evening']),children:z.array(child).min(1).max(2),days:z.array(z.number().int().min(0).max(6)).max(7),once:z.boolean(),limit:z.number().int().min(1).max(5),cadence:z.enum(['daily','weekly']).optional(),status,author:person,note:z.string(),icon:z.string(),created:instant }).strict();
const reward = z.object({ id:z.string(),title:words,description:words,xp:z.number().int().min(0).max(10000),requiresSuperBonus:z.boolean().optional(),children:z.array(child).min(1).max(2),status,author:person,note:z.string(),icon:z.string(),limit:z.number().int().min(1).max(99),created:instant }).strict();
const adjustment = z.object({ id:z.string(),at:instant,actor:person,from:z.number().int().min(0),to:z.number().int().min(0),reason:z.string(),undoneBy:z.string().optional(),undoOf:z.string().optional() }).strict();
const completion = z.object({ id:z.string(),taskId:z.string(),child,title:words,xp:z.number().int().min(0),day:date,at:instant,actor:person,reversed:z.boolean(),reason:z.string().optional(),correctedBy:person.optional(),originalXP:z.number().int().min(0).optional(),icon:z.string().optional(),category:z.enum(['all-day','morning','afternoon','evening']).optional(),effectiveAt:instant.optional(),adjustments:z.array(adjustment).optional() }).strict();
const redemption = z.object({ id:z.string(),rewardId:z.string(),child,title:words,xp:z.number().int().min(0),bonusWeek:date.optional(),status:z.enum(['pending','confirmed','fulfilled','cancelled']),at:instant,note:z.string(),actor:person.optional() }).strict();
const pause = z.object({ id:z.string(),child,from:date,to:date,reason:z.string(),cancelledAt:instant.optional() }).strict();
const weeklyPlan = z.object({ week:date,startsOn:date.optional(),tasks:z.array(task) }).strict();
const weeklyBonus = z.object({ id:z.string(),week:date,child,kind:z.enum(['task','super']),taskId:z.string().optional(),title:words,baseXp:z.number().int().min(0),xp:z.number().int().min(0),at:instant }).strict();
const cycleRule = z.object({ day:z.number().int().min(0).max(6),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict();
const cycle = cycleRule.extend({ id:instant,start:instant,end:instant,closed:z.boolean().optional(),snapshot:z.object({ aina:z.object({xp:z.number().int(),tasks:z.number().int().min(0)}).strict(),iara:z.object({xp:z.number().int(),tasks:z.number().int().min(0)}).strict() }).strict().optional(),reconstructed:z.boolean().optional() }).strict();
const change = z.object({ id:z.string(),at:instant,actor:person,title:z.string(),collection:z.enum(['tasks','rewards','pauses','redemptions']),key:z.string(),before:z.union([task,reward,pause,redemption]).optional(),after:z.union([task,reward,pause,redemption]).optional(),undoneBy:z.string().optional() }).strict();
const preference = z.object({ lang:z.enum(['es','ca','en']),goal:z.string().nullable() }).strict();
const stateSchema = z.object({
  version:z.literal(1),rulesVersion:z.literal(2).optional(),tasks:z.array(task),rewards:z.array(reward),completions:z.array(completion),redemptions:z.array(redemption),pauses:z.array(pause),weeklyPlans:z.array(weeklyPlan).optional(),weeklyBonuses:z.array(weeklyBonus).optional(),seenCelebrations:z.record(z.array(z.string())).optional(),
  preferences:z.object({ aina:preference,iara:preference,xavi:preference,mireia:preference }).strict(),weekStart:z.number().int().min(0).max(6),cycleRule:cycleRule.optional(),cycles:z.array(cycle).optional(),changes:z.array(change).optional(),badges:z.array(z.object({child,threshold:z.number().int().min(1),at:instant}).strict()).optional(),processed:z.array(z.string()),audit:z.array(z.object({at:instant,actor:person,action:z.string(),title:z.string()}).strict()),
}).strict();

export function parseExportedState(value: unknown): State {
  const envelope = z.object({ exportedAt:instant,data:stateSchema }).strict().safeParse(value);
  if (!envelope.success) throw new DomainError('invalidBackup');
  const state = migrateState(envelope.data.data as State);
  for (const list of [state.tasks,state.rewards,state.completions,state.redemptions,state.pauses]) {
    if (new Set(list.map(item => item.id)).size !== list.length) throw new DomainError('invalidBackup');
  }
  return state;
}
