import { t, useLanguage } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import type { Workout, Exercise } from '../types';
import { TemplateSelector } from './TemplateSelector';
import { Icon } from './Icon';

interface WorkoutFormProps {
  workout: Workout | null;
  onSave: (workout: Workout) => void;
  onCancel: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const EXERCISE_SUGGESTIONS = [
  'Tractions lestées',
  'Tirage vertical prise grand rond',
  'Iso-lateral high row',
  'Pullover poulie',
  'Tirage horizontal machine unilatérale (row)',
  'Tirage horizontal machine (low row)',
  'Tirage horizontal poulie',
  'Trapèze horizontal (low row)',
  'Shrugs machine',
  'Curl pupitre',
  'Bayesian curl',
  'Reverse fly',
  'Upper back',
  'Vertical traction (pull down)',
  'Front lat pulldown',
  'T-bar row',
  'Curl marteau haltères',
  'Curl marteau uni poulie',
  'Développé couché machine',
  'Pec fly',
  'Chest presse',
  'Développé incliné machine hammer strength',
  'Smith machine incliné',
  'Dips corps en avant',
  'Développé militaire',
  'Développé militaire machine',
  'Machine élévation latérale',
  'Élévation latérale poulie',
  'Élévation frontale poulie',
  'Tirage triceps poulie basse corde',
  'Tirage triceps poulie haute corde',
  'Tirage triceps poulie basse triangle',
  'Tirage triceps poulie haute triangle',
  'Développé incliné machine',
  'Wide chest press bas des pecs',
  'Barre au front',
  'Hack squat',
  'Hammer V squat',
  'Deadlift machine',
  'Presse incline',
  'Presse ultra incliné',
  'Squat belt',
  'Fentes bulgares machine',
  'Machine leg extension',
  'Machine leg extension poids libres',
  'Leg curl allongé',
  'Leg curl assis',
  'Leg curl debout',
  'Mollet machine assis',
  'Mollet presse ultra incliné',
  'Mollet presse horizontal',
];

export function WorkoutForm({ workout, onSave, onCancel }: WorkoutFormProps) {
  useLanguage();
  const [name, setName] = useState(workout?.name || '');
  const [date, setDate] = useState(workout?.date || new Date().toISOString().split('T')[0]);
  const [exercises, setExercises] = useState<Exercise[]>(workout?.exercises || []);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [repsInputValues, setRepsInputValues] = useState<{ [key: string]: string }>({});
  const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [exerciseToReveal, setExerciseToReveal] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciseToReveal) return;

    const exerciseElement = exerciseRefs.current[exerciseToReveal];
    if (!exerciseElement) return;

    exerciseElement.querySelector<HTMLInputElement>('input[type="text"]')?.focus({ preventScroll: true });
    exerciseElement.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    setExerciseToReveal(null);
  }, [exerciseToReveal, exercises]);

  const handleTemplateSelect = (selectedExercises: Exercise[]) => {
    setExercises(selectedExercises);
    setShowTemplateSelector(false);
    // Auto-fill name if not set
    if (!name) {
      const firstEx = selectedExercises[0]?.name || t("Nouvelle séance");
      const templateName = firstEx.includes('Pull') ? 'Pull' :
                          firstEx.includes('Push') ? 'Push' :
                          firstEx.includes('Leg') ? 'Legs' :
                          firstEx.includes('Hack squat') || firstEx.includes('squat') ? 'Legs' :
                          t("Séance");
      setName(templateName);
    }
  };

  const addExercise = () => {
    const exercise = { id: generateId(), name: '', sets: [] };
    setExercises(prev => [...prev, exercise]);
    setExerciseToReveal(exercise.id);
  };

  const moveExercise = (exerciseId: string, direction: -1 | 1) => {
    setExercises(prev => {
      const currentIndex = prev.findIndex(exercise => exercise.id === exerciseId);
      const targetIndex = currentIndex + direction;

      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;

      const reorderedExercises = [...prev];
      [reorderedExercises[currentIndex], reorderedExercises[targetIndex]] = [
        reorderedExercises[targetIndex],
        reorderedExercises[currentIndex],
      ];
      return reorderedExercises;
    });
  };

  const removeExercise = (exerciseId: string) => {
    setExercises(prev => prev.filter(ex => ex.id !== exerciseId));
  };

  const updateExerciseName = (exerciseId: string, name: string) => {
    setExercises(prev =>
      prev.map(ex => ex.id === exerciseId ? { ...ex, name } : ex)
    );
  };

  const addSet = (exerciseId: string) => {
    setExercises(prev =>
      prev.map(ex =>
        {
          if (ex.id !== exerciseId) return ex;

          const previousSet = ex.sets.at(-1);
          if (!previousSet) {
            return {
              ...ex,
              sets: [...ex.sets, { id: generateId(), weight: 0, reps: 0, repsMin: 8, repsMax: 12 }]
            };
          }

          // Les répétitions ne sont enregistrées qu'à la sortie du champ. On
          // reprend donc aussi la valeur en cours de saisie si elle existe.
          const repsValue = repsInputValues[previousSet.id];
          const copiedSet = { ...previousSet, id: generateId() };

          if (repsValue !== undefined) {
            const value = repsValue.trim();
            if (value.includes('-')) {
              const [repsMin, repsMax] = value.split('-').map(v => parseInt(v.trim()) || 0);
              copiedSet.reps = 0;
              copiedSet.repsMin = repsMin;
              copiedSet.repsMax = repsMax;
            } else {
              copiedSet.reps = parseInt(value) || 0;
              copiedSet.repsMin = 0;
              copiedSet.repsMax = 0;
            }
          }

          return { ...ex, sets: [...ex.sets, copiedSet] };
        }
      )
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises(prev =>
      prev.map(ex =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
          : ex
      )
    );
  };

  const updateSet = (exerciseId: string, setId: string, field: 'weight' | 'reps' | 'repsMin' | 'repsMax', value: number) => {
    setExercises(prev =>
      prev.map(ex =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
            }
          : ex
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || exercises.length === 0) return;
    
    onSave({
      id: workout?.id || generateId(),
      name: name.trim(),
      date,
      exercises: exercises.filter(ex => ex.name.trim()),
    });
  };

  if (showTemplateSelector) {
    return (
      <div className="workout-form">
        <TemplateSelector onSelectTemplate={handleTemplateSelect} />
        <div className="selector-cancel">
          <button className="btn btn-secondary" onClick={() => setShowTemplateSelector(false)}>{t("Fermer")} </button>
        </div>
      </div>
    );
  }

  return (
    <form className="workout-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <div><p className="eyebrow">{t('À TON RYTHME')}</p><h2>{workout ? t("Modifier la séance") : t("Nouvelle séance")}</h2><p className="page-description">{t('Compose ta séance, exercice après exercice.')}</p></div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>{t("Annuler")} </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || exercises.length === 0}>{t("Enregistrer")} </button>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="workout-name">{t("Nom de la séance")}</label>
        <input
          id="workout-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t("Ex: Pull 1, Push, Legs...")}
          required
        />
      </div>

      {!workout && (
        <div className="form-group">
          <label htmlFor="workout-date">Date</label>
          <input
            id="workout-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
      )}

      {!workout && exercises.length === 0 && (
        <div className="template-section">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowTemplateSelector(true)}
          ><Icon name="workout" />{t("Charger un modèle")}</button><p>{t('Pars d’une base Push, Pull ou Legs et adapte-la à tes objectifs.')}</p>
        </div>
      )}

      <div className="exercises-section">
        <div className="section-header">
          <h3>{t("Exercices")}</h3>
          <button type="button" className="btn btn-secondary" onClick={addExercise}>{t("+ Ajouter un exercice")} </button>
        </div>

        {exercises.length === 0 && <div className="empty-exercises"><Icon name="plus" size={28} /><p>{t('Ta séance commence ici.')}</p><span>{t('Ajoute ton premier exercice pour préparer tes séries.')}</span></div>}
        {exercises.map((exercise, exIndex) => (
          <div
            key={exercise.id}
            ref={element => { exerciseRefs.current[exercise.id] = element; }}
            className="exercise-block"
          >
            <div className="exercise-header">
              <span className="exercise-number" aria-label={`${t('Exercice')} ${exIndex + 1}`}>
                {exIndex + 1}
              </span>
              <div className="exercise-name-input">
                <input
                  type="text"
                  value={exercise.name}
                  onChange={e => updateExerciseName(exercise.id, e.target.value)}
                  placeholder={t("Nom de l'exercice")}
                  aria-label={`${t("Nom de l'exercice")} ${exIndex + 1}`}
                  list={`exercise-suggestions-${exIndex}`}
                />
                <datalist id={`exercise-suggestions-${exIndex}`}>
                  {EXERCISE_SUGGESTIONS.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="exercise-order-controls" aria-label={t("Changer l'ordre de l'exercice")}>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => moveExercise(exercise.id, -1)}
                  disabled={exIndex === 0}
                  aria-label={t("Monter l'exercice")}
                  title={t("Monter")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => moveExercise(exercise.id, 1)}
                  disabled={exIndex === exercises.length - 1}
                  aria-label={t("Descendre l'exercice")}
                  title={t("Descendre")}
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-danger"
                onClick={() => removeExercise(exercise.id)}
                aria-label={t('Supprimer l’exercice')}
              >
                ×
              </button>
            </div>

            <div className="sets-table">
              <div className="sets-header">
                <span>{t("Série")}</span>
                <span>{t("Poids (kg)")}</span>
                <span>{t("Reps (ex: 6-8)")}</span>
                <span></span>
              </div>
              {exercise.sets.map((set, setIndex) => (
                <div key={set.id} className="set-row">
                  <span className="set-number">{setIndex + 1}</span>
                  <input
                    type="number"
                    aria-label={`${t('Poids (kg)')} · ${t('Série')} ${setIndex + 1}`}
                    value={set.weight || ''}
                    onChange={e => updateSet(exercise.id, set.id, 'weight', parseFloat(e.target.value) || 0)}
                    placeholder="kg"
                    min="0"
                    step="0.5"
                  />
                  <input
                    type="text"
                    aria-label={`Reps · ${t('Série')} ${setIndex + 1}`}
                    value={repsInputValues[set.id] !== undefined ? repsInputValues[set.id] : (set.repsMin && set.repsMax ? `${set.repsMin}-${set.repsMax}` : set.reps || '')}
                    onChange={e => {
                      setRepsInputValues(prev => ({
                        ...prev,
                        [set.id]: e.target.value
                      }));
                    }}
                    onBlur={e => {
                      const value = e.target.value.trim();
                      setRepsInputValues(prev => {
                        const updated = { ...prev };
                        delete updated[set.id];
                        return updated;
                      });
                      
                      if (value === '') {
                        updateSet(exercise.id, set.id, 'reps', 0);
                        updateSet(exercise.id, set.id, 'repsMin', 0);
                        updateSet(exercise.id, set.id, 'repsMax', 0);
                      } else if (value.includes('-')) {
                        // Format: 6-8
                        const [min, max] = value.split('-').map(v => parseInt(v.trim()) || 0);
                        updateSet(exercise.id, set.id, 'repsMin', min);
                        updateSet(exercise.id, set.id, 'repsMax', max);
                        updateSet(exercise.id, set.id, 'reps', 0);
                      } else {
                        // Format: 10 (chiffre unique)
                        const reps = parseInt(value) || 0;
                        updateSet(exercise.id, set.id, 'reps', reps);
                        updateSet(exercise.id, set.id, 'repsMin', 0);
                        updateSet(exercise.id, set.id, 'repsMax', 0);
                      }
                    }}
                    placeholder={t("Ex: 10 ou 6-8")}
                  />
                  <button
                    type="button"
                    className="btn btn-icon btn-danger"
                    onClick={() => removeSet(exercise.id, set.id)}
                    aria-label={`${t('Supprimer la série')} ${setIndex + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-small"
              onClick={() => addSet(exercise.id)}
            >{t("+ Ajouter une série")} </button>
          </div>
        ))}
      </div>
    </form>
  );
}
