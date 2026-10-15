import { t, useLanguage, locale, formatWeight, useWeightUnit } from '../i18n';
import type { Workout } from '../types';
import { Icon } from './Icon';
import { useState, useRef } from 'react';
import { ExerciseVariantPicker } from './ExerciseVariantPicker';
import { selectExerciseVariant } from '../exerciseVariants';
import { stampWorkoutExercises } from '../workoutOrder';

interface WorkoutDetailProps {
  workout: Workout;
  onEdit: (workout: Workout) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onComplete?: (workout: Workout) => void;
  onUpdate?: (workout: Workout) => void | Promise<void>;
}

export function WorkoutDetail({
  workout,
  onEdit,
  onDelete,
  onBack,
  onComplete,
  onUpdate,
}: WorkoutDetailProps) {
  useLanguage();
  useWeightUnit();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const busyRef = useRef(false);
  const handleDelete = () => {
    if (confirm(t("Êtes-vous sûr de vouloir supprimer cette séance ?"))) {
      onDelete(workout.id);
    }
  };

  return (
    <div className="detail-container">
      <button className="btn btn-back" onClick={onBack}>{t("← Retour")} </button>

      <div className="detail-header">
        <p className="eyebrow">{t('DANS LES DÉTAILS')}</p>
        <h2>{workout.name}</h2>
        <span className="detail-date">
          {new Date(workout.date).toLocaleDateString(locale(), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>

      <div className="detail-stats">
        <div className="stat-card">
          <span className="stat-label">{t("Exercices")}</span>
          <span className="stat-value">{workout.exercises.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{t("Séries")}</span>
          <span className="stat-value">
            {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)}
          </span>
        </div>
      </div>

      <div className="exercises-section">
        <h3>{t("Exercices")}</h3>
        {error && <p className="variant-save-error" role="alert">{error}</p>}
        {workout.exercises.map((exercise, exIndex) => (
          <div key={exercise.id} className="exercise-detail">
            <div className="exercise-header">
              <h4>{exIndex + 1}. {exercise.name}</h4>
              <span className="set-count">{exercise.sets.length} {t("séries")}</span>
            </div>
            {onUpdate && <ExerciseVariantPicker exercise={exercise} disabled={busy} onChange={id => {
              if (busyRef.current) return;
              busyRef.current=true;setBusy(true);setError('');
              const updated={...workout,exercises:stampWorkoutExercises(workout.exercises.map(item => item.id === exercise.id ? selectExerciseVariant(item,id) : item))};
              void Promise.resolve().then(() => onUpdate(updated)).catch(() => setError(t('Changement non enregistré. La variante précédente est conservée ; réessaie.'))).finally(() => {busyRef.current=false;setBusy(false);});
            }}/>}
            <div className="sets-grid">
              {exercise.sets.map((set, setIndex) => (
                <div key={set.id} className="set-item">
                  <span className="set-number">{t("Série")} {setIndex + 1}</span>
                  <div className="set-details">
                    <span className="set-weight">{formatWeight(set.weight)}</span>
                    <span className="set-reps">×{set.repsMin && set.repsMax ? `${set.repsMin}-${set.repsMax}` : set.reps || '?'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="detail-actions">
        {onComplete && <button className="btn btn-primary" onClick={()=>onComplete(workout)}><Icon name="check"/>{t('Séance réalisée')}</button>}
        <button className="btn btn-primary" onClick={() => onEdit(workout)}><Icon name="edit" />{t("Modifier")}</button>
        <button className="btn btn-danger" onClick={handleDelete}><Icon name="trash" />{t("Supprimer")}</button>
      </div>
    </div>
  );
}
