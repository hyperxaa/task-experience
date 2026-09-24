import { shiftDay, type Child, type State } from '@/lib/domain';

export type EggSignals = { tabs: number; logo: number; phrases: number; house: number };

// The names are intentionally internal: the app only reveals the discovery count.
export const EGG_IDS = [
  'kind-heart','three-in-a-row','returning-player','first-task','five-today','seven-today','full-day','bed-boss','backpack-pro','shower-power',
  'room-rescue','table-team','laundry-legend','plan-master','ready-dressed','tomorrow-ready','first-five','task-ten','task-twenty-five','task-fifty',
  'task-hundred','task-two-fifty','task-five-hundred','xp-twenty-five','xp-fifty','xp-hundred','xp-two-fifty','xp-five-hundred','streak-two','streak-three',
  'streak-five','streak-seven','streak-fourteen','streak-thirty','cycle-twenty-five','month-hundred','weekend-win','early-bird','night-owl','goal-set',
  'task-proposal','reward-proposal','reward-request','reward-enjoyed','explorer-three','explorer-all','logo-tap','phrase-switch','house-scout','five-unique',
] as const;

const taskEggs: Record<string,string> = {bed:'bed-boss',bag:'backpack-pro',shower:'shower-power',room:'room-rescue',table:'table-team',laundry:'laundry-legend',plan:'plan-master',dress:'ready-dressed',clothes:'tomorrow-ready'};

function streak(days:Set<string>, today:string){let count=0, cursor=today;while(days.has(cursor)){count++;cursor=shiftDay(cursor,-1);}return count;}
function madridHour(value:string){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hourCycle:'h23'}).format(new Date(value)));}

export function eggCandidates(state:State, child:Child, today:string, signals:EggSignals){
  const completed=state.completions.filter(item=>item.child===child&&!item.reversed&&!item.taskId.startsWith('egg-'));
  const todayItems=completed.filter(item=>item.day===today);
  const totalXp=completed.reduce((sum,item)=>sum+item.xp,0);
  const ids:string[]=[];
  const add=(id:string,condition:boolean)=>{if(condition)ids.push(id);};
  const taskIds=new Set(completed.map(item=>item.taskId));
  const dayTaskIds=new Set(todayItems.map(item=>item.taskId));
  const categories=new Set(todayItems.map(item=>item.category));
  const activeDays=new Set(completed.map(item=>item.day));
  const currentWeek=completed.filter(item=>item.day>=shiftDay(today,-6)).reduce((sum,item)=>sum+item.xp,0);
  const currentMonth=completed.filter(item=>item.day.slice(0,7)===today.slice(0,7)).reduce((sum,item)=>sum+item.xp,0);
  const currentStreak=streak(activeDays,today);
  const hourItems=todayItems.filter(item=>item.effectiveAt);

  add('first-task',completed.length>=1); add('five-today',todayItems.length>=5); add('seven-today',todayItems.length>=7);
  add('full-day',categories.has('morning')&&categories.has('afternoon')&&categories.has('evening'));
  Object.entries(taskEggs).forEach(([task,id])=>add(id,taskIds.has(task)));
  add('first-five',completed.length>=5);add('task-ten',completed.length>=10);add('task-twenty-five',completed.length>=25);add('task-fifty',completed.length>=50);add('task-hundred',completed.length>=100);add('task-two-fifty',completed.length>=250);add('task-five-hundred',completed.length>=500);
  add('xp-twenty-five',totalXp>=25);add('xp-fifty',totalXp>=50);add('xp-hundred',totalXp>=100);add('xp-two-fifty',totalXp>=250);add('xp-five-hundred',totalXp>=500);
  add('streak-two',currentStreak>=2);add('streak-three',currentStreak>=3);add('streak-five',currentStreak>=5);add('streak-seven',currentStreak>=7);add('streak-fourteen',currentStreak>=14);add('streak-thirty',currentStreak>=30);
  add('cycle-twenty-five',currentWeek>=25);add('month-hundred',currentMonth>=100);add('weekend-win',[0,6].includes(new Date(`${today}T12:00:00Z`).getUTCDay())&&todayItems.length>0);
  add('early-bird',hourItems.some(item=>madridHour(item.effectiveAt!)<9));add('night-owl',hourItems.some(item=>madridHour(item.effectiveAt!)>=20));
  add('goal-set',Boolean(state.preferences[child]?.goal));add('task-proposal',state.tasks.some(item=>item.author===child));add('reward-proposal',state.rewards.some(item=>item.author===child));
  add('reward-request',state.redemptions.some(item=>item.child===child));add('reward-enjoyed',state.redemptions.some(item=>item.child===child&&item.status==='fulfilled'));
  add('explorer-three',signals.tabs>=3);add('explorer-all',signals.tabs>=4);add('logo-tap',signals.logo>=3);add('phrase-switch',signals.phrases>=5);add('house-scout',signals.house>=3);add('five-unique',dayTaskIds.size>=5);
  return ids;
}

export const defaultEggSignals:EggSignals={tabs:0,logo:0,phrases:0,house:0};
