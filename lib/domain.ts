import { settleCycles, cycleSummary, madridInstant, nextClose, type Cycle, type CycleRule } from './cycles.ts';
import { settleWeeklyBonuses, type WeeklyPlan, type WeeklyBonus } from './weekly-bonuses.ts';
export type Lang = 'es' | 'ca' | 'en';
export type Child = 'aina' | 'iara';
export type Person = Child | 'xavi' | 'mireia';
export type Status = 'pending' | 'changes' | 'approved' | 'archived';
export type Words = { es: string; ca: string; en: string };
export type Task = { id: string; title: string | Words; description: string | Words; xp: number; category: 'all-day' | 'morning' | 'afternoon' | 'evening'; children: Child[]; days: number[]; once: boolean; limit: number; cadence?: 'daily' | 'weekly'; status: Status; author: Person; note: string; icon: string; created: string };
export type Reward = { id: string; title: string | Words; description: string | Words; xp: number; requiresSuperBonus?: boolean; children: Child[]; status: Status; author: Person; note: string; icon: string; limit: number; created: string };
export type Adjustment = { id: string; at: string; actor: Person; from: number; to: number; reason: string; undoneBy?: string; undoOf?: string };
export type Completion = { id: string; taskId: string; child: Child; title: string | Words; xp: number; day: string; at: string; actor: Person; reversed: boolean; reason?: string; correctedBy?: Person; originalXP?: number; icon?: string; category?: Task['category']; effectiveAt?: string; adjustments?: Adjustment[] };
export type Redemption = { id: string; rewardId: string; child: Child; title: string | Words; xp: number; bonusWeek?: string; status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'; at: string; note: string; actor?: Person };
export type Pause = { id: string; child: Child; from: string; to: string; reason: string; cancelledAt?: string };
export type Change = { id: string; at: string; actor: Person; title: string; collection: 'tasks' | 'rewards' | 'pauses' | 'redemptions'; key: string; before?: Task | Reward | Pause | Redemption; after?: Task | Reward | Pause | Redemption; undoneBy?: string };
export type State = { version: 1; rulesVersion?: 2; tasks: Task[]; rewards: Reward[]; completions: Completion[]; redemptions: Redemption[]; pauses: Pause[]; weeklyPlans?: WeeklyPlan[]; weeklyBonuses?: WeeklyBonus[]; seenCelebrations?: Partial<Record<Person,string[]>>; preferences: Record<Person, { lang: Lang; goal: string | null }>; weekStart: number; cycleRule?: CycleRule; cycles?: Cycle[]; changes?: Change[]; badges?: { child: Child; threshold: number; at: string }[]; processed: string[]; audit: { at: string; actor: Person; action: string; title: string }[] };
export type Action = { type: string; requestId: string; [key: string]: unknown };
export class DomainError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
export const names: Record<Person, string> = { aina: 'Aina', iara: 'Iara', xavi: 'Xavi', mireia: 'Mireia' };
export const isParent = (p: Person | null | undefined) => p === 'xavi' || p === 'mireia';
const olderKidsCopy:Record<string,string>={
  'Escuchar el audio o hacer las tareas de la app.':'Escuchar el audio o hacer las actividades de la app.',
  'Escoltar l’àudio o fer les tasques de l’app.':'Escoltar l’àudio o fer les activitats de l’app.',
  'Listen to the audio or do the tasks in the app.':'Listen to the audio or do the activities in the app.',
};
export const words = (x: string | Words, lang: Lang = 'es') => {
  const value=typeof x === 'string' ? x : x[lang];
  return olderKidsCopy[value]??value;
};
export const dateInMadrid = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function shiftDay(day: string, n: number) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function weekBeginning(day: string, start = 1) { const n = new Date(day + 'T12:00:00Z').getUTCDay(); return shiftDay(day, -((n - start + 7) % 7)); }
export function migrateState(s: State): State {
  if (s.rulesVersion === 2) return s;
  const reward = s.rewards.find(r => r.id === 'friend-sleepover');
  if (reward) {
    reward.xp = 1500;
    reward.requiresSuperBonus = false;
    reward.description = w('Cuesta 1500 Xp. Puedes ahorrar o conseguir una semana perfecta. Los padres confirman la fecha.', 'Costa 1500 Xp. Pots estalviar o aconseguir una setmana perfecta. Els pares confirmen la data.', 'Costs 1500 Xp. Save up or earn a perfect week. Parents confirm the date.');
  }
  const oldIds = (s.weeklyBonuses ?? []).map(b => b.id);
  s.seenCelebrations = { aina: [...oldIds], iara: [...oldIds], xavi: [...oldIds], mireia: [...oldIds] };
  s.cycleRule = { day: 1, time: '00:00' };
  s.weekStart = 1;
  s.cycles = [];
  s.rulesVersion = 2;
  return s;
}
export function totals(s: State, child: Child, today = dateInMadrid()) {
  const valid = s.completions.filter(x => x.child === child && !x.reversed);
  const bonuses = s.weeklyBonuses?.filter(x => x.child === child) ?? [];
  const xp = valid.reduce((v, x) => v + x.xp, 0) + bonuses.reduce((v, x) => v + x.xp, 0);
  const spent = s.redemptions.filter(x => x.child === child && x.status !== 'cancelled').reduce((v, x) => v + x.xp, 0);
  const cycle = s.cycles?.at(-1), week = weekBeginning(today, s.weekStart);
  return { xp, balance: xp - spent, today: valid.filter(x => x.day === today).reduce((v, x) => v + x.xp, 0) + bonuses.filter(x => dateInMadrid(new Date(x.at)) === today).reduce((v,x)=>v+x.xp,0), week: cycle ? cycleSummary(s,cycle,child).xp : valid.filter(x => x.day >= week && x.day <= today).reduce((v, x) => v + x.xp, 0) + bonuses.filter(x => dateInMadrid(new Date(x.at)) >= week && dateInMadrid(new Date(x.at)) <= today).reduce((v,x)=>v+x.xp,0), month: valid.filter(x => x.day.slice(0,7) === today.slice(0,7)).reduce((v,x) => v+x.xp,0) + bonuses.filter(x => dateInMadrid(new Date(x.at)).slice(0,7) === today.slice(0,7)).reduce((v,x)=>v+x.xp,0), level: Math.floor(xp / 250) + 1, levelProgress: xp % 250 };
}
export function availableSuperBonus(s: State, child: Child, rewardId: string) {
  return s.weeklyBonuses?.filter(bonus => bonus.child === child && bonus.kind === 'super')
    .sort((a,b) => b.week.localeCompare(a.week))
    .find(bonus => !s.redemptions.some(redemption => redemption.child === child && redemption.rewardId === rewardId && redemption.bonusWeek === bonus.week && redemption.status !== 'cancelled'));
}
export function due(t: Task, child: Child, day: string, s: State) { return t.status === 'approved' && t.children.includes(child) && (t.once || t.days.includes(new Date(day + 'T12:00:00Z').getUTCDay())) && (t.once ? !s.completions.some(c => c.taskId === t.id && c.child === child && !c.reversed) : t.cadence === 'weekly' ? completed(s,t,child,day) < t.limit : true); }
export function completed(s: State, t: Task, child: Child, day: string) { const week=t.cadence==='weekly'?weekBeginning(day,1):null; return s.completions.filter(c => c.taskId === t.id && c.child === child && !c.reversed && (t.once || (week ? c.day>=week&&c.day<=shiftDay(week,6) : c.day === day))).length; }
const w = (es: string, ca: string, en: string): Words => ({ es, ca, en });
export function initialState(now = new Date().toISOString()): State {
  const base = { children: ['aina', 'iara'] as Child[], days: [0,1,2,3,4,5,6], once: false, limit: 1, status: 'approved' as Status, author: 'xavi' as Person, note: '', created: now };
  const daily = (id:string,title:Words,description:Words,xp:number,category:Task['category'],icon:string,options:Partial<Task> = {}): Task => ({...base,id,title,description,xp,category,icon,...options});
  const specs: Task[] = [
    daily('bed',w('Hacer mi cama','Fer el meu llit','Make my bed'),w('Estirar las sábanas y colocar la almohada.','Estirar els llençols i posar el coixí.','Straighten the covers and place the pillow.'),1,'morning','bed'),
    daily('dress',w('Prepararme a tiempo','Preparar-me a temps','Get ready on time'),w('Vestirme antes de la hora que hemos acordado.','Vestir-me abans de l’hora que hem acordat.','Get dressed by our agreed time.'),1,'morning','shirt'),
    daily('room',w('Mi habitación, en orden','La meva habitació, endreçada','A tidy room'),w('Mantener la habitación recogida al terminar el día.','Mantenir l’habitació endreçada en acabar el dia.','Keep my room tidy by the end of the day.'),5,'evening','sparkles'),
    daily('table',w('Preparar la mesa para cenar','Parar taula per sopar','Set the table for dinner'),w('Dejar la mesa lista para la cena.','Deixar la taula preparada per sopar.','Get the table ready for dinner.'),2,'evening','utensils',{children:['iara'],days:[1,2,3,4,5]}),
    daily('clear-table',w('Recoger la mesa de la cena','Desparar taula després de sopar','Clear the dinner table'),w('Recoger la mesa después de cenar.','Desparar taula després de sopar.','Clear the table after dinner.'),2,'evening','utensils',{children:['aina'],days:[1,2,3,4,5]}),
    daily('teeth',w('Lavar los dientes','Rentar-me les dents','Brush my teeth'),w('Cepillar los dientes por la mañana y por la noche.','Rentar-me les dents al matí i a la nit.','Brush my teeth in the morning and at night.'),2,'all-day','shower',{limit:2}),
    daily('kids-us',w('Kids&Us Homework','Deures de Kids&Us','Kids&Us Homework'),w('Escuchar el audio o hacer las actividades de la app.','Escoltar l’àudio o fer les activitats de l’app.','Listen to the audio or do the activities in the app.'),5,'afternoon','book',{days:[1,2,3,4,5]}),
    daily('plan',w('Organizar mi día','Organitzar el meu dia','Plan my day'),w('Revisar mi lista y elegir por dónde empezar.','Revisar la meva llista i triar per on començar.','Check my list and choose where to start.'),5,'morning','list'),
    daily('shower',w('Mi rutina de ducha','La meva rutina de dutxa','My shower routine'),w('Seguir los pasos de higiene que hemos aprendido. Pedir ayuda está bien.','Seguir els passos d’higiene que hem après. Demanar ajuda està bé.','Follow the hygiene steps we have learned. It is okay to ask for help.'),10,'evening','shower'),
    daily('bag',w('Mochila del cole','Motxilla de l’escola','School bag'),w('Preparar y revisar lo que necesito para mañana.','Preparar i revisar el que necessito per demà.','Pack and check what I need for tomorrow.'),5,'evening','backpack',{days:[0,1,2,3,4]}),
    daily('bag-extra-iara',w('Mochila extraescolar','Motxilla extraescolar','After-school bag'),w('Preparar y revisar lo que necesito para mañana.','Preparar i revisar el que necessito per demà.','Pack and check what I need for tomorrow.'),5,'evening','backpack',{children:['iara'],days:[0,1,2]}),
    daily('bag-extra-aina',w('Mochila extraescolar','Motxilla extraescolar','After-school bag'),w('Preparar y revisar lo que necesito para mañana.','Preparar i revisar el que necessito per demà.','Pack and check what I need for tomorrow.'),5,'evening','backpack',{children:['aina'],days:[1,2,3]}),
    daily('clothes',w('Elegir la ropa de mañana','Triar la roba de demà','Choose tomorrow’s clothes'),w('Dejar la ropa lista para empezar con calma.','Deixar la roba a punt per començar amb calma.','Lay out my clothes for a calm start.'),5,'evening','shirt'),
    daily('school-homework',w('Responsabilizarme de los deberes del cole','Fer-me responsable dels deures de l’escola','Take responsibility for school homework'),w('Revisar la agenda todos los días y entregar los deberes a tiempo.','Revisar l’agenda cada dia i lliurar els deures a temps.','Check my planner every day and finish homework on time.'),10,'all-day','book',{children:['iara'],cadence:'weekly'}),
    daily('new-food',w('Probar un alimento nuevo','Tastar un aliment nou','Try a new food'),w('Los padres escogerán cinco alimentos para elegir. Hay que probar y tragar uno; escupirlo no cuenta.','Els pares triaran cinc aliments. Cal tastar-ne i empassar-ne un; escopir-lo no compta.','Parents choose five foods. Try and swallow one; spitting it out does not count.'),10,'all-day','utensils',{children:['aina'],cadence:'weekly'}),
  ];
  const sleepover: Reward = {
    id: 'friend-sleepover',
    title: w('Traer una amiga a dormir el fin de semana', 'Convidar una amiga a dormir el cap de setmana', 'Invite a friend for a weekend sleepover'),
    description: w('Cuesta 1500 Xp. Puedes ahorrar o conseguir una semana perfecta. Los padres confirman la fecha.', 'Costa 1500 Xp. Pots estalviar o aconseguir una setmana perfecta. Els pares confirmen la data.', 'Costs 1500 Xp. Save up or earn a perfect week. Parents confirm the date.'),
    xp: 1500, children: ['aina', 'iara'], status: 'approved', author: 'xavi', note: '', icon: 'bed', limit: 99, created: now,
  };
  return { version: 1, rulesVersion: 2, tasks: specs, rewards: [sleepover], completions: [], redemptions: [], pauses: [], seenCelebrations: {}, preferences: { aina: {lang:'es',goal:null}, iara:{lang:'es',goal:null}, xavi:{lang:'es',goal:null}, mireia:{lang:'es',goal:null} }, weekStart:1, cycleRule:{day:1,time:'00:00'}, processed:[], audit:[] };
}
function requireThat(value: unknown, code = 'invalid') { if (!value) throw new DomainError(code); }
function text(v: unknown, max = 160) { requireThat(typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max); return (v as string).trim(); }
function optional(v: unknown, max = 1000) { if (v === undefined || v === '') return ''; return text(v,max); }
function integer(v: unknown, min: number, max: number) { requireThat(Number.isInteger(v) && Number(v) >= min && Number(v) <= max); return Number(v); }
function children(v: unknown): Child[] { requireThat(Array.isArray(v) && v.length > 0 && v.length <= 2 && v.every(x => x==='aina'||x==='iara')); return [...new Set(v as Child[])]; }
function dayValue(v: unknown) { const d = text(v,10); requireThat(/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10) === d); return d; }
function periodBounds(scope: unknown, value: unknown, today: string): [string,string] {
  const day = dayValue(value); requireThat(day <= today);
  if (scope === 'day') return [day,day];
  if (scope === 'week') { const start = weekBeginning(day,1); return [start,shiftDay(start,6)]; }
  if (scope === 'month') { const start = day.slice(0,7)+'-01'; return [start,shiftDay(new Date(Date.UTC(+day.slice(0,4),+day.slice(5,7),1,12)).toISOString().slice(0,10),-1)]; }
  throw new DomainError('invalid');
}
export function applyAction(original: State, actor: Person, a: Action, now = new Date()): State {
  requireThat(Object.hasOwn(names,actor),'forbidden');
  requireThat(typeof a.requestId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(a.requestId));
  if(original.processed.includes(a.requestId)) return original;
  const s: State = settleCycles(settleWeeklyBonuses(migrateState(structuredClone(original)),now),now); const at = now.toISOString(); const today = dateInMadrid(now); const parent = isParent(actor);
  const requireParent = () => requireThat(parent,'forbidden');
  const childFor = (): Child => { const c = a.child; requireThat(c==='aina'||c==='iara'); requireThat(parent||c===actor,'forbidden'); return c as Child; };
  let log = a.type;
  if(a.type === 'complete') {
    const child = childFor(); const day = dayValue(a.day ?? today);
    requireThat(day <= today && (parent ? day >= shiftDay(today,-31) : day === today),'date');
    const t = s.tasks.find(x=>x.id===a.taskId); requireThat(t,'missing');
    requireThat(due(t!,child,day,s),'notDue'); requireThat(!s.pauses.some(p=>!p.cancelledAt&&p.child===child&&day>=p.from&&day<=p.to),'paused');
    requireThat(completed(s,t!,child,day)<t!.limit,'already');
    s.completions.push({id:a.requestId, taskId:t!.id,child,title:t!.title,xp:t!.xp,originalXP:t!.xp,icon:t!.icon,category:t!.category,day,at,effectiveAt:day===today?at:madridInstant(day,typeof a.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)?a.time:'12:00'),actor,reversed:false}); log=words(t!.title);
  } else if(a.type === 'egg') {
    const child=childFor(), egg=text(a.egg,40); requireThat(/^[a-z0-9-]+$/.test(egg));
    requireThat(!s.completions.some(c=>c.taskId===`egg-${egg}`&&c.child===child),'already');
    s.completions.push({id:a.requestId,taskId:`egg-${egg}`,child,title:w('Huevo de Pascua','Ou de Pasqua','Easter egg'),xp:1,originalXP:1,icon:'sparkles',category:'afternoon',day:today,at,effectiveAt:at,actor,reversed:false});log='Huevo de Pascua';
  } else if(a.type === 'reverse' || a.type === 'uncomplete' || a.type === 'undoAdjustment') {
    const c = s.completions.find(x=>x.id===a.id); requireThat(c,'missing');
    if(a.type==='reverse') requireParent();
    else if(!parent) requireThat(c!.child===actor&&c!.actor===actor&&c!.day===today&&!c!.adjustments?.some(x=>isParent(x.actor)),'forbidden');
    c!.originalXP ??= c!.xp; c!.adjustments ??= [];
    let target=0, reason='Desmarcada desde Día a día', undoOf:string|undefined;
    if(a.type==='undoAdjustment') {
      const last=c!.adjustments.findLast(x=>!x.undoOf&&!x.undoneBy); requireThat(last,'already');requireThat(last!.to===(c!.reversed?0:c!.xp),'conflict');
      requireThat(parent||last!.actor===actor,'forbidden'); target=last!.from; reason='Deshacer: '+last!.reason; undoOf=last!.id; last!.undoneBy=a.requestId;
      if(c!.reversed&&target>0){const task=s.tasks.find(t=>t.id===c!.taskId);requireThat(task&&completed(s,task,c!.child,c!.day)<task.limit,'already');}
    } else {
      requireThat(!c!.reversed,'already');
      if(a.type==='reverse'){const amount=a.amount===undefined?c!.xp:integer(a.amount,1,c!.xp);target=c!.xp-amount;reason=optional(a.reason,300);}
    }
    c!.adjustments.push({id:a.requestId,at,actor,from:c!.reversed?0:c!.xp,to:target,reason,undoOf});
    c!.xp=target;c!.reversed=target===0;c!.reason=reason;c!.correctedBy=actor;log=words(c!.title);
  } else if(a.type === 'saveTask' || a.type === 'saveReward') {
    const task = a.type==='saveTask'; const list = task?s.tasks:s.rewards;
    const old = a.id ? list.find(x=>x.id===a.id) : undefined;
    if(a.id) requireThat(old,'missing');
    if(old && !parent) requireThat(old.author===actor && (old.status==='pending'||old.status==='changes'),'forbidden');
    const item = { id:old?.id ?? a.requestId,title:text(a.title,100),description:optional(a.description,600),xp:integer(a.xp,task?1:0,task?100:10000),children:parent?children(a.children):[actor as Child],status:parent?'approved' as Status:'pending' as Status,author:old?.author??actor,note:parent?optional(a.note,300):'',icon:typeof a.icon==='string'&&['gift','film','headphones','game','book','sparkles','bed','shirt','utensils','list','shower','backpack'].includes(a.icon)?a.icon:(task?'sparkles':'gift'),limit:integer(a.limit??1,1,task?5:99),created:old?.created??at };
    if(!task && parent) requireThat(item.xp>0 || a.requiresSuperBonus===true,'price');
    if(task) {
      requireThat(['all-day','morning','afternoon','evening'].includes(String(a.category)));
      requireThat(Array.isArray(a.days)&&a.days.length<=7&&a.days.every(x=>Number.isInteger(x)&&x>=0&&x<=6));
      const once=a.once===true; requireThat(once||(a.days as number[]).length>0);
      requireThat(a.cadence===undefined||a.cadence==='daily'||a.cadence==='weekly');
      const cadence: NonNullable<Task['cadence']> = a.cadence==='weekly'?'weekly':'daily';
      const next={...item,category:a.category as Task['category'],days:[...new Set(a.days as number[])],once,limit:once?1:item.limit,cadence};
      s.tasks=old?s.tasks.map(x=>x.id===old.id?next:x):[...s.tasks,next];
    } else {
      const reward={...item,requiresSuperBonus:parent&&a.requiresSuperBonus===true};
      s.rewards=old?s.rewards.map(x=>x.id===old.id?reward:x):[...s.rewards,reward];
    }
    log=item.title;
  } else if(a.type === 'review') {
    requireParent(); requireThat(a.kind==='task'||a.kind==='reward');
    const item=(a.kind==='task'?s.tasks:s.rewards).find(x=>x.id===a.id); requireThat(item,'missing');
    requireThat(['approved','changes','archived'].includes(String(a.status)));
    if(a.status==='approved') requireThat(item!.xp>0 || (a.kind==='reward' && (item as Reward).requiresSuperBonus),'price');
    item!.status=a.status as Status; item!.note=optional(a.note,300); if(a.status==='changes') requireThat(item!.note.length>0);
    log=words(item!.title);
  } else if(a.type === 'redeem') {
    const child=childFor(); const r=s.rewards.find(x=>x.id===a.rewardId); requireThat(r&&r.status==='approved'&&r.children.includes(child),'missing');
    const superBonus=r!.requiresSuperBonus?availableSuperBonus(s,child,r!.id):undefined;
    if(r!.requiresSuperBonus) requireThat(superBonus,'bonus');
    requireThat(r!.xp===0||totals(s,child,today).balance>=r!.xp,'funds');
    requireThat(s.redemptions.filter(x=>x.child===child&&x.rewardId===r!.id&&x.status!=='cancelled').length<r!.limit,'limit');
    s.redemptions.push({id:a.requestId,rewardId:r!.id,child,title:r!.title,xp:r!.xp,bonusWeek:superBonus?.week,status:'pending',at,note:''}); log=words(r!.title);
  } else if(a.type === 'redemption') {
    const r=s.redemptions.find(x=>x.id===a.id); requireThat(r,'missing');
    if(!parent) requireThat(r!.child===actor&&r!.status==='pending'&&a.status==='cancelled','forbidden');
    const transitions: Record<string,string[]>={pending:['confirmed','cancelled'],confirmed:['fulfilled','cancelled'],fulfilled:[],cancelled:[]};
    requireThat(transitions[r!.status].includes(String(a.status)),'already');
    r!.status=a.status as Redemption['status']; r!.note=optional(a.note,300); r!.actor=actor; log=words(r!.title);
  } else if(a.type === 'preference') {
    if(a.lang!==undefined) { requireThat(['es','ca','en'].includes(String(a.lang))); s.preferences[actor].lang=a.lang as Lang; }
    if(a.goal!==undefined) { requireThat(!parent); requireThat(a.goal===null||s.rewards.some(r=>r.id===a.goal&&r.status==='approved'&&r.children.includes(actor as Child))); s.preferences[actor].goal=a.goal as string|null; }
  } else if(a.type === 'pause') {
    requireParent(); const child=childFor(); const from=dayValue(a.from); const to=dayValue(a.to); requireThat(from<=to&&to>=today); const reason=text(a.reason,200);
    s.pauses.push({id:a.requestId,child,from,to,reason});log=reason;
  } else if(a.type === 'unpause') { requireParent(); const p=s.pauses.find(p=>p.id===a.id&&!p.cancelledAt); requireThat(p,'missing');p!.cancelledAt=at;
  } else if(a.type === 'celebrationSeen') {
    const child=childFor(); const ids=a.ids;
    requireThat(Array.isArray(ids)&&ids.length>0&&ids.length<=30&&ids.every(id=>typeof id==='string'&&s.weeklyBonuses?.some(b=>b.id===id&&b.child===child)),'missing');
    s.seenCelebrations ??= {}; s.seenCelebrations[actor] ??= [];
    for(const id of ids as string[])if(!s.seenCelebrations[actor]!.includes(id)) s.seenCelebrations[actor]!.push(id);
    log='Celebración vista';
  } else if(a.type === 'cycleSettings') {
    requireParent(); const endDay=integer(a.endDay,0,6), closeDay=(endDay+1)%7;
    s.cycleRule={day:closeDay,time:'00:00'};
    const open=s.cycles?.at(-1);
    if(open&&!open.closed){const end=nextClose(now,s.cycleRule);Object.assign(open,{...s.cycleRule,id:end,end});}
    log='Día de cierre del ciclo';
  } else if(a.type === 'bulkResetXp' || a.type === 'undoChildPeriod') {
    requireParent(); const child=childFor(); const [from,to]=periodBounds(a.scope,a.day,today);
    const reason=a.type==='bulkResetXp'?'Restablecimiento de Xp del periodo':'Deshacer actividad del periodo';
    let affected=0;
    for(const c of s.completions){
      const selected=c.child===child&&c.xp>0&&(a.type==='bulkResetXp'?c.day>=from&&c.day<=to:c.actor===child&&!c.adjustments?.some(adjustment=>isParent(adjustment.actor))&&dateInMadrid(new Date(c.at))>=from&&dateInMadrid(new Date(c.at))<=to);
      if(!selected)continue;
      c.originalXP ??= c.xp;c.adjustments ??=[];
      c.adjustments.push({id:`${a.requestId}-${c.id}`,at,actor,from:c.xp,to:0,reason});
      c.xp=0;c.reversed=true;c.reason=reason;c.correctedBy=actor;
      affected++;
    }
    if(a.type==='undoChildPeriod')for(const change of [...(s.changes??[])].reverse()){
      if(change.actor!==child||change.undoneBy||dateInMadrid(new Date(change.at))<from||dateInMadrid(new Date(change.at))>to)continue;
      const list=s[change.collection] as (Task|Reward|Pause|Redemption)[];
      const current=list.find(item=>item.id===change.key);
      if(JSON.stringify(current)!==JSON.stringify(change.after))continue;
      if(change.collection==='tasks'&&s.completions.some(c=>c.taskId===change.key))continue;
      if(change.collection==='rewards'&&s.redemptions.some(r=>r.rewardId===change.key))continue;
      if(change.collection==='redemptions'&&change.before){
        const previous=change.before as Redemption;
        if(previous.status!=='cancelled'&&(current as Redemption)?.status==='cancelled'){
          const reward=s.rewards.find(r=>r.id===previous.rewardId);
          if(totals(s,previous.child).balance<previous.xp||!reward||s.redemptions.filter(r=>r.rewardId===previous.rewardId&&r.child===previous.child&&r.status!=='cancelled').length>=reward.limit)continue;
        }
      }
      const restored=list.filter(item=>item.id!==change.key);
      if(change.before)restored.push(structuredClone(change.before));
      (s as unknown as Record<string,unknown>)[change.collection]=restored;
      change.undoneBy=a.requestId;
      affected++;
    }
    requireThat(affected>0,'nothingToUndo');
    log=`${reason}: ${names[child]} · ${from} — ${to}`;
  } else if(a.type === 'weekStart') {
    requireParent(); throw new DomainError('invalid');
  } else if(a.type === 'undo') {
    const change=s.changes?.find(c=>c.id===a.id);requireThat(change&&!change.undoneBy,'already');requireThat(parent||change!.actor===actor,'forbidden');
    const list=s[change!.collection] as (Task|Reward|Pause|Redemption)[];const current=list.find(x=>x.id===change!.key);
    requireThat(JSON.stringify(current)===JSON.stringify(change!.after),'conflict');
    if(change!.collection==='tasks') requireThat(!s.completions.some(c=>c.taskId===change!.key&&c.at>change!.at),'conflict');
    if(change!.collection==='rewards') requireThat(!s.redemptions.some(r=>r.rewardId===change!.key&&r.at>change!.at),'conflict');
    if(change!.collection==='redemptions'&&change!.before){const r=change!.before as Redemption;if(r.status!=='cancelled'&&(current as Redemption)?.status==='cancelled'){requireThat(totals(s,r.child).balance>=r.xp,'funds');const reward=s.rewards.find(x=>x.id===r.rewardId);requireThat(reward&&s.redemptions.filter(x=>x.rewardId===r.rewardId&&x.child===r.child&&x.status!=='cancelled').length<reward.limit,'limit');}}
    const next=list.filter(x=>x.id!==change!.key);if(change!.before)next.push(structuredClone(change!.before));
    (s as unknown as Record<string,unknown>)[change!.collection]=next;change!.undoneBy=a.requestId;log='Deshacer: '+change!.title;
  } else throw new DomainError('invalid');
  if(['saveTask','saveReward','review','pause','unpause','redeem','redemption'].includes(a.type)){
    s.changes ??= [];
    for(const collection of ['tasks','rewards','pauses','redemptions'] as const){for(const item of s[collection]){const before=original[collection].find(x=>x.id===item.id);if(JSON.stringify(before)!==JSON.stringify(item))s.changes.push({id:a.requestId,at,actor,title:log,collection,key:item.id,before:before?structuredClone(before):undefined,after:structuredClone(item)});}}
  }
  settleWeeklyBonuses(s,now);
  s.badges ??= [];
  for(const child of ['aina','iara'] as Child[])for(const threshold of [1,10,25,50,100]){const valid=s.completions.filter(c=>c.child===child&&!c.reversed).sort((a,b)=>a.at.localeCompare(b.at));if(valid.length>=threshold&&!s.badges.some(b=>b.child===child&&b.threshold===threshold))s.badges.push({child,threshold,at:valid[threshold-1].at});}
  s.processed.push(a.requestId);
  if(a.type!=='preference'&&a.type!=='celebrationSeen') s.audit.push({at,actor,action:a.type,title:log});
  return s;
}
export function visibleState(s: State, p: Person): State {
  if(isParent(p)) return {...s,processed:[]};
  const child=p as Child;
  return {...s,tasks:s.tasks.filter(t=>t.children.includes(child)),rewards:s.rewards.filter(r=>r.children.includes(child)),completions:s.completions.filter(c=>c.child===child),redemptions:s.redemptions.filter(r=>r.child===child),pauses:s.pauses.filter(x=>x.child===child),weeklyPlans:s.weeklyPlans?.map(plan=>({...plan,tasks:plan.tasks.filter(task=>task.children.includes(child))})),weeklyBonuses:s.weeklyBonuses?.filter(bonus=>bonus.child===child),seenCelebrations:{[p]:s.seenCelebrations?.[p]??[]},changes:s.changes?.filter(c=>c.actor===p),badges:s.badges?.filter(b=>b.child===child),cycles:s.cycles?.map(c=>({...c,snapshot:c.snapshot?{[child]:c.snapshot[child]} as Cycle['snapshot']:undefined})),audit:[],processed:[],preferences:{[p]:s.preferences[p]} as State['preferences']};
}
