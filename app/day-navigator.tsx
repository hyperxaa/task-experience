'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftDay, weekBeginning, type Completion, type Lang } from '@/lib/domain';
import { bonusWeek, type WeeklyBonus } from '@/lib/weekly-bonuses';

function label(day: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, options);
}

export function DayNavigator({ day, today, lang, completions, bonuses = [], onChange }: {
  day: string;
  today: string;
  lang: Lang;
  completions: Completion[];
  bonuses?: WeeklyBonus[];
  onChange: (day: string) => void;
}) {
  const locale = lang === 'ca' ? 'ca-ES' : lang === 'en' ? 'en-GB' : 'es-ES';
  const t = (es: string, ca: string, en: string) => lang === 'ca' ? ca : lang === 'en' ? en : es;
  const earliest = shiftDay(today, -31);
  const windowStart = weekBeginning(day);
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(windowStart, index));

  return <div className="day-navigator" aria-label={t('Elegir día para gestionar', 'Triar el dia per gestionar', 'Choose a day to manage')}>
    <div className="day-navigator-toolbar">
      <button className="icon-action" type="button" aria-label={t('Día anterior', 'Dia anterior', 'Previous day')} disabled={day <= earliest} onClick={() => onChange(shiftDay(day, -1))}><ChevronLeft size={20}/></button>
      <strong>{label(day, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
      <button className="icon-action" type="button" aria-label={t('Día siguiente', 'Dia següent', 'Next day')} disabled={day >= today} onClick={() => onChange(shiftDay(day, 1))}><ChevronRight size={20}/></button>
      {day !== today && <button className="day-today-button" type="button" onClick={() => onChange(today)}>{t('Hoy', 'Avui', 'Today')}</button>}
      <label className="day-calendar-input" title={t('Abrir calendario', 'Obrir calendari', 'Open calendar')}>
        <CalendarDays size={18}/>
        <input aria-label={t('Elegir fecha', 'Triar data', 'Choose date')} type="date" min={earliest} max={today} value={day} onChange={(event) => onChange(event.target.value || today)}/>
      </label>
    </div>
    <div className="day-navigator-strip" role="group" aria-label={t('Días cercanos', 'Dies propers', 'Nearby days')}>
      {days.map((date) => {
        const count = completions.filter((completion) => completion.day === date && !completion.reversed).length;
        const weekAwards = bonuses.filter(bonus => bonus.week === bonusWeek(date));
        const mark = weekAwards.some(bonus => bonus.kind === 'super') ? 'super' : weekAwards.some(bonus => completions.some(completion => completion.day === date && completion.taskId === bonus.taskId && !completion.reversed)) ? 'silver' : '';
        const markLabel = mark === 'super' ? t(' · superbonus x5', ' · superbonus x5', ' · super bonus x5') : mark === 'silver' ? t(' · bonus x2', ' · bonus x2', ' · bonus x2') : '';
        return <button key={date} type="button" disabled={date < earliest || date > today} className={`day-navigator-option ${day === date ? 'active' : ''} ${today === date ? 'today' : ''} ${mark ? `bonus-${mark}` : ''}`} aria-pressed={day === date} aria-label={`${label(date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}${today === date ? ` · ${t('hoy', 'avui', 'today')}` : ''}${markLabel}`} title={markLabel.trim()} onClick={() => onChange(date)}>
          <span>{label(date, locale, { weekday: 'short' })}</span>
          <strong>{label(date, locale, { day: 'numeric' })}</strong>
          <small>{count ? `${count} ${t('hechas', 'fetes', 'done')}` : today === date ? t('Hoy', 'Avui', 'Today') : '·'}</small>
        </button>;
      })}
    </div>
  </div>;
}
