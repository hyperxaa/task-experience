'use client';
import { useState } from 'react';
import { ArrowRight, Delete, Shuffle, LockKeyhole } from 'lucide-react';
import { names, type Person } from '@/lib/domain';

export const animals = [
  {id:'bengal',emoji:'🐈',es:'Gato bengalí'}, {id:'panda',emoji:'🐼',es:'Panda'},
  {id:'fox',emoji:'🦊',es:'Zorro'}, {id:'otter',emoji:'🦦',es:'Nutria'},
  {id:'owl',emoji:'🦉',es:'Búho'}, {id:'frog',emoji:'🐸',es:'Rana'},
  {id:'lion',emoji:'🦁',es:'León'}, {id:'bunny',emoji:'🐰',es:'Conejo'},
  {id:'koala',emoji:'🐨',es:'Koala'}, {id:'dog',emoji:'🐶',es:'Perro'},
  {id:'penguin',emoji:'🐧',es:'Pingüino'}, {id:'flamingo',emoji:'🦩',es:'Flamenco'},
] as const;
export type AnimalId=(typeof animals)[number]['id'];
export const animalById=Object.fromEntries(animals.map(a=>[a.id,a])) as Record<AnimalId,(typeof animals)[number]>;

function mix<T>(items:readonly T[]){const next=[...items];for(let i=next.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[next[i],next[j]]=[next[j],next[i]];}return next;}

export function AnimalPad({lang,busy,onUnlock}:{lang:string;busy:boolean;onUnlock:(code:string)=>Promise<boolean>}){
  const [code,setCode]=useState<AnimalId[]>([]),[pad,setPad]=useState(()=>[...animals]);
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  async function submit(value=code){if(value.length!==4||busy)return;if(await onUnlock(value.join('.')))setCode([]);}
  async function choose(id:AnimalId){if(busy||code.length>=4)return;const next=[...code,id];setCode(next);if(next.length===4)await submit(next);}
  return <section className="animal-console" aria-label={t('Acceso con animales','Accés amb animals','Animal access')}>
    <div className="pin-console-head"><span><LockKeyhole size={15}/> ANIMAL CODE</span><button type="button" disabled={busy} onClick={()=>setPad(mix(animals))} aria-label={t('Mezclar animales','Barrejar animals','Shuffle animals')}><Shuffle size={16}/>{t('Mezclar','Barrejar','Shuffle')}</button></div>
    <div className="animal-sequence" aria-label={t('Tu combinación','La teva combinació','Your sequence')}>{Array.from({length:4},(_,i)=>{const animal=code[i]&&animalById[code[i]];return <span className={animal?.id==='bengal'?'bengal chosen':'chosen'} key={i}>{animal?animal.emoji:<b>{i+1}</b>}</span>;})}</div>
    <div className="animal-pad">{pad.map(a=><button key={a.id} className={a.id==='bengal'?'bengal':''} type="button" disabled={busy||code.length>=4} onClick={()=>void choose(a.id)} aria-label={a.es}><span>{a.emoji}</span><small>{a.es}</small></button>)}</div>
    <div className="animal-actions"><button type="button" disabled={busy||code.length===0} onClick={()=>setCode(v=>v.slice(0,-1))}><Delete size={18}/>{t('Atrás','Enrere','Back')}</button><p>{t('Con cuatro animales, entras directamente.','Amb quatre animals, entres directament.','Four animals take you straight in.')}</p></div>
  </section>;
}

export function AnimalCodePicker({value,onChange,lang}:{value:AnimalId[];onChange:(value:AnimalId[])=>void;lang:string}){
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  return <div className="animal-picker"><div className="animal-sequence compact">{Array.from({length:4},(_,i)=>{const a=value[i]&&animalById[value[i]];return <span className={a?.id==='bengal'?'bengal chosen':'chosen'} key={i}>{a?a.emoji:<b>{i+1}</b>}</span>;})}</div><div className="animal-picker-grid">{animals.map(a=><button type="button" key={a.id} className={a.id==='bengal'?'bengal':''} disabled={value.length>=4} onClick={()=>onChange([...value,a.id])} aria-label={a.es}>{a.emoji}</button>)}</div><button className="text-button" type="button" disabled={!value.length} onClick={()=>onChange(value.slice(0,-1))}><Delete size={16}/>{t('Borrar último','Esborrar últim','Delete last')}</button></div>;
}

export function CodeReveal({codes,lang,onDone}:{codes:Record<Person,AnimalId[]>;lang:string;onDone:()=>void}){
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  return <div className="code-reveal"><div className="reveal-warning"><LockKeyhole size={19}/><p><strong>{t('Guardad estas combinaciones ahora.','Deseu aquestes combinacions ara.','Save these combinations now.')}</strong><span>{t('Solo aparecen esta vez. Podréis cambiarlas desde Gestión.','Només apareixen aquesta vegada. Les podreu canviar des de Gestió.','They appear only once. You can change them in Manage.')}</span></p></div>{(Object.keys(names) as Person[]).map(p=><article key={p}><span className={`avatar small ${p}`}>{names[p][0]}</span><strong>{names[p]}</strong><div>{codes[p].map((id,i)=><span title={animalById[id].es} className={id==='bengal'?'bengal':''} key={`${id}-${i}`}>{animalById[id].emoji}</span>)}</div></article>)}<button className="pin-enter" onClick={onDone}>{t('Las tengo. Que empiece la partida.','Les tinc. Que comenci la partida.','Got them. Start the game.')}<ArrowRight size={18}/></button></div>;
}
