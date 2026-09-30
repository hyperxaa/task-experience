'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Trophy, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dateInMadrid, totals, type Child, type Lang, type State } from '@/lib/domain';
import { childrenOf, memberName } from '@/lib/family';
import { dashboardModel, dashboardPeriod, dashboardSummary, weeklyEarningForecast, type DashboardMode, type DashboardPeriod } from '@/lib/family-dashboard';
import { bonusWeek } from '@/lib/weekly-bonuses';
import { addDays, madridInstant } from '@/lib/cycles';
import { useChartZoom } from './use-chart-zoom';
import './family-dashboard.css';

const colors = ['#55c9b7', '#c08be8', '#83a9dd', '#e7ba68', '#e88d9a', '#7fc67a', '#e8945d', '#72b6c9'];
const knownColors: Record<string, string> = { aina: colors[0], iara: colors[1], xavi: colors[2], mireia: colors[3] };
function LineSample({ dash }: { dash?: string }) {
  return <svg className="family-line-sample" viewBox="0 0 88 12" aria-hidden="true"><line x1="2" y1="6" x2="86" y2="6" stroke="currentColor" strokeWidth="3" strokeDasharray={dash}/></svg>;
}

export function FamilyDashboard({ state, lang, parent }: { state: State; lang: Lang; parent: boolean }) {
  const dashboardState=useMemo(()=>state.familyDashboard?{...state,...state.familyDashboard}:state,[state]);
  const [mode, setMode] = useState<DashboardMode>('week');
  const [anchor, setAnchor] = useState(() => Date.now());
  const [hidden, setHidden] = useState<Child[]>([]);
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const [showForecast, setShowForecast] = useState(true);
  const t = (es: string, ca: string, en: string) => lang === 'ca' ? ca : lang === 'en' ? en : es;
  const locale = lang === 'ca' ? 'ca-ES' : lang === 'en' ? 'en-GB' : 'es-ES';
  const number = (value: number) => Math.round(value).toLocaleString(locale);
  const format = (at: number, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Date(at).toLocaleString(locale, { ...options, timeZone: 'Europe/Madrid' });
  const children = childrenOf(state);
  const color = (child: Child) => knownColors[child] ?? colors[children.indexOf(child) % colors.length];
  const style = (child: Child) => ({ '--child-color': color(child) } as CSSProperties);
  const visible = children.filter(child => !hidden.includes(child));
  const model = useMemo(() => {
    const now = new Date().getTime();
    return { ...dashboardModel(dashboardState, childrenOf(state), mode, anchor, now), now };
  }, [dashboardState, state, mode, anchor]);
  const { period, open, now } = model;
  const today = dateInMadrid(new Date(now));
  const currentBonusWeek = bonusWeek(today);
  const weeklyForecasts = mode === 'week' && open && period.start < Date.parse(madridInstant(addDays(currentBonusWeek, 7), '00:00'))
    ? Object.fromEntries(children.map(child => [child, weeklyEarningForecast(dashboardState, child, currentBonusWeek, today, totals(dashboardState, child).balance)]))
    : {};
  const weeklyChartCompatible = mode === 'week' && open && period.start === Date.parse(madridInstant(currentBonusWeek, '00:00')) && period.end === Date.parse(madridInstant(addDays(currentBonusWeek, 7), '00:00'));
  const series = model.series.map(point => {
    const at = Number(point.at);
    if (!weeklyChartCompatible || at < now) return point;
    const fraction = Math.max(0, Math.min(1, (at - now) / Math.max(1, period.end - now)));
    const projected: Record<string, number | null> = { ...point };
    for (const item of model.childrenData) {
      const forecast = weeklyForecasts[item.child];
      if (!forecast) continue;
      const endBase = item.actual.earned + forecast.pendingBase;
      const endX2 = endBase + forecast.possibleTaskBonus;
      const endX5 = item.actual.earned + forecast.pendingBase - forecast.paidTaskBonus + (forecast.superPaid ? 0 : 4 * forecast.superBaseXp);
      projected[`${item.child}NoBonus`] = item.actual.earned + (endBase - item.actual.earned) * fraction;
      projected[`${item.child}X2`] = item.actual.earned + (endX2 - item.actual.earned) * fraction;
      projected[`${item.child}WithBonus`] = forecast.superPossible ? item.actual.earned + (endX5 - item.actual.earned) * fraction : null;
    }
    return projected;
  });
  const stats = model.childrenData.filter(item => visible.includes(item.child));
  const modeNames = { day: t('Día', 'Dia', 'Day'), week: t('Semana', 'Setmana', 'Week'), month: t('Mes', 'Mes', 'Month'), year: t('Año', 'Any', 'Year') };
  const periodLabel = (value: DashboardPeriod, scale: DashboardMode) => {
    if (scale === 'day') return format(value.start, { day: 'numeric', month: 'long', year: 'numeric' });
    if (scale === 'month') return format(value.start, { month: 'long', year: 'numeric' });
    if (scale === 'year') return format(value.start, { year: 'numeric' });
    return format(value.start, { day: 'numeric', month: 'short' }) + ' → '
      + format(value.end, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const tickLabel = (at: number) => mode === 'day'
    ? at === period.end ? '24:00' : format(at, { hour: '2-digit', minute: '2-digit' })
    : mode === 'year' ? format(at, { month: 'short' }) : format(at, { day: 'numeric', month: 'short' });
  const ticks = series.filter((point, index) => point.at !== now && (mode === 'year'
    ? Number(point.at) < period.end && new Date(Number(point.at)).toLocaleString('en-CA', { day: '2-digit', timeZone: 'Europe/Madrid' }) === '01'
    : index === 0 || index === series.length - 1 || (mode === 'day' ? index % 3 === 0 : mode === 'week' ? true : index % 5 === 0))).map(point => Number(point.at));
  const recent = (['day', 'week', 'month', 'year'] as DashboardMode[]).map(scale => {
    const current = dashboardPeriod(dashboardState, scale, now);
    return { scale, period: dashboardPeriod(dashboardState, scale, current.start - 1) };
  });
  const realLabel = t('Real', 'Real', 'Actual');
  const plainLabel = t('Sin nuevos bonus', 'Sense nous bonus', 'No new bonuses');
  const x2Label = t('Con bonus ×2', 'Amb bonus ×2', 'With ×2 bonuses');
  const bonusLabel = t('Con superbonus ×5', 'Amb superbonus ×5', 'With ×5 super bonus');
  const hasForecast = (child: Child, estimate: number | null) => estimate !== null || (mode === 'week' && weeklyChartCompatible && !!weeklyForecasts[child]);
  // Keep one Xp scale for the whole period, even when a child's lines are hidden.
  const chartKeys = model.childrenData.flatMap(({ child, estimate }) => [
    `${child}Actual`,
    ...(open && showForecast && hasForecast(child, estimate) ? [
      `${child}NoBonus`,
      ...(weeklyChartCompatible ? [`${child}X2`] : []),
      ...(mode !== 'week' || weeklyForecasts[child]?.superPossible ? [`${child}WithBonus`] : []),
    ] : []),
  ]);
  let chartMax = 0;
  for (const point of series) for (const key of chartKeys) {
    const value = point[key];
    if (typeof value === 'number' && Number.isFinite(value)) chartMax = Math.max(chartMax, value);
  }
  const chartCeiling = Math.max(10, Math.ceil(chartMax * 1.05));
  const { chartRef, view: chartView, zoomed, zoomBy, reset, onMouseDown, onMouseMove, onMouseUp } = useChartZoom(
    { start: period.start, end: period.end, ceiling: chartCeiling }, mode, visible.length > 0,
  );
  const chartTicks = zoomed
    ? Array.from({ length: 5 }, (_, index) => chartView.xStart + (chartView.xEnd - chartView.xStart) * index / 4)
    : ticks;
  const chartSpan = chartView.xEnd - chartView.xStart;
  const chartTickLabel = (at: number) => {
    if (mode === 'week') {
      const label = tickLabel(at);
      return chartTicks.some(tick => tick < at && tickLabel(tick) === label) ? '' : label;
    }
    if (mode === 'year') {
      if (!zoomed || chartSpan >= 45 * 86_400_000) return tickLabel(at);
      if (chartSpan >= 2 * 86_400_000) return format(at, { day: 'numeric', month: 'short' });
    }
    if (mode !== 'day' && chartSpan < 10 * 86_400_000)
      return format(at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return tickLabel(at);
  };
  const seriesKey = (child: Child, kind: 'actual' | 'plain' | 'x2' | 'bonus') => JSON.stringify([child, kind]);
  const isSeriesVisible = (child: Child, kind: 'actual' | 'plain' | 'x2' | 'bonus') => !hiddenSeries.includes(seriesKey(child, kind));
  const toggleSeries = (child: Child, kind: 'actual' | 'plain' | 'x2' | 'bonus') => {
    const key = seriesKey(child, kind);
    setHiddenSeries(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  };
  const isChildChartVisible = (child: Child) => !(['actual', 'plain', 'x2', 'bonus'] as const).every(kind => !isSeriesVisible(child, kind));
  const toggleChildChart = (child: Child) => {
    const keys = (['actual', 'plain', 'x2', 'bonus'] as const).map(kind => seriesKey(child, kind));
    setHiddenSeries(current => {
      const visible = keys.some(key => !current.includes(key));
      return visible ? [...new Set([...current, ...keys])] : current.filter(key => !keys.includes(key));
    });
  };
  const balancePair = (current: number, ceiling: number) => <>{number(current)} <i>Xp</i><span className="family-week-ceiling">/ {number(ceiling)} Xp</span></>;

  return <div className="family-dashboard">
    <section className="panel family-dashboard-head">
      <div><span className="eyebrow">{t('PANEL FAMILIAR', 'PANELL FAMILIAR', 'FAMILY DASHBOARD')}</span><h2>{t('Su ritmo. Vuestras decisiones.', 'El seu ritme. Les vostres decisions.', 'Their pace. Your decisions.')}</h2><p>{t('Compara lo ganado, revisa los canjes y ajusta los premios con datos reales.', 'Compara els guanys, revisa els bescanvis i ajusta els premis amb dades reals.', 'Compare earnings, review redemptions and set rewards using real data.')}</p></div>
      <div className="family-child-filters" aria-label={t('Personas visibles', 'Persones visibles', 'Visible children')}>
        {children.map(child => <button type="button" key={child} aria-pressed={visible.includes(child)} className={visible.includes(child) ? 'active' : ''} style={style(child)} onClick={() => setHidden(items => items.includes(child) ? items.filter(item => item !== child) : [...items, child])}><i/>{memberName(state, child)}</button>)}
      </div>
    </section>
    <section className="family-period-toolbar">
      <div className="period-toggle" aria-label={t('Escala', 'Escala', 'Time scale')}>{(Object.keys(modeNames) as DashboardMode[]).map(scale => <button key={scale} aria-pressed={mode === scale} className={mode === scale ? 'active' : ''} onClick={() => { setMode(scale); setAnchor(Math.min(anchor, now)); }}>{modeNames[scale]}</button>)}</div>
      <div className="period-nav">
        <Button variant="outline" aria-label={t('Periodo anterior', 'Període anterior', 'Previous period')} onClick={() => setAnchor(period.start - 1)}><ChevronLeft size={18}/></Button>
        <strong>{periodLabel(period, mode)}<small>{open ? t('En curso', 'En curs', 'In progress') : t('Periodo cerrado', 'Període tancat', 'Closed period')}</small></strong>
        <Button variant="outline" disabled={open} aria-label={t('Periodo siguiente', 'Període següent', 'Next period')} onClick={() => setAnchor(period.end)}><ChevronRight size={18}/></Button>
      </div>
      {!open && <button className="family-return" onClick={() => setAnchor(Date.now())}>{t('Volver al actual', 'Tornar a l’actual', 'Back to current')}</button>}
    </section>
    <p className="family-context-note">{open
      ? t('Comparación: el mismo tiempo transcurrido del periodo anterior, hasta su cierre.', 'Comparació: el mateix temps transcorregut del període anterior, fins al seu tancament.', 'Comparison: the same elapsed time in the previous period, capped at its end.')
      : t('Comparación entre periodos completos. Las correcciones posteriores actualizan el historial.', 'Comparació entre períodes complets. Les correccions posteriors actualitzen l’historial.', 'Comparing full periods. Later corrections update the history.')}
      {mode === 'week' && <> {t('Se respeta la hora de cierre de Vuestro ritmo. Los bonus siguen de lunes a domingo.', 'Es respecta l’hora de tancament d’El vostre ritme. Els bonus segueixen de dilluns a diumenge.', 'Your rhythm’s closing time applies. Bonuses still run Monday to Sunday.')}</>}
    </p>
    <section className="family-stat-grid">
      {stats.map(item => <article className="panel family-child-stat" key={item.child} style={style(item.child)}>
        <div className="family-stat-title"><i className="family-color-dot"/><h3>{memberName(state, item.child)}</h3></div>
        <div className="family-stat-numbers"><div><small>{t('Ganados en este periodo', 'Guanyats en aquest període', 'Earned in this period')}</small><strong>{number(item.actual.earned)} <i>Xp</i></strong></div><span className="family-delta">{item.delta > 0 ? '+' : ''}{number(item.delta)} Xp<small>{t('respecto al anterior', 'respecte a l’anterior', 'vs previous')}</small></span></div>
        <dl className="family-breakdown">
          <div><dt>{t('Misiones', 'Missions', 'Missions')}</dt><dd className="xp-mission">{number(item.actual.mission)} Xp</dd></div>
          <div><dt>Bonus</dt><dd className="xp-bonus">{number(item.actual.bonus)} Xp</dd></div>
          <div><dt>{t('Easter eggs', 'Easter eggs', 'Easter eggs')}</dt><dd className="xp-discovery">{number(item.actual.discovery)} Xp</dd></div>
          <div><dt>{t('Canjeados / reservados', 'Bescanviats / reservats', 'Spent / reserved')}</dt><dd>{number(item.actual.spent)} Xp</dd></div>
        </dl>
        <div className="family-stat-foot"><span>{item.actual.completions} {t('misiones hechas', 'missions fetes', 'mission completions')} · {item.actual.activeDays} {t('días con actividad', 'dies amb activitat', 'active days')}</span><span>{t('Saldo disponible ahora', 'Saldo disponible ara', 'Available balance now')}<b>{number(totals(dashboardState, item.child).balance)} Xp</b></span></div>
        {open && mode!=='week' && <div className="family-forecast">
          <h4>{t('Al cierre: saldo actual + lo que falta por ganar', 'En tancar: saldo actual + el que falta guanyar', 'At close: current balance + what remains to earn')}</h4>
          {item.estimate === null ? <p>{t('Aún no hay un día completo de datos para estimar.', 'Encara no hi ha un dia complet de dades per estimar.', 'A full day of history is needed for an estimate.')}</p> : <>
            <div><span>{plainLabel}</span><strong>{number(totals(dashboardState, item.child).balance + item.estimate - item.actual.earned)} Xp</strong></div>
            <div><span>{t('Proyección ×5 orientativa', 'Projecció ×5 orientativa', 'Indicative ×5 projection')}</span><strong>{number(totals(dashboardState, item.child).balance + item.estimateWithBonus! - item.actual.earned)} Xp</strong></div>
            <p>{t('Parte del saldo que ya tienes y suma solo lo que podrías ganar desde ahora.', 'Parteix del saldo que ja tens i suma només el que podries guanyar a partir d’ara.', 'Starts with the balance you have and adds only what you could earn from now on.')} {t('Media de misiones:', 'Mitjana de missions:', 'Mission average:')} {item.pace.daily!.toLocaleString(locale, { maximumFractionDigits: 1 })} Xp/{t('día', 'dia', 'day')} · {item.pace.days} {t('días observados', 'dies observats', 'observed days')}.{item.pace.days < 7 && <> {t('Pocos datos: úsalo solo como orientación.', 'Poques dades: només és orientatiu.', 'Limited history: use as guidance only.')}</>}</p>
          </>}
        </div>}
        {weeklyForecasts[item.child] && <div className="family-week-outlook">
          <h4>{parent ? t('Previsión de saldo para esta semana', 'Previsió de saldo per a aquesta setmana', 'Balance outlook for this week') : t('Lo que aún podéis ganar esta semana', 'El que encara podeu guanyar aquesta setmana', 'What you can still earn this week')}</h4>
          <p>{parent
            ? t('Cada cifra muestra el saldo estimado al cierre / el máximo teórico de la semana. Los bonus ×2 se calculan por misión; el ×5 solo cuenta si todas las misiones son alcanzables.', 'Cada xifra mostra el saldo estimat en tancar / el màxim teòric de la setmana. Els bonus ×2 es calculen per missió; el ×5 només compta si totes les missions són assolibles.', 'Each figure shows the estimated closing balance / the week’s theoretical maximum. ×2 bonuses are calculated per mission; ×5 counts only while every mission remains achievable.')
            : t('Cada misión tiene sus días. Si pasa un día sin hacerla, pierdes el bonus ×2 de esa misión. Para el ×5 hay que completar todas.', 'Cada missió té els seus dies. Si passa un dia sense fer-la, perds el bonus ×2 d’aquella missió. Per aconseguir el ×5 cal completar-les totes.', 'Each mission has its own days. Miss one and you lose that mission’s ×2 bonus. To get ×5, complete every mission.')}</p>
          <div><span>{t('Sin nuevos bonus', 'Sense nous bonus', 'No new bonuses')}</span><strong>{balancePair(weeklyForecasts[item.child].noBonusTotal, weeklyForecasts[item.child].noBonusCeiling)}</strong></div>
          <div><span>{parent ? t('Con los bonus ×2 que aún puede conseguir', 'Amb els bonus ×2 que encara pot aconseguir', 'With the ×2 bonuses still achievable') : t('Si se ganan los bonus ×2 posibles', 'Si s’aconsegueixen els bonus ×2 possibles', 'If all possible ×2 bonuses are earned')}</span><strong>{balancePair(weeklyForecasts[item.child].x2Total, weeklyForecasts[item.child].x2Ceiling)}</strong></div>
          <div><span>{parent ? t('Con el superbonus ×5', 'Amb el superbonus ×5', 'With the ×5 super bonus') : t('Si se completa toda la semana ×5', 'Si es completa tota la setmana ×5', 'If the full week is completed ×5')}</span><strong className={!weeklyForecasts[item.child].superPossible?'unreachable':''}>{!weeklyForecasts[item.child].superPossible&&<s>{balancePair(weeklyForecasts[item.child].x5Total, weeklyForecasts[item.child].x5Ceiling)}</s>}{weeklyForecasts[item.child].superPossible&&balancePair(weeklyForecasts[item.child].x5Total, weeklyForecasts[item.child].x5Ceiling)}</strong></div>
          <small>{number(weeklyForecasts[item.child].superBaseXp)} Xp {t('de misiones ×5; sustituye los bonus ×2 ya sumados.', 'de missions ×5; substitueix els bonus ×2 ja sumats.', 'from missions ×5; replaces ×2 bonuses already counted.')}</small>
          {!weeklyForecasts[item.child].superPossible&&<p className="family-impossible-note">{t('Esta semana ya no se puede llegar al ×5.', 'Aquesta setmana ja no es pot arribar al ×5.', 'The ×5 bonus is no longer reachable this week.')}</p>}
          {weeklyForecasts[item.child].lostTaskBonus>0&&<p>{t('Bonus ×2 que ya no se pueden ganar:', 'Bonus ×2 que ja no es poden guanyar:', '×2 bonuses no longer available:')} −{number(weeklyForecasts[item.child].lostTaskBonus)} Xp</p>}
          <p>{t('Precios orientativos con el saldo actual incluido', 'Preus orientatius amb el saldo actual inclòs', 'Suggested reward prices, including current balance')}: {t('pequeño', 'petit', 'small')} {number(totals(dashboardState,item.child).balance+weeklyForecasts[item.child].recommendation.small)} · {t('mediano', 'mitjà', 'medium')} {number(totals(dashboardState,item.child).balance+weeklyForecasts[item.child].recommendation.medium)} · {t('grande', 'gran', 'large')} {number(totals(dashboardState,item.child).balance+weeklyForecasts[item.child].recommendation.large)} Xp</p>
        </div>}
      </article>)}
    </section>
    <section className="panel family-chart-panel">
      <div className="family-chart-heading"><div><h2><Trophy size={21}/>{t('Cómo crecen los Xp', 'Com creixen els Xp', 'How Xp grows')}</h2><p>{t('Acumulados desde el inicio del periodo. Los canjes no restan en esta gráfica.', 'Acumulats des de l’inici del període. Els bescanvis no resten en aquesta gràfica.', 'Cumulative earnings since this period began. Redemptions do not reduce this chart.')}</p></div><div className="family-chart-actions">{open && <button type="button" className="family-forecast-toggle" aria-pressed={showForecast} onClick={() => setShowForecast(value => !value)}>{showForecast ? t('Ocultar previsiones', 'Amagar previsions', 'Hide forecasts') : t('Mostrar previsiones', 'Mostrar previsions', 'Show forecasts')}</button>}<div className="family-chart-zoom-controls" role="group" aria-label={t('Zoom de la gráfica', 'Zoom de la gràfica', 'Chart zoom')}><button type="button" aria-label={t('Ampliar gráfica', 'Ampliar gràfica', 'Zoom in')} disabled={!visible.length} onClick={() => zoomBy(.75)}><ZoomIn size={17}/></button><button type="button" aria-label={t('Reducir gráfica', 'Reduir gràfica', 'Zoom out')} disabled={!zoomed || !visible.length} onClick={() => zoomBy(1.35)}><ZoomOut size={17}/></button><button type="button" disabled={!zoomed} onClick={reset}><RotateCcw size={15}/>{t('Ver todo', 'Veure-ho tot', 'Show all')}</button></div></div></div>
      {!visible.length ? <p className="family-empty">{t('Activa al menos una persona para ver sus datos.', 'Activa almenys una persona per veure les seves dades.', 'Select at least one child to see their data.')}</p> : <>
        <div className={`family-chart${zoomed ? ' zoomed' : ''}`} ref={chartRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 22, right: 24, left: 0, bottom: 8 }} accessibilityLayer>
          <CartesianGrid stroke="#ffffff12" vertical={false}/>
          <XAxis dataKey="at" type="number" domain={[chartView.xStart, chartView.xEnd]} allowDataOverflow ticks={chartTicks} tickFormatter={chartTickLabel} tick={{ fill: '#bac7d8', fontSize: 12 }} minTickGap={28} axisLine={false} tickLine={false}/>
          <YAxis tickFormatter={number} tick={{ fill: '#bac7d8', fontSize: 12 }} axisLine={false} tickLine={false} width={64} allowDecimals={false} domain={[chartView.yStart, chartView.yEnd]} allowDataOverflow/>
          <Tooltip contentStyle={{ background: '#171e2b', border: '1px solid #526078', borderRadius: 12, color: '#f2f5fa', fontSize: 13 }} labelFormatter={value => format(Number(value), { dateStyle: 'medium', timeStyle: 'short' })} formatter={(value, name) => [number(Number(value ?? 0)) + ' Xp', String(name)]}/>
          {open && <ReferenceLine x={now} stroke="#abb8ce" strokeDasharray="3 4" label={{ value: t('Ahora', 'Ara', 'Now'), position: 'top', fill: '#bac7d8', fontSize: 11 }}/>}
          {stats.flatMap(item => {
            const child = item.child, name = memberName(state, child);
            return [
              ...(isSeriesVisible(child, 'actual') ? [<Line key={child + '-actual'} type="monotone" dataKey={child + 'Actual'} name={name + ' · ' + realLabel} stroke={color(child)} strokeWidth={3} dot={false} activeDot={{ r: 4 }} isAnimationActive={false}/>] : []),
              ...(open && showForecast && hasForecast(child, item.estimate) ? [
                ...(isSeriesVisible(child, 'plain') ? [<Line key={child + '-plain'} type="monotone" dataKey={child + 'NoBonus'} name={name + ' · ' + plainLabel} stroke={color(child)} strokeWidth={2.5} strokeDasharray="12 8" dot={false} activeDot={{ r: 4 }} isAnimationActive={false}/>] : []),
                ...(weeklyChartCompatible && isSeriesVisible(child, 'x2') ? [<Line key={child + '-x2'} type="monotone" dataKey={child + 'X2'} name={name + ' · ' + x2Label} stroke={color(child)} strokeWidth={2.5} strokeDasharray="7 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={false}/>] : []),
                ...((mode !== 'week' || weeklyForecasts[child]?.superPossible) && isSeriesVisible(child, 'bonus') ? [<Line key={child + '-bonus'} type="monotone" dataKey={child + 'WithBonus'} name={name + ' · ' + bonusLabel} stroke={color(child)} strokeWidth={2.5} strokeDasharray="2 6" dot={false} activeDot={{ r: 4 }} isAnimationActive={false}/>] : []),
              ] : []),
            ];
          })}
        </LineChart></ResponsiveContainer></div>
        <p className="family-chart-zoom-hint">{zoomed
          ? t('Arrastra para mover · rueda o pellizca para ajustar el zoom.', 'Arrossega per moure · roda o pessiga per ajustar el zoom.', 'Drag to move · use the wheel or pinch to adjust zoom.')
          : t('Rueda del ratón o pellizco con dos dedos para ampliar.', 'Roda del ratolí o pessic amb dos dits per ampliar.', 'Mouse wheel or two-finger pinch to zoom.')}</p>
        <div className="family-chart-legend" aria-label={t('Leyenda de líneas', 'Llegenda de línies', 'Line legend')}>
          {stats.map(item => <div className="family-legend-child" key={item.child} style={style(item.child)}>
            <button type="button" className={`family-legend-child-toggle${!isChildChartVisible(item.child) ? ' inactive' : ''}`} aria-pressed={isChildChartVisible(item.child)} onClick={() => toggleChildChart(item.child)}><LineSample/>{memberName(state, item.child)}</button>
            <button type="button" className={!isSeriesVisible(item.child, 'actual') ? 'inactive' : ''} aria-pressed={isSeriesVisible(item.child, 'actual')} onClick={() => toggleSeries(item.child, 'actual')}><LineSample/>{realLabel}</button>
            {open && showForecast && hasForecast(item.child, item.estimate) && <>
              <button type="button" className={!isSeriesVisible(item.child, 'plain') ? 'inactive' : ''} aria-pressed={isSeriesVisible(item.child, 'plain')} onClick={() => toggleSeries(item.child, 'plain')}><LineSample dash="12 8"/>{plainLabel}</button>
              {weeklyChartCompatible && <button type="button" className={!isSeriesVisible(item.child, 'x2') ? 'inactive' : ''} aria-pressed={isSeriesVisible(item.child, 'x2')} onClick={() => toggleSeries(item.child, 'x2')}><LineSample dash="7 5"/>{x2Label}</button>}
              {(mode !== 'week' || weeklyForecasts[item.child]?.superPossible) && <button type="button" className={!isSeriesVisible(item.child, 'bonus') ? 'inactive' : ''} aria-pressed={isSeriesVisible(item.child, 'bonus')} onClick={() => toggleSeries(item.child, 'bonus')}><LineSample dash="2 6"/>{bonusLabel}</button>}
            </>}
          </div>)}
        </div>
      </>}
      {open && <details className="family-method"><summary>{t('Cómo leer las previsiones', 'Com llegir les previsions', 'Reading the forecasts')}</summary><p>{t('El saldo al cierre parte del saldo disponible ahora y suma solo lo que falta ganar. La media usa hasta 28 días completos, incluidos los días sin actividad; no anticipa Easter eggs ni canjes futuros. Las cifras de bonus semanal son cálculos exactos según las misiones y los días que quedan.', 'El saldo en tancar parteix del saldo disponible ara i suma només el que falta guanyar. La mitjana usa fins a 28 dies complets, inclosos els dies sense activitat; no anticipa Easter eggs ni bescanvis futurs. Les xifres de bonus setmanal són càlculs exactes segons les missions i els dies que queden.', 'The closing balance starts with the current available balance and adds only what remains to earn. The pace uses up to 28 full days, including inactive days; it does not forecast Easter eggs or future redemptions. Weekly bonus figures are calculated from missions and remaining assigned days.')}</p></details>}
    </section>
    <section className="panel family-closing-panel"><h2><CalendarDays size={21}/>{t('Últimos cierres', 'Últims tancaments', 'Recent closed periods')}</h2><p>{t('Abre un cierre para revisar su detalle. Las cifras incluyen las correcciones posteriores.', 'Obre un tancament per revisar-ne el detall. Les xifres inclouen les correccions posteriors.', 'Open a closed period to review it. Figures include later corrections.')}</p><div className="family-closing-grid">
      {recent.map(item => <button key={item.scale} onClick={() => { setMode(item.scale); setAnchor(item.period.start); }}><strong>{modeNames[item.scale]} <ChevronRight size={16}/></strong><small>{periodLabel(item.period, item.scale)}</small>{visible.map(child => <span key={child} style={style(child)}><i/>{memberName(state, child)}<b>{number(dashboardSummary(dashboardState, child, item.period).earned)} Xp</b></span>)}</button>)}
    </div></section>
  </div>;
}
