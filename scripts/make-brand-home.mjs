import { readFileSync, writeFileSync } from 'node:fs';
const file='app/task-xp.tsx';
let source=readFileSync(file,'utf8');
source=source.replace('<aside className="sidebar"><Brand/>','<aside className="sidebar"><Brand onHome={()=>setTab(\'today\')}/>');
source=source.replace('<div className="mobile-brand"><Brand/></div>','<div className="mobile-brand"><Brand onHome={()=>setTab(\'today\')}/></div>');
writeFileSync(file,source);
