'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '@/lib/domain';
import { ASLEEP_START, CYCLE_SECONDS, DAY_END, WAKE_START, buildCatPlan, buildDayPlan, sampleCat, samplePerson, type HousePerson, type MotionPlan } from './house-motion';

export function XPHouse({lang='es',onDiscover}:{lang?:Lang;onDiscover?:()=>void}){
  const [reduced,setReduced]=useState(true),[scene,setScene]=useState({time:WAKE_START,round:0}),[seed,setSeed]=useState(1);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduced(media.matches);
    sync();media.addEventListener('change',sync);
    const randomize=window.setTimeout(()=>setSeed(crypto.getRandomValues(new Uint32Array(1))[0]||1),0);
    let previous=performance.now();
    const timer=window.setInterval(()=>{
      const now=performance.now(),delta=Math.min((now-previous)/1000,.1);
      previous=now;
      if(!media.matches&&document.visibilityState==='visible')setScene(({time,round})=>{
        const next=time+delta;
        return next>=CYCLE_SECONDS?{time:next-CYCLE_SECONDS,round:round+1}:{time:next,round};
      });
    },33);
    return()=>{media.removeEventListener('change',sync);window.clearTimeout(randomize);window.clearInterval(timer);};
  },[]);
  const running=!reduced;
  const time=running?scene.time:0;
  const night=running&&time>=ASLEEP_START&&time<WAKE_START;
  const plans=useMemo(()=>({
    A:buildDayPlan('A',seed+scene.round),I:buildDayPlan('I',seed+scene.round),
    X:buildDayPlan('X',seed+scene.round),M:buildDayPlan('M',seed+scene.round),
    cat:buildCatPlan(seed+scene.round),
  }),[seed,scene.round]);
  const watching=running&&time<DAY_END&&(['A','I','X','M'] as const).some(person=>samplePerson(person,plans[person],time).activity==='sofa');
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  return <section className={`home-arcade ${running?'running':'paused'} ${night?'nighttime':''}`} aria-label={t('Vuestra casa animada','La vostra casa animada','Your animated home')} onClick={onDiscover}>
    <svg viewBox="0 0 420 670" role="img" aria-label={t('Plano de casa: terraza y salón arriba, cocina y baños en el centro, Aina e Iara abajo','Plànol de casa amb les habitacions d’Aina i Iara a baix','Floorplan with Aina and Iara bedrooms at the bottom')}>
      <defs><pattern id="floorboards" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 24H24M12 0V24" stroke="#bfd4d5" opacity=".045"/></pattern><pattern id="tiles" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="#bfd4d5" opacity=".09"/></pattern><filter id="playerGlow"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path d="M145 28H384V640H25V405H78V350H145Z" fill="#1c2c38" stroke="#65828c" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M145 28H384V112H145Z" fill="#263b3c"/>
      <path d="M145 112H384V303H145Z" fill="#273240"/>
      <path d="M258 303H384V403H258Z" fill="#273738"/>
      <path d="M25 405H98V520H25ZM284 405H384V505H284Z" fill="#263442"/>
      <path d="M204 405H284V520H204Z" fill="#303343"/>
      <path d="M25 520H140V640H25Z" fill="#21413f"/>
      <path d="M140 520H256V640H140Z" fill="#382d48"/>
      <path d="M256 505H384V640H256Z" fill="#303343"/>
      <path d="M145 28H384V640H25V405H78V350H145Z" fill="url(#floorboards)"/>
      <path d="M25 405H98V520H25ZM284 405H384V505H284ZM258 303H384V403H258Z" fill="url(#tiles)"/>
      <g className="plan-walls" fill="none" stroke="#69838b" strokeWidth="4"><path d="M145 112H181M213 112H281M325 112H384M258 303H384M258 303V349M145 112V351H78V405H98V444M98 476V520M25 520H102M130 520H168M196 520H256M140 520V640M256 520V640M284 505H384M284 405V446M284 476V505M98 405H145M174 405H384M204 405V445M204 474V520M258 378V405"/></g>
      <g stroke="#94bebd" strokeWidth="2" opacity=".8"><path d="M151 32H378M29 640H126M151 640H242M275 640H375M384 142V252"/></g>
      <g className="plan-doors" stroke="#70938f" fill="none" strokeWidth="1" strokeDasharray="3 3"><path d="M281 112V142Q325 142 325 112M102 520V550Q130 550 130 520M168 520V548Q196 548 196 520M145 405V434Q174 434 174 405M204 445H233Q233 474 204 474M98 444H66Q66 476 98 476M284 446H315Q315 476 284 476M258 349H288Q288 378 258 378"/></g>
      <g className="plan-furniture" stroke="#8296a6" strokeWidth="1.5">
        <rect x="177" y="49" width="32" height="39" rx="7" fill="#4b6560" transform="rotate(25 193 68)"/><circle cx="323" cy="71" r="22" fill="#53615e"/><circle cx="352" cy="71" r="6" fill="#72806b"/><circle cx="294" cy="71" r="6" fill="#72806b"/>
        <rect x="335" y="148" width="35" height="125" rx="7" fill="#526077"/><path d="M335 189H370M335 230H370"/><rect x="253" y="248" width="82" height="30" rx="5" fill="#526077"/><rect x="263" y="186" width="49" height="48" rx="5" fill="#6d6664"/>
        <rect x="160" y="155" width="10" height="110" rx="3" fill={watching?'#70c9d1':'#111e2d'} className={watching?'house-tv-on':''}/>
        <rect x="202" y="306" width="40" height="43" rx="4" fill="#78736b"/><path d="M197 315H191V341H197M247 315H251V341H247"/>
        <path d="M272 316H371V389H272V370H353V335H272Z" fill="#5c6868"/><circle cx="285" cy="325" r="5" fill="#283942"/><circle cx="302" cy="325" r="5" fill="#283942"/><rect x="356" y="348" width="12" height="20" rx="3" fill="#9fb6b7"/>
        <rect x="34" y="417" width="54" height="26" rx="11" fill="#859ea7"/><rect x="40" y="422" width="40" height="15" rx="7" fill="#3f6471"/><ellipse cx="43" cy="473" rx="10" ry="14" fill="#91a6b0"/><circle cx="82" cy="489" r="9" fill="#91a6b0"/>
        <rect x="350" y="421" width="24" height="57" rx="10" fill="#8197a9"/><circle cx="309" cy="425" r="11" fill="#91a6b0"/>
        <Bed x={38} y={552} color="#4caaa0"/><Desk x={102} y={607} color="#5d9690"/>
        <Bed x={205} y={550} color="#a181b5"/><Desk x={166} y={611} color="#8d739f"/>
        <rect x="304" y="550" width="65" height="74" rx="5" fill="#777d98"/><rect x="309" y="553" width="23" height="15" rx="3" fill="#b8bacc"/><rect x="339" y="553" width="23" height="15" rx="3" fill="#b8bacc"/><path d="M304 578H369"/>
      </g>
      <g className="plan-labels"><text x="235" y="46">{t('TERRAZA','TERRASSA','TERRACE')}</text><text x="248" y="137">{t('SALÓN','SALA','LOUNGE')}</text><text x="312" y="300">{t('COCINA','CUINA','KITCHEN')}</text><text x="70" y="459">{t('BAÑO','BANY','BATH')}</text><text x="330" y="496">{t('BAÑO','BANY','BATH')}</text><text x="175" y="459">{t('PASILLO','PASSADÍS','HALL')}</text><text x="77" y="543" fill="#91dfce">AINA</text><text x="187" y="543" fill="#d6b3ed">IARA</text><text x="326" y="529">{t('DORMITORIO','DORMITORI','BEDROOM')}</text></g>
      <Resident name="A" hair="curly" color="#56bfb0" time={time} plan={plans.A} running={running} sleeping={night} task={t('Mesa lista','Taula a punt','Table set')} xp={5}/>
      <Resident name="I" hair="straight" color="#af87ca" time={time} plan={plans.I} running={running} sleeping={night} task={t('Misión hecha','Missió feta','Mission done')} xp={5}/>
      <Resident name="X" hair="brown" color="#8aa1bd" time={time} plan={plans.X} running={running} sleeping={night} task={t('En equipo','En equip','Teamwork')} />
      <Resident name="M" hair="straight" color="#c6aa7a" time={time} plan={plans.M} running={running} sleeping={night} task={t('En equipo','En equip','Teamwork')}/>
      <Cat time={time} plan={plans.cat} running={running} sleeping={night}/>
    </svg>
  </section>;
}
function Bed({x,y,color,horizontal=false}:{x:number;y:number;color:string;horizontal?:boolean}){return horizontal?<g><rect x={x} y={y} width="68" height="33" rx="4" fill={color}/><rect x={x+49} y={y+4} width="14" height="25" rx="4" fill="#cadbd9"/><path d={`M${x+41} ${y}v33`} stroke="#b7cdca"/></g>:<g><rect x={x} y={y} width="33" height="68" rx="4" fill={color}/><rect x={x+4} y={y+5} width="25" height="14" rx="4" fill="#cadbd9"/><path d={`M${x} ${y+27}h33`} stroke="#b7cdca"/></g>}
function Desk({x,y,color}:{x:number;y:number;color:string}){return <g><rect x={x} y={y} width="32" height="18" rx="2" fill={color}/><rect x={x+7} y={y+3} width="17" height="10" rx="1" fill="#1d303c"/><circle cx={x+16} cy={y-8} r="7" fill={color}/></g>}
function Resident({name,hair,color,time,plan,running,sleeping,task,xp}:{name:HousePerson;hair:'curly'|'straight'|'brown';color:string;time:number;plan:MotionPlan;running:boolean;sleeping:boolean;task:string;xp?:number}){
  const {point:[x,y],activity}=samplePerson(name,plan,time);
  const active=running&&time<DAY_END;
  const moment=Math.floor((time+{A:0,I:4,X:8,M:12}[name])/6)%4;
  return <g transform={`translate(${x} ${y})`}>
    <circle r="18" fill={color} opacity=".24" filter="url(#playerGlow)"/><path d="M-9 2Q0-2 9 2V17H-9Z" fill={color}/><path d="M-9 5L-13 11M9 5L13 11" stroke="#f3c89e" strokeWidth="2" strokeLinecap="round"/><circle cy="-5" r="7" fill="#f3c89e"/><path d={hair==='curly'?'M-8-7q2-5 5 0q2-6 5 0q2-4 5 1':hair==='brown'?'M-8-7Q0-14 8-7V-2H-8Z':'M-8-7Q0-13 8-7V-2H-8Z'} fill={hair==='brown'?'#70472f':'#f4df8a'} stroke={hair==='curly'?'#e8c865':'none'} strokeWidth="1.5"/><circle cx="-2.3" cy="-5" r=".7" fill="#26313a"/><circle cx="2.3" cy="-5" r=".7" fill="#26313a"/><path d="M-2-1Q0 1 2-1" fill="none" stroke="#a45d5c" strokeWidth=".8"/><path d="M-5 17v4M5 17v4" stroke="#dbe5e5" strokeWidth="2.4" strokeLinecap="round"/>
    {activity==='sofa'&&<text textAnchor="middle" y="-31" className="person-action">📺</text>}
    {active&&!activity&&moment===1&&<text textAnchor="middle" y="-32" className="person-action">{xp?`✓ +${xp} Xp`:`✓ ${task}`}</text>}
    {active&&!activity&&moment===2&&<text textAnchor="middle" y="-42" className="person-chat">bla bla bla...</text>}
    {sleeping&&<text x="8" y="-17" className="cat-zzz">zzZZzz...</text>}
  </g>;
}
function Cat({time,plan,running,sleeping}:{time:number;plan:MotionPlan;running:boolean;sleeping:boolean}){
  const {point:[x,y],idleFor}=sampleCat(plan,time);
  const [nextX]=sampleCat(plan,(time+.15)%CYCLE_SECONDS).point;
  const facing=nextX<x?-1:1;
  return <g className="house-cat" transform={`translate(${x} ${y})`}>
    <g className="cat-face" transform={`scale(${facing} 1)`}><text textAnchor="middle" y="5" fontSize="18">🐈</text></g>
    {sleeping&&<text x="12" y="-11" className="cat-zzz">zzZZzz...</text>}
    {running&&time<DAY_END&&idleFor>2.5&&<text x="12" y="-11" className="cat-zzz">zzZZzz...</text>}
  </g>;
}
