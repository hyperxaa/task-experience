'use client';

import { useState } from 'react';
import { CalendarDays, Download, LockKeyhole, PauseCircle, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { dateInMadrid, names, shiftDay, weekBeginning, type Action, type Child, type Lang, type State } from '@/lib/domain';

type Scope = 'day' | 'week' | 'month';
type Operation = 'bulkResetXp' | 'undoChildPeriod' | 'resetAll';
type Backup = { exportedAt: string; data: State };

function period(day: string, scope: Scope): [string,string] {
  if (scope === 'day') return [day,day];
  if (scope === 'week') { const start=weekBeginning(day,1); return [start,shiftDay(start,6)]; }
  const start=day.slice(0,7)+'-01';
  return [start,shiftDay(new Date(Date.UTC(+day.slice(0,4),+day.slice(5,7),1,12)).toISOString().slice(0,10),-1)];
}

export function SettingsView({ state,child,lang,busy,discoveredCount,onAction,onPause,onUnpause,onSecurity,onExport,onImport,onResetAll }: {
  state:State; child:Child; lang:Lang; busy:boolean;discoveredCount:number;
  onAction:(action:Omit<Action,'requestId'>)=>Promise<boolean>;
  onPause:()=>void; onUnpause:(id:string)=>Promise<boolean>; onSecurity:()=>void; onExport:()=>Promise<void>;
  onImport:(backup:Backup)=>Promise<boolean>; onResetAll:()=>Promise<boolean>;
}) {
  const [scope,setScope]=useState<Scope>('day'),[day,setDay]=useState(dateInMadrid()),[pending,setPending]=useState<Operation|null>(null);
  const [checkOne,setCheckOne]=useState(false),[checkTwo,setCheckTwo]=useState(false),[backup,setBackup]=useState<Backup|null>(null),[fileError,setFileError]=useState(''),[confirmImport,setConfirmImport]=useState(false);
  const t=(es:string,ca:string,en:string)=>lang==='ca'?ca:lang==='en'?en:es;
  const today=dateInMadrid(),[from,to]=period(day,scope);
  const countXp=state.completions.filter(c=>c.child===child&&c.day>=from&&c.day<=to&&!c.reversed&&c.xp>0).length;
  const countChild=state.completions.filter(c=>c.child===child&&c.actor===child&&!c.adjustments?.some(adjustment=>adjustment.actor==='xavi'||adjustment.actor==='mireia')&&dateInMadrid(new Date(c.at))>=from&&dateInMadrid(new Date(c.at))<=to&&!c.reversed&&c.xp>0).length;
  const countChanges=(state.changes??[]).filter(c=>c.actor===child&&!c.undoneBy&&dateInMadrid(new Date(c.at))>=from&&dateInMadrid(new Date(c.at))<=to).length;
  const endDay=((state.cycleRule?.day??1)+6)%7;
  const weekdays={es:['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],ca:['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'],en:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']}[lang];

  async function chooseFile(file?:File) {
    setBackup(null);setFileError('');setConfirmImport(false);if(!file)return;
    try {
      if(file.size>4_000_000)throw new Error('size');
      const value=JSON.parse(await file.text()) as Backup;
      if(!value||typeof value.exportedAt!=='string'||value.data?.version!==1||!Array.isArray(value.data.tasks)||!Array.isArray(value.data.completions))throw new Error('format');
      setBackup(value);
    } catch { setFileError(t('El archivo no parece una copia válida de Task eXperience.','El fitxer no sembla una còpia vàlida de Task eXperience.','This does not look like a valid Task eXperience backup.')); }
  }

  async function confirm() {
    if(!pending)return;
    const success=pending==='resetAll'?await onResetAll():await onAction({type:pending,child,scope,day});
    if(success){setPending(null);setCheckOne(false);setCheckTwo(false);}
  }

  return <div className="settings-view">
    <div className="manage-grid">
      <section className="panel"><h2><PauseCircle size={21}/>{t('Descanso y vacaciones','Descans i vacances','Rest and holidays')}</h2><p className="muted">{t('Los días de descanso no se exigen para los bonus.','Els dies de descans no compten per als bonus.','Rest days are not required for bonuses.')}</p>{state.pauses.filter(p=>!p.cancelledAt&&p.child===child&&p.to>=today).map(p=><div className="record-row" key={p.id}><p>{p.reason} · {p.from} — {p.to}</p><Button variant="outline" disabled={busy} onClick={()=>void onUnpause(p.id)}>{t('Quitar','Treure','Remove')}</Button></div>)}<Button variant="outline" onClick={onPause}>{t('Añadir descanso','Afegir descans','Add rest day')}</Button></section>
      <section className="panel"><h2><CalendarDays size={21}/>{t('Vuestro ritmo','El vostre ritme','Your rhythm')}</h2><p className="muted">{t('Elige el último día del ciclo de progreso. Se cerrará a medianoche en Europe/Madrid. Los ciclos ya cerrados conservan sus fechas.','Tria l’últim dia del cicle de progrés. Es tancarà a mitjanit a Europe/Madrid. Els cicles tancats mantenen les dates.','Choose the last day of the progress cycle. It closes at midnight in Madrid. Closed cycles keep their dates.')}</p><label>{t('Último día del ciclo','Últim dia del cicle','Last day of the cycle')}<select value={endDay} onChange={e=>void onAction({type:'cycleSettings',endDay:Number(e.target.value)})} disabled={busy}>{weekdays.map((name,index)=><option key={name} value={index}>{name}</option>)}</select></label><p className="muted">{t('Los bonus de misiones siguen contando de lunes a domingo.','Els bonus de missions continuen comptant de dilluns a diumenge.','Mission bonuses still run Monday to Sunday.')}</p></section>
      <section className="panel"><h2><LockKeyhole size={21}/>{t('Acceso familiar','Accés familiar','Family access')}</h2><p className="muted">{t('La gestión parental se bloquea tras 15 minutos.','La gestió parental es bloqueja al cap de 15 minuts.','Parent management locks after 15 minutes.')}</p><Button variant="outline" onClick={onSecurity}>{t('Cambiar contraseña o animales','Canviar contrasenya o animals','Change password or animals')}</Button></section>
      {discoveredCount>0&&<section className="panel secret-progress"><h2><Sparkles size={21}/>{t('Descubrimientos','Descobriments','Discoveries')}</h2><p className="muted">{t('Hay pequeñas sorpresas por el camino. Algunas aparecen haciendo cosas, otras mirando bien.','Hi ha petites sorpreses pel camí. Algunes apareixen fent coses, d’altres mirant bé.','There are small surprises along the way. Some appear by doing, others by looking closely.')}</p><Progress value={Math.min(100,discoveredCount*12)} aria-label={`${discoveredCount} ${t('descubrimientos encontrados','descobriments trobats','discoveries found')}`}/><strong>{discoveredCount} {t('descubrimientos encontrados','descobriments trobats','discoveries found')}</strong></section>}
      <section className="panel"><h2><Download size={21}/>{t('Vuestros datos','Les vostres dades','Your data')}</h2><p className="muted">{t('Exporta el progreso a JSON o restaura una copia anterior. Las contraseñas y sesiones no se incluyen.','Exporta el progrés a JSON o restaura una còpia anterior. No inclou contrasenyes ni sessions.','Export progress as JSON or restore an earlier copy. Passwords and sessions are excluded.')}</p><div className="button-row"><Button variant="outline" disabled={busy} onClick={()=>void onExport()}><Download size={16}/>{t('Exportar copia','Exportar còpia','Export backup')}</Button></div><label>{t('Importar copia exportada','Importar còpia exportada','Import exported backup')}<input type="file" accept=".json,application/json" onChange={e=>void chooseFile(e.target.files?.[0])}/></label>{fileError&&<p role="alert">{fileError}</p>}{backup&&<div className="backup-preview"><p>{t('Copia del','Còpia del','Backup from')} {new Date(backup.exportedAt).toLocaleString(lang==='ca'?'ca-ES':lang==='en'?'en-GB':'es-ES')}</p><p>{backup.data.tasks.length} {t('misiones','missions','missions')} · {backup.data.completions.length} {t('registros','registres','records')}</p><label className="check-label"><Checkbox checked={confirmImport} onCheckedChange={v=>setConfirmImport(v===true)}/>{t('Entiendo que esta copia reemplazará el progreso actual.','Entenc que aquesta còpia substituirà el progrés actual.','I understand this backup will replace current progress.')}</label><Button disabled={busy||!confirmImport} onClick={async()=>{if(await onImport(backup)){setBackup(null);setConfirmImport(false);}}}><Upload size={16}/>{t('Restaurar esta copia','Restaurar aquesta còpia','Restore this backup')}</Button></div>}</section>
    </div>
    <section className="panel settings-danger"><h2><ShieldCheck size={21}/>{t('Correcciones por periodo','Correccions per període','Period corrections')}</h2><p className="muted">{t(`Estas acciones afectan a ${names[child]}. El historial mostrará cada ajuste y los bonus se recalcularán.`,`Aquestes accions afecten ${names[child]}. L’historial mostrarà els ajustos i els bonus es recalcularan.`,`These actions affect ${names[child]}. History will show the adjustments and bonuses will be recalculated.`)}</p><div className="form-grid"><label>{t('Periodo','Període','Period')}<select value={scope} onChange={e=>setScope(e.target.value as Scope)}><option value="day">{t('Día','Dia','Day')}</option><option value="week">{t('Semana','Setmana','Week')}</option><option value="month">{t('Mes','Mes','Month')}</option></select></label><label>{t('Fecha del periodo','Data del període','Period date')}<input type="date" value={day} max={today} onChange={e=>setDay(e.target.value||today)}/></label></div><p>{from} — {to}</p><div className="button-row"><Button variant="outline" disabled={busy||countXp===0} onClick={()=>setPending('bulkResetXp')}><RotateCcw size={16}/>{t(`Restablecer Xp (${countXp} registros)`,`Restablir Xp (${countXp} registres)`,`Reset Xp (${countXp} records)`)}</Button><Button variant="outline" disabled={busy||countChild+countChanges===0} onClick={()=>setPending('undoChildPeriod')}><RotateCcw size={16}/>{t('Deshacer actividad de la niña','Desfer l’activitat de la nena','Undo child activity')}</Button></div><small>{t(`${countChild} misiones registradas por ${names[child]} y ${countChanges} cambios de propuestas o canjes. Los cambios revisados después por padres se respetan.`,`${countChild} missions registrades per ${names[child]} i ${countChanges} canvis en propostes o bescanvis. Les decisions posteriors dels pares es respecten.`,`${countChild} missions recorded by ${names[child]} and ${countChanges} proposal or redemption changes. Later parent decisions are preserved.`)}</small></section>
    <section className="panel settings-danger"><h2><Trash2 size={21}/>{t('Empezar de nuevo','Començar de nou','Start over')}</h2><p className="muted">{t('Restablece misiones, premios, Xp e historial de toda la familia. El acceso familiar se conserva para evitar perder la entrada.','Restableix missions, premis, Xp i historial de tota la família. Es conserva l’accés familiar.','Reset missions, rewards, Xp and history for the whole family. Family access is kept.')}</p><Button variant="outline" onClick={()=>{setCheckOne(false);setCheckTwo(false);setPending('resetAll')}} disabled={busy}><Trash2 size={16}/>{t('Restablecer todo','Restablir-ho tot','Reset everything')}</Button></section>
    <Dialog open={pending!==null} onOpenChange={open=>{if(!open)setPending(null)}}><DialogContent className="xp-dialog"><DialogTitle>{pending==='resetAll'?t('Empezar de nuevo','Començar de nou','Start over'):pending==='bulkResetXp'?t('Restablecer Xp del periodo','Restablir Xp del període','Reset period Xp'):t('Deshacer actividad','Desfer l’activitat','Undo activity')}</DialogTitle><DialogDescription>{pending==='resetAll'?t('Se borrará el progreso familiar de la app.','S’esborrarà el progrés familiar de l’app.','The app’s family progress will be erased.'):`${names[child]} · ${from} — ${to}`}</DialogDescription>{pending==='resetAll'&&<><label className="check-label"><Checkbox checked={checkOne} onCheckedChange={v=>setCheckOne(v===true)}/>{t('He exportado una copia si quiero conservar estos datos.','He exportat una còpia si vull conservar aquestes dades.','I exported a backup if I want to keep this data.')}</label><label className="check-label"><Checkbox checked={checkTwo} onCheckedChange={v=>setCheckTwo(v===true)}/>{t('Entiendo que se reinicia el progreso de las dos niñas.','Entenc que es reinicia el progrés de les dues nenes.','I understand both children’s progress will be reset.')}</label></>}<Button className="primary wide" disabled={busy||(pending==='resetAll'&&(!checkOne||!checkTwo))} onClick={()=>void confirm()}>{t('Confirmar','Confirmar','Confirm')}</Button></DialogContent></Dialog>
  </div>;
}
