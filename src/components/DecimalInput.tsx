import { useLayoutEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { t } from '../i18n';

// A text field keeps the separator while typing, even when its parent stores
// a number. Native number fields can discard commas before React receives them.
export function DecimalInput({ value, onChange, onBlur, min, max, step: _step, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'defaultValue'>) {
  const [raw, setRaw] = useState(String(value ?? ''));
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { setRaw(String(value ?? '')); }, [value]);
  useLayoutEffect(() => {
    const number = Number(raw);
    const valid = raw === '' || (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) && Number.isFinite(number) && (min === undefined || number >= Number(min)) && (max === undefined || number <= Number(max)));
    ref.current?.setCustomValidity(valid ? '' : t('Vérifie les informations saisies.'));
  }, [raw, min, max]);
  return <input {...props} ref={ref} type="text" inputMode="decimal" value={raw} onChange={event => {
    event.target.value = event.target.value.replace(/,/g, '.');
    setRaw(event.target.value);
    onChange?.(event);
  }} onBlur={event => {
    if (!event.currentTarget.validity.valid) { event.currentTarget.reportValidity(); return; }
    onBlur?.(event);
  }} />;
}
