'use client';
import { useState } from 'react';
import { ArrowRight, Delete, Shuffle, LockKeyhole } from 'lucide-react';
import type { Person } from '@/lib/domain';
import type { Member } from '@/lib/family';

export const animals = [
  {id:'bengal',emoji:'🐈',es:'Gato bengalí'}, {id:'panda',emoji:'🐼',es:'Panda'},
  {id:'fox',emoji:'🦊',es:'Zorro'}, {id:'otter',emoji:'',es:'Ajolote'}, // Keep the stored id so existing animal codes remain valid.
  {id:'owl',emoji:'🦉',es:'Búho'}, {id:'frog',emoji:'🐸',es:'Rana'},
  {id:'lion',emoji:'🦁',es:'León'}, {id:'bunny',emoji:'🐰',es:'Conejo'},
  {id:'koala',emoji:'🐨',es:'Koala'}, {id:'dog',emoji:'🐶',es:'Perro'},
  {id:'penguin',emoji:'🐧',es:'Pingüino'}, {id:'flamingo',emoji:'🦩',es:'Flamenco'},
] as const;
export type AnimalId=(typeof animals)[number]['id'];
export const animalById=Object.fromEntries(animals.map(a=>[a.id,a])) as Record<AnimalId,(typeof animals)[number]>;
function AnimalGlyph({animal}:{animal:(typeof animals)[number]}){
  if(animal.id!=='otter')return animal.emoji;
  return <svg className="animal-glyph axolotl-glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <g fill="none" stroke="#f58caa" strokeWidth="2.6" strokeLinecap="round"><path d="M8 12 3 8M8 15 2 15M8 18 3 22M24 12 29 8M24 15 30 15M24 18 29 22"/></g>
    <path d="M8 13Q9 8 16 9Q23 8 24 14L27 20Q29 23 25 24L22 22Q16 26 10 22L7 24Q3 23 6 19Z" fill="#ee9dbb" stroke="#b96185" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M10 21 7 26M15 23 14 27M22 22 25 26" fill="none" stroke="#d47d9f" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12.5" cy="15" r="1.25" fill="#422b3a"/><circle cx="19.5" cy="15" r="1.25" fill="#422b3a"/>
    <path d="M14 18Q16 20 18 18" fill="none" stroke="#9c4d70" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>;
}

function mix<T>(items:readonly T[]){const next=[...items];for(let i=next.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[next[i],next[j]]=[next[j],next[i]];}return next;}

export function AnimalPad({lang,busy,onUnlock}:{lang:string;busy:boolean;onUnlock:(code:string)=>Promise<boolean>}){
  const [code,setCode]=useState<AnimalId[]>([]),[pad,setPad]=useState(()=>[...animals]);
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  async function submit(value=code){if(value.length!==4||busy)return;if(await onUnlock(value.join('.')))setCode([]);}
  async function choose(id:AnimalId){if(busy||code.length>=4)return;const next=[...code,id];setCode(next);if(next.length===4)await submit(next);}
  return <section className="animal-console" aria-label={t('Acceso con animales','Accés amb animals','Animal access')}>
    <div className="pin-console-head"><span><LockKeyhole size={15}/> ANIMAL CODE</span><button type="button" disabled={busy} onClick={()=>setPad(mix(animals))} aria-label={t('Mezclar animales','Barrejar animals','Shuffle animals')}><Shuffle size={16}/>{t('Mezclar','Barrejar','Shuffle')}</button></div>
    <div className="animal-sequence" aria-label={t('Tu combinación','La teva combinació','Your sequence')}>{Array.from({length:4},(_,i)=>{const animal=code[i]&&animalById[code[i]];return <span className={animal?.id==='bengal'?'bengal chosen':'chosen'} key={i}>{animal?<AnimalGlyph animal={animal}/>:<b>{i+1}</b>}</span>;})}</div>
    <div className="animal-pad">{pad.map(a=><button key={a.id} className={a.id==='bengal'?'bengal':''} type="button" disabled={busy||code.length>=4} onClick={()=>void choose(a.id)} aria-label={a.es}><span><AnimalGlyph animal={a}/></span><small>{a.es}</small></button>)}</div>
    <div className="animal-actions"><button type="button" disabled={busy||code.length===0} onClick={()=>setCode(v=>v.slice(0,-1))}><Delete size={18}/>{t('Atrás','Enrere','Back')}</button><p>{t('Con cuatro animales, entras directamente.','Amb quatre animals, entres directament.','Four animals take you straight in.')}</p></div>
  </section>;
}

export function AnimalCodePicker({value,onChange,lang}:{value:AnimalId[];onChange:(value:AnimalId[])=>void;lang:string}){
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  return <div className="animal-picker"><div className="animal-sequence compact">{Array.from({length:4},(_,i)=>{const a=value[i]&&animalById[value[i]];return <span className={a?.id==='bengal'?'bengal chosen':'chosen'} key={i}>{a?<AnimalGlyph animal={a}/>:<b>{i+1}</b>}</span>;})}</div><div className="animal-picker-grid">{animals.map(a=><button type="button" key={a.id} className={a.id==='bengal'?'bengal':''} disabled={value.length>=4} onClick={()=>onChange([...value,a.id])} aria-label={a.es}><AnimalGlyph animal={a}/></button>)}</div><button className="text-button" type="button" disabled={!value.length} onClick={()=>onChange(value.slice(0,-1))}><Delete size={16}/>{t('Borrar último','Esborrar últim','Delete last')}</button></div>;
}

export function CodeReveal({codes,members,lang,onDone}:{codes:Record<Person,AnimalId[]>;members:Member[];lang:string;onDone:()=>void}){
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  return <div className="code-reveal"><div className="reveal-warning"><LockKeyhole size={19}/><p><strong>{t('Guardad estas combinaciones ahora.','Deseu aquestes combinacions ara.','Save these combinations now.')}</strong><span>{t('Solo aparecen esta vez. Podréis cambiarlas desde Gestión.','Només apareixen aquesta vegada. Les podreu canviar des de Gestió.','They appear only once. You can change them in Manage.')}</span></p></div>{members.filter(p=>codes[p.id]).map(p=><article key={p.id}><span className={`avatar small ${p.id}`}>{p.name[0]}</span><strong>{p.name}</strong><div>{codes[p.id].map((id,i)=><span title={animalById[id].es} className={id==='bengal'?'bengal':''} key={`${id}-${i}`}><AnimalGlyph animal={animalById[id]}/></span>)}</div></article>)}<button className="pin-enter" onClick={onDone}>{t('Las tengo. Que empiece la partida.','Les tinc. Que comenci la partida.','Got them. Start the game.')}<ArrowRight size={18}/></button></div>;
}
