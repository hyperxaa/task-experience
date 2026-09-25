import type { Child, Lang, State, Words } from './domain.ts';

export const DISCOVERY_IDS = [
  'kind-heart','three-in-a-row','returning-player','first-task','five-today','seven-today','full-day','bed-boss','backpack-pro','shower-power',
  'room-rescue','table-team','laundry-legend','plan-master','ready-dressed','tomorrow-ready','first-five','task-ten','task-twenty-five','task-fifty',
  'task-hundred','task-two-fifty','task-five-hundred','xp-twenty-five','xp-fifty','xp-hundred','xp-two-fifty','xp-five-hundred','streak-two','streak-three',
  'streak-five','streak-seven','streak-fourteen','streak-thirty','cycle-twenty-five','month-hundred','weekend-win','early-bird','night-owl','goal-set',
  'task-proposal','reward-proposal','reward-request','reward-enjoyed','explorer-three','explorer-all','logo-tap','phrase-switch','house-scout','five-unique',
] as const;
export type DiscoveryId = typeof DISCOVERY_IDS[number];
export const CLIENT_DISCOVERIES = new Set<DiscoveryId>(['kind-heart','explorer-three','explorer-all','logo-tap','phrase-switch','house-scout']);

const titles: Record<DiscoveryId, Words> = {
  'kind-heart':{es:'Corazón curioso',ca:'Cor curiós',en:'Curious heart'},
  'three-in-a-row':{es:'Tres misiones en un día',ca:'Tres missions en un dia',en:'Three missions in a day'},
  'returning-player':{es:'Diez días de aventura',ca:'Deu dies d’aventura',en:'Ten days of adventure'},
  'first-task':{es:'¡Primer paso!',ca:'Primer pas!',en:'First step!'},
  'five-today':{es:'Cinco en un día',ca:'Cinc en un dia',en:'Five in one day'},
  'seven-today':{es:'Siete en un día',ca:'Set en un dia',en:'Seven in one day'},
  'full-day':{es:'De la mañana a la noche',ca:'Del matí a la nit',en:'From morning to night'},
  'bed-boss':{es:'Cama bajo control',ca:'Llit sota control',en:'Bed in order'},
  'backpack-pro':{es:'Mochila preparada',ca:'Motxilla preparada',en:'Backpack ready'},
  'shower-power':{es:'Rutina de ducha',ca:'Rutina de dutxa',en:'Shower routine'},
  'room-rescue':{es:'Habitación en orden',ca:'Habitació endreçada',en:'Room in order'},
  'table-team':{es:'Equipo de mesa',ca:'Equip de taula',en:'Table team'},
  'laundry-legend':{es:'Ropa en su sitio',ca:'Roba al seu lloc',en:'Clothes in place'},
  'plan-master':{es:'Plan en marcha',ca:'Pla en marxa',en:'Plan in motion'},
  'ready-dressed':{es:'Preparada a tiempo',ca:'Preparada a temps',en:'Ready on time'},
  'tomorrow-ready':{es:'Mañana empieza hoy',ca:'Demà comença avui',en:'Tomorrow starts today'},
  'first-five':{es:'Cinco misiones',ca:'Cinc missions',en:'Five missions'},
  'task-ten':{es:'Diez misiones',ca:'Deu missions',en:'Ten missions'},
  'task-twenty-five':{es:'Veinticinco misiones',ca:'Vint-i-cinc missions',en:'Twenty-five missions'},
  'task-fifty':{es:'Cincuenta misiones',ca:'Cinquanta missions',en:'Fifty missions'},
  'task-hundred':{es:'Cien misiones',ca:'Cent missions',en:'One hundred missions'},
  'task-two-fifty':{es:'Doscientas cincuenta misiones',ca:'Dues-centes cinquanta missions',en:'Two hundred fifty missions'},
  'task-five-hundred':{es:'Quinientas misiones',ca:'Cinc-centes missions',en:'Five hundred missions'},
  'xp-twenty-five':{es:'25 Xp ganados',ca:'25 Xp guanyats',en:'25 Xp earned'},
  'xp-fifty':{es:'50 Xp ganados',ca:'50 Xp guanyats',en:'50 Xp earned'},
  'xp-hundred':{es:'100 Xp ganados',ca:'100 Xp guanyats',en:'100 Xp earned'},
  'xp-two-fifty':{es:'250 Xp ganados',ca:'250 Xp guanyats',en:'250 Xp earned'},
  'xp-five-hundred':{es:'500 Xp ganados',ca:'500 Xp guanyats',en:'500 Xp earned'},
  'streak-two':{es:'Dos días seguidos',ca:'Dos dies seguits',en:'Two days in a row'},
  'streak-three':{es:'Tres días seguidos',ca:'Tres dies seguits',en:'Three days in a row'},
  'streak-five':{es:'Cinco días seguidos',ca:'Cinc dies seguits',en:'Five days in a row'},
  'streak-seven':{es:'Una semana de constancia',ca:'Una setmana de constància',en:'A week of consistency'},
  'streak-fourteen':{es:'Dos semanas de constancia',ca:'Dues setmanes de constància',en:'Two weeks of consistency'},
  'streak-thirty':{es:'Treinta días de constancia',ca:'Trenta dies de constància',en:'Thirty days of consistency'},
  'cycle-twenty-five':{es:'25 Xp en siete días',ca:'25 Xp en set dies',en:'25 Xp in seven days'},
  'month-hundred':{es:'100 Xp este mes',ca:'100 Xp aquest mes',en:'100 Xp this month'},
  'weekend-win':{es:'Fin de semana activo',ca:'Cap de setmana actiu',en:'Active weekend'},
  'early-bird':{es:'Mañanas con energía',ca:'Matins amb energia',en:'Energetic mornings'},
  'night-owl':{es:'Noches con ganas',ca:'Nits amb ganes',en:'Evening effort'},
  'goal-set':{es:'Un premio en mente',ca:'Un premi en ment',en:'A reward in mind'},
  'task-proposal':{es:'Una misión inventada',ca:'Una missió inventada',en:'A mission idea'},
  'reward-proposal':{es:'Un premio propuesto',ca:'Un premi proposat',en:'A reward idea'},
  'reward-request':{es:'Primer premio solicitado',ca:'Primer premi demanat',en:'First reward requested'},
  'reward-enjoyed':{es:'Premio disfrutado',ca:'Premi gaudit',en:'Reward enjoyed'},
  'explorer-three':{es:'Exploradora de tres rincones',ca:'Exploradora de tres racons',en:'Explorer of three corners'},
  'explorer-all':{es:'Exploradora de la app',ca:'Exploradora de l’app',en:'App explorer'},
  'logo-tap':{es:'La copa tiene secretos',ca:'La copa té secrets',en:'The trophy has secrets'},
  'phrase-switch':{es:'Coleccionista de frases',ca:'Col·leccionista de frases',en:'Phrase collector'},
  'house-scout':{es:'Exploradora de la casa',ca:'Exploradora de la casa',en:'House explorer'},
  'five-unique':{es:'Cinco misiones distintas',ca:'Cinc missions diferents',en:'Five different missions'},
};
export function discoveryTitle(id: string, lang: Lang) { return titles[id as DiscoveryId]?.[lang] ?? id; }
export function discoveryWords(id: DiscoveryId): Words { return titles[id]; }

const taskDiscoveries: Record<string,DiscoveryId> = {bed:'bed-boss',bag:'backpack-pro',shower:'shower-power',room:'room-rescue',table:'table-team',laundry:'laundry-legend',plan:'plan-master',dress:'ready-dressed',clothes:'tomorrow-ready'};
function shift(day:string,amount:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);}
function streak(days:Set<string>,today:string){let count=0,cursor=today;while(days.has(cursor)){count++;cursor=shift(cursor,-1);}return count;}
function madridHour(value:string){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hourCycle:'h23'}).format(new Date(value)));}

export function objectiveDiscoveryCandidates(state:State,child:Child,today:string): DiscoveryId[] {
  const completed=state.completions.filter(item=>item.child===child&&!item.reversed&&item.xp>0&&!item.taskId.startsWith('egg-'));
  const todayItems=completed.filter(item=>item.day===today);
  const totalXp=completed.reduce((sum,item)=>sum+item.xp,0);
  const ids:DiscoveryId[]=[];
  const add=(id:DiscoveryId,condition:boolean)=>{if(condition)ids.push(id);};
  const categories=new Set(todayItems.map(item=>item.category));
  const activeDays=new Set(completed.map(item=>item.day));
  const recentXp=completed.filter(item=>item.day>=shift(today,-6)).reduce((sum,item)=>sum+item.xp,0);
  const monthXp=completed.filter(item=>item.day.slice(0,7)===today.slice(0,7)).reduce((sum,item)=>sum+item.xp,0);
  const timed=todayItems.filter(item=>item.effectiveAt);
  add('first-task',completed.length>=1);
  add('three-in-a-row',todayItems.length>=3);
  add('returning-player',activeDays.size>=10);
  add('five-today',todayItems.length>=5);add('seven-today',todayItems.length>=7);
  add('full-day',categories.has('morning')&&categories.has('afternoon')&&categories.has('evening'));
  for(const [task,id] of Object.entries(taskDiscoveries))add(id,completed.filter(item=>item.taskId===task).length>=3);
  add('first-five',completed.length>=5);add('task-ten',completed.length>=10);add('task-twenty-five',completed.length>=25);add('task-fifty',completed.length>=50);
  add('task-hundred',completed.length>=100);add('task-two-fifty',completed.length>=250);add('task-five-hundred',completed.length>=500);
  add('xp-twenty-five',totalXp>=25);add('xp-fifty',totalXp>=50);add('xp-hundred',totalXp>=100);add('xp-two-fifty',totalXp>=250);add('xp-five-hundred',totalXp>=500);
  const currentStreak=streak(activeDays,today);
  add('streak-two',currentStreak>=2);add('streak-three',currentStreak>=3);add('streak-five',currentStreak>=5);add('streak-seven',currentStreak>=7);add('streak-fourteen',currentStreak>=14);add('streak-thirty',currentStreak>=30);
  add('cycle-twenty-five',recentXp>=25);add('month-hundred',monthXp>=100);
  add('weekend-win',[0,6].includes(new Date(today+'T12:00:00Z').getUTCDay())&&todayItems.length>=3);
  add('early-bird',timed.filter(item=>madridHour(item.effectiveAt!)<9).length>=3);
  add('night-owl',timed.filter(item=>madridHour(item.effectiveAt!)>=20).length>=3);
  add('goal-set',Boolean(state.preferences[child]?.goal));add('task-proposal',state.tasks.some(item=>item.author===child));add('reward-proposal',state.rewards.some(item=>item.author===child));
  add('reward-request',state.redemptions.some(item=>item.child===child));add('reward-enjoyed',state.redemptions.some(item=>item.child===child&&item.status==='fulfilled'));
  add('five-unique',new Set(todayItems.map(item=>item.taskId)).size>=5);
  return ids;
}
