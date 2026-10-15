import type { Exercise } from '../types';
import { exerciseVariants } from '../exerciseVariants';
import { t } from '../i18n';
import '../exerciseVariants.css';

export function ExerciseVariantPicker({ exercise, onChange, disabled = false }: { exercise: Exercise; onChange: (id: string) => void; disabled?: boolean }) {
  if (!exercise.alternatives?.length) return null;
  return <label className="exercise-variant-picker"><span>{t('Variante utilisée')}</span><select value={exercise.activeVariantId ?? exercise.id} onChange={event => onChange(event.target.value)} disabled={disabled} aria-label={`${t('Variante utilisée')} · ${exercise.name}`}>{exerciseVariants(exercise).map(variant => <option key={variant.id} value={variant.id}>{variant.name} · {variant.sets.length} {t('séries')}</option>)}</select><small>{t('Une seule variante comptée. Chaque charge reste mémorisée séparément.')}</small></label>;
}
