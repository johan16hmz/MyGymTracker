import { useEffect, useRef, useState } from 'react';
import { STRENGTH_EXERCISES } from '../strength';
import { localDate } from '../nutrition';
import { validateTestedMax } from '../testedMaxes';
import type { TestedMax } from '../testedMaxes';
import { t, useLanguage, useWeightUnit } from '../i18n';
import { convertWeightInput, parseDecimalInput, toDisplayWeight, toStoredWeight } from '../weightUnits';
import { DecimalInput } from './DecimalInput';
import { NutritionModal } from './NutritionModal';
import '../nutrition.css';
import '../training.css';

export function TestedMaxForm({ initial, exercises, selectedId, onSave, onRemove, onClose }: {
  initial?: TestedMax; exercises: { id: string; name: string; weighted: boolean }[]; selectedId?: string;
  onSave: (value: TestedMax) => Promise<void>; onRemove?: (id: string) => Promise<void>; onClose: () => void;
}) {
  useLanguage();
  const unit = useWeightUnit();
  const options = [...new Map([...STRENGTH_EXERCISES, ...exercises].map(item => [item.id, item])).values()];
  const [id] = useState<string>(() => initial?.id ?? crypto.randomUUID());
  const [exerciseId, setExerciseId] = useState(initial?.exerciseId ?? (options.some(item => item.id === selectedId) ? selectedId! : options[0].id));
  const exercise = options.find(item => item.id === exerciseId)!;
  const [date, setDate] = useState(initial?.date ?? localDate());
  const [weight, setWeight] = useState(initial ? String(toDisplayWeight(initial.weight, unit)) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const previousUnit = useRef(unit);
  useEffect(() => { const previous = previousUnit.current; setWeight(value => convertWeightInput(value, previous, unit)); previousUnit.current = unit; }, [unit]);
  const submit = async () => {
    if (busy.current) return;
    const value: TestedMax = { version: 1, id, exerciseId, exercise: exercise.name, weighted: exercise.weighted, date, weight: toStoredWeight(parseDecimalInput(weight), unit), note: note.trim(), recordedAt: initial?.recordedAt ?? new Date().toISOString() };
    try { validateTestedMax(value); } catch (error) { setError(t((error as Error).message)); return; }
    busy.current = true; setSaving(true); setError('');
    try { await onSave(value); onClose(); } catch (error) { setError(t(error instanceof Error ? error.message : 'Enregistrement impossible. Réessaie.')); }
    finally { busy.current = false; setSaving(false); }
  };
  return <NutritionModal title={t(initial ? 'Modifier le 1RM testé' : 'Enregistrer un 1RM testé')} subtitle={t('UNE RÉPÉTITION / RÉELLEMENT SOULEVÉE')} busy={saving} onClose={onClose}>
    <form className="training-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={saving}>
        <p className="training-hint">{t('Note une répétition réussie lors de ton test. Ce record est distinct du 1RM estimé et ne modifie pas les charges de ton bloc.')}</p>
        <label>{t('Exercice de force')}<select value={exerciseId} onChange={event => setExerciseId(event.target.value)}>{options.map(item => <option key={item.id} value={item.id}>{t(item.name)}</option>)}</select></label>
        <div className="training-date-row"><label>{t('Date du test')}<input type="date" required max={localDate()} value={date} onChange={event => setDate(event.target.value)}/></label><label>{t(exercise.weighted ? 'Lest ajouté' : 'Charge totale')} ({unit})<DecimalInput required min={exercise.weighted ? 0 : 0.01} value={weight} onChange={event => setWeight(event.target.value)} placeholder="0"/></label></div>
        {exercise.weighted && <p className="training-hint">{t('Saisis uniquement le lest ajouté, sans le poids du corps. Zéro signifie une répétition au poids du corps.')}</p>}
        <label>{t('Note')}<textarea rows={2} maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder={t('Fin de bloc, conditions du test…')}/></label>
      </fieldset>
      {error && <p className="force-error" role="alert">{error}</p>}
      <div className="tested-max-form-actions">{initial && onRemove && <button type="button" className="btn btn-danger" disabled={saving} onClick={() => {
        if (busy.current || !confirm(t('Supprimer ce test 1RM ?'))) return;
        busy.current = true; setSaving(true); setError('');
        void onRemove(id).then(onClose).catch(error => setError(t(error instanceof Error ? error.message : 'Suppression impossible. Réessaie.'))).finally(() => { busy.current = false; setSaving(false); });
      }}>{t('Supprimer')}</button>}<button className="btn btn-primary" type="submit" disabled={saving}>{t(saving ? 'Enregistrement…' : 'Enregistrer le 1RM')}</button></div>
    </form>
  </NutritionModal>;
}
