import { readFileSync, writeFileSync } from 'node:fs';
const file='app/task-xp.tsx';
const source=readFileSync(file,'utf8');
const marker='<section className="panel"><h2><Download size={21}/>{t(\'Vuestros datos\',\'Les vostres dades\',\'Your data\')}</h2>';
const panel="{foundEggs.length>0&&<section className=\"panel secret-progress\"><h2><Sparkles size={21}/>{t('Descubrimientos','Descobriments','Discoveries')}</h2><p className=\"muted\">{t('Hay pequeñas sorpresas por el camino. Algunas aparecen haciendo cosas, otras mirando bien.','Hi ha petites sorpreses pel camí. Algunes apareixen fent coses, d’altres mirant bé.','There are small surprises along the way. Some appear by doing, others by looking closely.')}</p><Progress value={Math.min(100,foundEggs.length*12)} aria-label={`${foundEggs.length} ${t('descubrimientos encontrados','descobriments trobats','discoveries found')}`}/><strong>{foundEggs.length} {t('descubrimientos encontrados','descobriments trobats','discoveries found')}</strong></section>}";
if(!source.includes(marker))throw new Error('Secret panel marker not found');
writeFileSync(file,source.replace(marker,panel+marker));
