import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { t } from '../i18n';
import { Icon } from './Icon';
import { lockNutritionScroll } from '../nutritionScrollLock';

export function NutritionModal({ title, subtitle, children, onClose, busy = false }: {title:string; subtitle?:string; children:ReactNode; onClose:()=>void; busy?:boolean}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const closeRef = useRef({onClose,busy});
  closeRef.current = {onClose,busy};
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockNutritionScroll();
    ref.current?.focus({preventScroll:true});
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeRef.current.busy) closeRef.current.onClose();
      if (event.key !== 'Tab') return;
      const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) {event.preventDefault(); return;}
      if (!ref.current?.contains(document.activeElement)) {event.preventDefault();first.focus();return;}
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keydown);
    return () => {document.removeEventListener('keydown',keydown);unlock();if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return createPortal(<div className="nutri-overlay" onClick={() => {if (!busy) onClose();}}>
    <section className="nutri-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1} onClick={event=>event.stopPropagation()}>
      <div className="nutri-sheet-handle"/><header className="nutri-sheet-header"><div>{subtitle && <p className="eyebrow">{subtitle}</p>}<h2 id={titleId}>{title}</h2></div><button className="nutri-icon-button" type="button" aria-label={t('Fermer')} onClick={onClose} disabled={busy}><Icon name="close" size={18}/></button></header>
      {children}
    </section>
  </div>,document.body);
}
