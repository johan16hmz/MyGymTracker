import { useState } from 'react';
import type { Workout, Exercise } from '../types';
import { TemplateSelector } from './TemplateSelector';
import './WorkoutForm.css';

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
  const [name, setName] = useState(workout?.name || '');
  const [date, setDate] = useState(workout?.date || new Date().toISOString().split('T')[0]);
  const [exercises, setExercises] = useState<Exercise[]>(workout?.exercises || []);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [repsInputValues, setRepsInputValues] = useState<{ [key: string]: string }>({});

  const handleTemplateSelect = (selectedExercises: Exercise[]) => {
    setExercises(selectedExercises);
    setShowTemplateSelector(false);
    // Auto-fill name if not set
    if (!name) {
      const firstEx = selectedExercises[0]?.name || 'Nouvelle séance';
      const templateName = firstEx.includes('Pull') ? 'Pull' :
                          firstEx.includes('Push') ? 'Push' :
                          firstEx.includes('Leg') ? 'Legs' :
                          firstEx.includes('Hack squat') || firstEx.includes('squat') ? 'Legs' :
                          'Séance';
      setName(templateName);
    }
  };

  const addExercise = () => {
    setExercises(prev => [...prev, { id: generateId(), name: '', sets: [] }]);
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
        ex.id === exerciseId
          ? { ...ex, sets: [...ex.sets, { id: generateId(), weight: 0, reps: 0, repsMin: 8, repsMax: 12 }] }
          : ex
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
          <button className="btn btn-secondary" onClick={() => setShowTemplateSelector(false)}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="workout-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>{workout ? 'Modifier la séance' : 'Nouvelle séance'}</h2>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || exercises.length === 0}>
            Enregistrer
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Nom de la séance</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Pull 1, Push, Legs..."
          required
        />
      </div>

      <div className="form-group">
        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />
      </div>

      {!workout && exercises.length === 0 && (
        <div className="template-section">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowTemplateSelector(true)}
          >
            📋 Charger un template de séance
          </button>
        </div>
      )}

      <div className="exercises-section">
        <div className="section-header">
          <h3>Exercices</h3>
          <button type="button" className="btn btn-secondary" onClick={addExercise}>
            + Ajouter un exercice
          </button>
        </div>

        {exercises.map((exercise, exIndex) => (
          <div key={exercise.id} className="exercise-block">
            <div className="exercise-header">
              <div className="exercise-name-input">
                <input
                  type="text"
                  value={exercise.name}
                  onChange={e => updateExerciseName(exercise.id, e.target.value)}
                  placeholder="Nom de l'exercice"
                  list={`exercise-suggestions-${exIndex}`}
                />
                <datalist id={`exercise-suggestions-${exIndex}`}>
                  {EXERCISE_SUGGESTIONS.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                className="btn btn-icon btn-danger"
                onClick={() => removeExercise(exercise.id)}
              >
                ×
              </button>
            </div>

            <div className="sets-table">
              <div className="sets-header">
                <span>Série</span>
                <span>Poids (kg)</span>
                <span>Reps (ex: 6-8)</span>
                <span></span>
              </div>
              {exercise.sets.map((set, setIndex) => (
                <div key={set.id} className="set-row">
                  <span className="set-number">{setIndex + 1}</span>
                  <input
                    type="number"
                    value={set.weight || ''}
                    onChange={e => updateSet(exercise.id, set.id, 'weight', parseFloat(e.target.value) || 0)}
                    placeholder="kg"
                    min="0"
                    step="0.5"
                  />
                  <input
                    type="text"
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
                    placeholder="Ex: 10 ou 6-8"
                  />
                  <button
                    type="button"
                    className="btn btn-icon btn-danger"
                    onClick={() => removeSet(exercise.id, set.id)}
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
            >
              + Ajouter une série
            </button>
          </div>
        ))}
      </div>
    </form>
  );
}
