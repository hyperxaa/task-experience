import { settleCycles, nextClose, cycleSummary, madridInstant, type Cycle, type CycleRule } from './cycles.ts';
export type Lang = 'es' | 'ca' | 'en';
export type Child = 'aina' | 'iara';
export type Person = Child | 'xavi' | 'mireia';
export type Status = 'pending' | 'changes' | 'approved' | 'archived';
export type Words = { es: string; ca: string; en: string };
export type Task = { id: string; title: string | Words; description: string | Words; xp: number; category: 'all-day' | 'morning' | 'afternoon' | 'evening'; children: Child[]; days: number[]; once: boolean; limit: number; status: Status; author: Person; note: string; icon: string; created: string };
export type Reward = { id: string; title: string | Words; description: string | Words; xp: number; children: Child[]; status: Status; author: Person; note: string; icon: string; limit: number; created: string };
export type Adjustment = { id: string; at: string; actor: Person; from: number; to: number; reason: string; undoneBy?: string; undoOf?: string };
export type Completion = { id: string; taskId: string; child: Child; title: string | Words; xp: number; day: string; at: string; actor: Person; reversed: boolean; reason?: string; correctedBy?: Person; originalXP?: number; icon?: string; category?: Task['category']; effectiveAt?: string; adjustments?: Adjustment[] };
export type Redemption = { id: string; rewardId: string; child: Child; title: string | Words; xp: number; status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'; at: string; note: string; actor?: Person };
export type Pause = { id: string; child: Child; from: string; to: string; reason: string; cancelledAt?: string };
export type Change = { id: string; at: string; actor: Person; title: string; collection: 'tasks' | 'rewards' | 'pauses' | 'redemptions'; key: string; before?: Task | Reward | Pause | Redemption; after?: Task | Reward | Pause | Redemption; undoneBy?: string };
export type State = { version: 1; tasks: Task[]; rewards: Reward[]; completions: Completion[]; redemptions: Redemption[]; pauses: Pause[]; preferences: Record<Person, { lang: Lang; goal: string | null }>; weekStart: number; cycleRule?: CycleRule; cycles?: Cycle[]; changes?: Change[]; badges?: { child: Child; threshold: number; at: string }[]; processed: string[]; audit: { at: string; actor: Person; action: string; title: string }[] };
export type Action = { type: string; requestId: string; [key: string]: unknown };
export class DomainError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
export const names: Record<Person, string> = { aina: 'Aina', iara: 'Iara', xavi: 'Xavi', mireia: 'Mireia' };
export const isParent = (p: Person | null | undefined) => p === 'xavi' || p === 'mireia';
export const words = (x: string | Words, lang: Lang = 'es') => typeof x === 'string' ? x : x[lang];
export const dateInMadrid = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function shiftDay(day: string, n: number) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function weekBeginning(day: string, start = 5) { const n = new Date(day + 'T12:00:00Z').getUTCDay(); return shiftDay(day, -((n - start + 7) % 7)); }
export function totals(s: State, child: Child, today = dateInMadrid()) {
  const valid = s.completions.filter(x => x.child === child && !x.reversed);
  const xp = valid.reduce((v, x) => v + x.xp, 0);
  const spent = s.redemptions.filter(x => x.child === child && x.status !== 'cancelled').reduce((v, x) => v + x.xp, 0);
  const cycle = s.cycles?.at(-1), week = weekBeginning(today, s.weekStart);
  return { xp, balance: xp - spent, today: valid.filter(x => x.day === today).reduce((v, x) => v + x.xp, 0), week: cycle ? cycleSummary(s,cycle,child).xp : valid.filter(x => x.day >= week && x.day <= today).reduce((v, x) => v + x.xp, 0), month: valid.filter(x => x.day.slice(0,7) === today.slice(0,7)).reduce((v,x) => v+x.xp,0), level: Math.floor(xp / 250) + 1, levelProgress: xp % 250 };
}
export function due(t: Task, child: Child, day: string, s: State) { return t.status === 'approved' && t.children.includes(child) && (t.once || t.days.includes(new Date(day + 'T12:00:00Z').getUTCDay())) && (!t.once || !s.completions.some(c => c.taskId === t.id && c.child === child && !c.reversed)); }
export function completed(s: State, t: Task, child: Child, day: string) { return s.completions.filter(c => c.taskId === t.id && c.child === child && !c.reversed && (t.once || c.day === day)).length; }
const w = (es: string, ca: string, en: string): Words => ({ es, ca, en });
export function initialState(now = new Date().toISOString()): State {
  const base = { children: ['aina', 'iara'] as Child[], days: [0,1,2,3,4,5,6], once: false, limit: 1, status: 'approved' as Status, author: 'xavi' as Person, note: '', created: now };
  const specs: [string, Words, Words, number, Task['category'], string][] = [
    ['bed',w('Hacer mi cama','Fer el meu llit','Make my bed'),w('Estirar las sábanas y colocar la almohada.','Estirar els llençols i posar el coixí.','Straighten the covers and place the pillow.'),5,'morning','bed'],
    ['dress',w('Prepararme a tiempo','Preparar-me a temps','Get ready on time'),w('Vestirme antes de la hora que hemos acordado.','Vestir-me abans de l’hora que hem acordat.','Get dressed by our agreed time.'),5,'morning','shirt'],
    ['room',w('Mi habitación, en orden','La meva habitació, endreçada','A tidy room'),w('Ropa en su sitio, suelo despejado y escritorio listo.','Roba al seu lloc, terra lliure i escriptori a punt.','Clothes put away, clear floor and tidy desk.'),10,'all-day','sparkles'],
    ['table',w('Ayudar con la mesa','Ajudar amb la taula','Help set the table'),w('Preparar la mesa para compartir la comida.','Preparar la taula per compartir l’àpat.','Get the table ready for our meal.'),5,'afternoon','utensils'],
    ['laundry',w('Recoger mi ropa','Recollir la meva roba','Put my clothes away'),w('Doblar y guardar la ropa que está lista.','Plegar i desar la roba que està a punt.','Fold and put away the clean clothes.'),5,'all-day','shirt'],
    ['plan',w('Organizar mi día','Organitzar el meu dia','Plan my day'),w('Revisar mi lista y elegir por dónde empezar.','Revisar la meva llista i triar per on començar.','Check my list and choose where to start.'),5,'morning','list'],
    ['shower',w('Mi rutina de ducha','La meva rutina de dutxa','My shower routine'),w('Seguir los pasos de higiene que hemos aprendido. Pedir ayuda está bien.','Seguir els passos d’higiene que hem après. Demanar ajuda està bé.','Follow the hygiene steps we have learned. It is okay to ask for help.'),10,'evening','shower'],
    ['bag',w('Mochila preparada','Motxilla preparada','Pack my bag'),w('Revisar lo que necesito para mañana.','Revisar què necessito per demà.','Check what I need for tomorrow.'),5,'evening','backpack'],
    ['clothes',w('Elegir la ropa de mañana','Triar la roba de demà','Choose tomorrow’s clothes'),w('Dejar la ropa lista para empezar con calma.','Deixar la roba a punt per començar amb calma.','Lay out my clothes for a calm start.'),5,'evening','shirt'],
  ];
  return { version: 1, tasks: specs.map(([id,title,description,xp,category,icon]) => ({...base,id,title,description,xp,category,icon,days:id==='bag'?[0,1,2,3,4]:base.days})), rewards: [], completions: [], redemptions: [], pauses: [], preferences: { aina: {lang:'es',goal:null}, iara:{lang:'es',goal:null}, xavi:{lang:'es',goal:null}, mireia:{lang:'es',goal:null} }, weekStart:5, processed:[], audit:[] };
}
function requireThat(value: unknown, code = 'invalid') { if (!value) throw new DomainError(code); }
function text(v: unknown, max = 160) { requireThat(typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max); return (v as string).trim(); }
function optional(v: unknown, max = 1000) { if (v === undefined || v === '') return ''; return text(v,max); }
function integer(v: unknown, min: number, max: number) { requireThat(Number.isInteger(v) && Number(v) >= min && Number(v) <= max); return Number(v); }
function children(v: unknown): Child[] { requireThat(Array.isArray(v) && v.length > 0 && v.length <= 2 && v.every(x => x==='aina'||x==='iara')); return [...new Set(v as Child[])]; }
function dayValue(v: unknown) { const d = text(v,10); requireThat(/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d+'T12:00:00Z')) && new Date(d+'T12:00:00Z').toISOString().slice(0,10) === d); return d; }
export function applyAction(original: State, actor: Person, a: Action, now = new Date()): State {
  requireThat(Object.hasOwn(names,actor),'forbidden');
  requireThat(typeof a.requestId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(a.requestId));
  if(original.processed.includes(a.requestId)) return original;
  const s: State = settleCycles(structuredClone(original),now); const at = now.toISOString(); const today = dateInMadrid(now); const parent = isParent(actor);
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
      if(a.type==='reverse'){const amount=a.amount===undefined?c!.xp:integer(a.amount,1,c!.xp);target=c!.xp-amount;reason=text(a.reason,300);}
    }
    c!.adjustments.push({id:a.requestId,at,actor,from:c!.reversed?0:c!.xp,to:target,reason,undoOf});
    c!.xp=target;c!.reversed=target===0;c!.reason=reason;c!.correctedBy=actor;log=words(c!.title);
  } else if(a.type === 'saveTask' || a.type === 'saveReward') {
    const task = a.type==='saveTask'; const list = task?s.tasks:s.rewards;
    const old = a.id ? list.find(x=>x.id===a.id) : undefined;
    if(a.id) requireThat(old,'missing');
    if(old && !parent) requireThat(old.author===actor && (old.status==='pending'||old.status==='changes'),'forbidden');
    const item = { id:old?.id ?? a.requestId,title:text(a.title,100),description:optional(a.description,600),xp:integer(a.xp,task?1:0,task?100:10000),children:parent?children(a.children):[actor as Child],status:parent?'approved' as Status:'pending' as Status,author:old?.author??actor,note:parent?optional(a.note,300):'',icon:typeof a.icon==='string'&&['gift','film','headphones','game','book','sparkles','bed','shirt','utensils','list','shower','backpack'].includes(a.icon)?a.icon:(task?'sparkles':'gift'),limit:integer(a.limit??1,1,task?5:99),created:old?.created??at };
    if(!task && parent) requireThat(item.xp>0);
    if(task) {
      requireThat(['all-day','morning','afternoon','evening'].includes(String(a.category)));
      requireThat(Array.isArray(a.days)&&a.days.length<=7&&a.days.every(x=>Number.isInteger(x)&&x>=0&&x<=6));
      const once=a.once===true; requireThat(once||(a.days as number[]).length>0);
      const next={...item,category:a.category as Task['category'],days:[...new Set(a.days as number[])],once,limit:once?1:item.limit};
      s.tasks=old?s.tasks.map(x=>x.id===old.id?next:x):[...s.tasks,next];
    } else s.rewards=old?s.rewards.map(x=>x.id===old.id?item:x):[...s.rewards,item];
    log=item.title;
  } else if(a.type === 'review') {
    requireParent(); requireThat(a.kind==='task'||a.kind==='reward');
    const item=(a.kind==='task'?s.tasks:s.rewards).find(x=>x.id===a.id); requireThat(item,'missing');
    requireThat(['approved','changes','archived'].includes(String(a.status)));
    if(a.status==='approved') requireThat(item!.xp>0,'price');
    item!.status=a.status as Status; item!.note=optional(a.note,300); if(a.status==='changes') requireThat(item!.note.length>0);
    log=words(item!.title);
  } else if(a.type === 'redeem') {
    const child=childFor(); const r=s.rewards.find(x=>x.id===a.rewardId); requireThat(r&&r.status==='approved'&&r.children.includes(child),'missing');
    requireThat(totals(s,child,today).balance>=r!.xp,'funds');
    requireThat(s.redemptions.filter(x=>x.child===child&&x.rewardId===r!.id&&x.status!=='cancelled').length<r!.limit,'limit');
    s.redemptions.push({id:a.requestId,rewardId:r!.id,child,title:r!.title,xp:r!.xp,status:'pending',at,note:''}); log=words(r!.title);
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
  } else if(a.type === 'cycleSettings' || a.type === 'weekStart') {
    requireParent(); const day=a.type==='weekStart'?(integer(a.value,0,6)+6)%7:integer(a.day,0,6); const time=a.type==='weekStart'?'18:00':text(a.time,5);
    requireThat(/^([01]\d|2[0-3]):[0-5]\d$/.test(time));s.cycleRule={day,time};s.weekStart=(day+1)%7;
    const open=s.cycles!.at(-1)!; open.day=day;open.time=time;open.end=nextClose(now,s.cycleRule);open.id=open.end;log=`Cierre ${day} ${time} Europe/Madrid`;
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
  s.badges ??= [];
  for(const child of ['aina','iara'] as Child[])for(const threshold of [1,10,25,50,100]){const valid=s.completions.filter(c=>c.child===child&&!c.reversed).sort((a,b)=>a.at.localeCompare(b.at));if(valid.length>=threshold&&!s.badges.some(b=>b.child===child&&b.threshold===threshold))s.badges.push({child,threshold,at:valid[threshold-1].at});}
  s.processed.push(a.requestId);
  if(a.type!=='preference') s.audit.push({at,actor,action:a.type,title:log});
  return s;
}
export function visibleState(s: State, p: Person): State {
  if(isParent(p)) return {...s,processed:[]};
  const child=p as Child;
  return {...s,tasks:s.tasks.filter(t=>t.children.includes(child)),rewards:s.rewards.filter(r=>r.children.includes(child)),completions:s.completions.filter(c=>c.child===child),redemptions:s.redemptions.filter(r=>r.child===child),pauses:s.pauses.filter(x=>x.child===child),changes:s.changes?.filter(c=>c.actor===p),badges:s.badges?.filter(b=>b.child===child),cycles:s.cycles?.map(c=>({...c,snapshot:c.snapshot?{[child]:c.snapshot[child]} as Cycle['snapshot']:undefined})),audit:[],processed:[],preferences:{[p]:s.preferences[p]} as State['preferences']};
}
