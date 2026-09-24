'use client';

import Image from 'next/image';
import { Sparkles, X, Gift } from 'lucide-react';
import { words, type Lang, type Reward } from '@/lib/domain';
import type { WeeklyBonus } from '@/lib/weekly-bonuses';

export function BonusCelebration({ bonuses, lang, reward, balance, onClose, onRedeem }: {
  bonuses: WeeklyBonus[]; lang: Lang; reward?: Reward; balance: number;
  onClose: () => void; onRedeem: () => void;
}) {
  const t = (es: string, ca: string, en: string) => lang === 'ca' ? ca : lang === 'en' ? en : es;
  const superBonus = bonuses.find(b => b.kind === 'super');
  const xp = bonuses.reduce((sum, b) => sum + b.xp, 0);
  const ready = reward && balance >= reward.xp;
  return <div className={`bonus-celebration ${superBonus ? 'is-super' : 'is-silver'}`} role="dialog" aria-modal="true" aria-label={t('Celebración de bonus', 'Celebració de bonus', 'Bonus celebration')}>
    <div className="bonus-backdrop" onClick={onClose}/>
    <div className="bonus-confetti" aria-hidden="true">{Array.from({length:48},(_,i)=><i key={i} style={{'--i':i,'--delay':`${(i%9)*0.07}s`,'--angle':`${(i*137.5)%360}deg`} as React.CSSProperties}/>)}</div>
    <section className="bonus-stage">
      <button className="bonus-close" aria-label={t('Cerrar celebración','Tancar celebració','Close celebration')} onClick={onClose}><X size={23}/></button>
      <div className="bonus-trophy"><Image src="/task-experience-emoji.png" alt="Task eXperience" width={208} height={208}/></div>
      <span className="bonus-kicker"><Sparkles size={16}/>{superBonus ? t('SEMANA PERFECTA','SETMANA PERFECTA','PERFECT WEEK') : t('BONUS DE MISIÓN','BONUS DE MISSIÓ','MISSION BONUS')}</span>
      <h2>{superBonus ? t('¡Superbonus ×5!','Superbonus ×5!','Super bonus ×5!') : t('¡Lo has conseguido!','Ho has aconseguit!','You did it!')}</h2>
      <p>{superBonus ? t('Todas las misiones de la semana, hechas.','Totes les missions de la setmana, fetes.','Every mission this week is done.') : bonuses.map(b=>words(b.title,lang)).join(' · ')}</p>
      <strong className="bonus-total">+{xp} <small>XP {t('extra','extra','extra')}</small></strong>
      {superBonus && reward && <div className="bonus-prize"><Gift size={21}/><span><b>{words(reward.title,lang)}</b><small>{reward.xp} XP · {ready?t('Ya está a tu alcance','Ja és al teu abast','Ready to request'):`${Math.max(0,reward.xp-balance)} XP ${t('para llegar','per arribar','to go')}`}</small></span></div>}
      {superBonus && reward && ready && <button className="bonus-redeem" onClick={onRedeem}>{t(`Solicitar por ${reward.xp} XP`,`Demanar per ${reward.xp} XP`,`Request for ${reward.xp} XP`)}</button>}
      <button className="bonus-continue" onClick={onClose}>{t('Seguir jugando','Continuar jugant','Keep playing')}</button>
    </section>
  </div>;
}
