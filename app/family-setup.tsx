'use client';

import { Button } from '@/components/ui/button';
import type { Lang } from '@/lib/domain';

type Draft = { name: string; role: 'adult' | 'child' };

export function FamilySetup({ lang, mode, onMode, members, onMembers }: {
  lang: Lang;
  mode: 'demo' | 'custom';
  onMode: (mode: 'demo' | 'custom') => void;
  members: Draft[];
  onMembers: (members: Draft[]) => void;
}) {
  const t = (es: string, ca: string, en: string) => lang === 'ca' ? ca : lang === 'en' ? en : es;
  const add = (role: Draft['role']) => onMembers([...members, { name: '', role }]);
  return <div className="family-setup">
    <fieldset>
      <legend>{t('Elegid vuestra familia', 'Trieu la vostra família', 'Choose your family')}</legend>
      <div className="setup-modes">
        <button type="button" aria-pressed={mode === 'demo'} className={mode === 'demo' ? 'selected' : ''} onClick={() => onMode('demo')}>
          <strong>{t('Modo demo', 'Mode demo', 'Demo mode')}</strong>
          <span>Xavi · Mireia · Aina · Iara</span>
        </button>
        <button type="button" aria-pressed={mode === 'custom'} className={mode === 'custom' ? 'selected' : ''} onClick={() => onMode('custom')}>
          <strong>{t('Modo personalizado', 'Mode personalitzat', 'Custom mode')}</strong>
          <span>{t('Poned los nombres de vuestra familia.', 'Poseu els noms de la vostra família.', 'Add your family members.')}</span>
        </button>
      </div>
    </fieldset>
    {mode === 'custom' && <fieldset>
      <legend>{t('Adultos e hijos', 'Adults i fills', 'Adults and children')}</legend>
      <p className="muted">{t('Cada adulto puede gestionar el espacio. Cada hijo tiene sus propios Xp.', 'Cada adult pot gestionar l’espai. Cada fill té els seus propis Xp.', 'Each adult can manage the space. Each child has their own Xp.')}</p>
      {members.map((member, index) => <div className="setup-member" key={index}>
        <label>{member.role === 'adult' ? t('Adulto responsable', 'Adult responsable', 'Adult') : t('Hijo o hija', 'Fill o filla', 'Child')}
          <input required maxLength={40} value={member.name} onChange={event => onMembers(members.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} />
        </label>
        {members.filter(item => item.role === member.role).length > 1 && <button type="button" className="text-button" onClick={() => onMembers(members.filter((_, position) => position !== index))}>{t('Quitar', 'Treure', 'Remove')}</button>}
      </div>)}
      {members.length < 12 && <div className="button-row">
        <Button type="button" variant="outline" onClick={() => add('adult')}>{t('Añadir adulto', 'Afegir adult', 'Add adult')}</Button>
        <Button type="button" variant="outline" onClick={() => add('child')}>{t('Añadir hijo/a', 'Afegir fill/a', 'Add child')}</Button>
      </div>}
    </fieldset>}
  </div>;
}
