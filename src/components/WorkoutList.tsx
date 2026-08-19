import { useState, useCallback, useEffect } from 'react';
import type { Workout, Exercise } from '../types';
import './WorkoutList.css';

interface WorkoutListProps {
  workouts: Workout[];
  onNew: () => void;
  onView: (workout: Workout) => void;
  onEdit: (workout: Workout) => void;
  onDelete: (id: string) => void;
  onUpdate?: (workout: Workout) => void;
}

export function WorkoutList({ 
  workouts, 
  onNew, 
  onView,
  onEdit, 
  onDelete,
  onUpdate
}: WorkoutListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<{ exerciseId: string; setId: string; field: 'weight' | 'reps' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>(workouts);

  useEffect(() => {
    setLocalWorkouts(workouts);
  }, [workouts]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prevId => prevId === id ? null : id);
  }, []);

  const handleSetClick = (exerciseId: string, setId: string, field: 'weight' | 'reps', currentValue: string) => {
    setEditingSet({ exerciseId, setId, field });
    setEditValue(currentValue === '?' ? '' : currentValue);
  };

  const handleSetBlur = () => {
    if (!editingSet) return;

    const workout = localWorkouts.find(w => w.exercises.some(ex => ex.sets.some(s => s.id === editingSet.setId)));
    if (!workout) {
      setEditingSet(null);
      return;
    }

    let newWeight = 0;
    let newRepsMin = 0;
    let newRepsMax = 0;
    let newReps = 0;

    if (editingSet.field === 'weight') {
      newWeight = parseFloat(editValue) || 0;
    } else {
      const value = editValue.trim();
      if (value === '') {
        newReps = 0;
        newRepsMin = 0;
        newRepsMax = 0;
      } else if (value.includes('-')) {
        const [min, max] = value.split('-').map(v => parseInt(v.trim()) || 0);
        newRepsMin = min;
        newRepsMax = max;
        newReps = 0;
      } else {
        newReps = parseInt(value) || 0;
        newRepsMin = 0;
        newRepsMax = 0;
      }
    }
    
    const updatedExercises = workout.exercises.map(ex => {
      if (ex.id !== editingSet.exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => {
          if (s.id !== editingSet.setId) return s;
          if (editingSet.field === 'weight') {
            return { ...s, weight: newWeight };
          } else {
            return { ...s, reps: newReps, repsMin: newRepsMin, repsMax: newRepsMax };
          }
        })
      };
    });

    const updatedWorkout = { ...workout, exercises: updatedExercises };
    setLocalWorkouts(prev => prev.map(w => w.id === workout.id ? updatedWorkout : w));
    
    if (onUpdate) {
      onUpdate(updatedWorkout);
    }
    
    setEditingSet(null);
  };

  const getSetValue = (set: Exercise['sets'][0], field: 'weight' | 'reps'): string => {
    if (field === 'weight') {
      return set.weight > 0 ? `${set.weight}` : '?';
    }
    return set.repsMin && set.repsMax ? `${set.repsMin}-${set.repsMax}` : set.reps ? `${set.reps}` : '?';
  };

  return (
    <div className="workout-list">
      <div className="list-header">
        <h2>Mes Séances</h2>
        <button className="btn btn-primary" onClick={onNew}>
          ➕ Nouvelle Séance
        </button>
      </div>

      {workouts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏋️</div>
          <p>Aucune séance enregistrée</p>
          <p className="hint">Commencez par créer votre première séance !</p>
        </div>
      ) : (
        <div className="workout-cards">
          {workouts.map(workout => {
            const isExpanded = expandedId === workout.id;
            return (
              <div 
                key={workout.id} 
                className={`workout-card ${isExpanded ? 'expanded' : ''}`}
              >
                <div 
                  className="card-header"
                  onClick={() => onView(workout)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-title">
                    <h3>{workout.name}</h3>
                    <span className="workout-date">
                      {new Date(workout.date).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="expand-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(workout.id);
                    }}
                    aria-label={isExpanded ? 'Masquer les séries' : 'Afficher les séries'}
                    title={isExpanded ? 'Masquer les séries' : 'Afficher les séries'}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>

                <div className="card-stats" onClick={(e) => e.stopPropagation()}>
                  <span className="stat">
                    {workout.exercises.length} exercices
                  </span>
                  <span className="stat">
                    {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} séries
                  </span>
                </div>

                {isExpanded && (
                  <div className="card-details" onClick={(e) => e.stopPropagation()}>
                    <div className="exercises-list">
                      <h4>Exercices :</h4>
                      {workout.exercises.map((exercise, exIdx) => (
                        <div key={exercise.id} className="exercise-item">
                          <div className="exercise-name">
                            {exIdx + 1}. {exercise.name}
                          </div>
                          <div className="sets-preview">
                            {exercise.sets.map((set, setIdx) => (
                              <div key={set.id} className="set-edit-group">
                                <span 
                                  className={`set-badge editable ${editingSet?.setId === set.id && editingSet.field === 'weight' ? 'editing' : ''}`}
                                  onClick={() => handleSetClick(exercise.id, set.id, 'weight', getSetValue(set, 'weight'))}
                                >
                                  {editingSet?.setId === set.id && editingSet.field === 'weight' ? (
                                    <input
                                      type="number"
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      onBlur={handleSetBlur}
                                      onKeyDown={e => e.key === 'Enter' && handleSetBlur()}
                                      autoFocus
                                      className="set-edit-input"
                                    />
                                  ) : (
                                    <>S{setIdx + 1}: {set.weight > 0 ? `${set.weight}kg` : '?'}</>
                                  )}
                                </span>
                                <span 
                                  className={`set-badge editable ${editingSet?.setId === set.id && editingSet.field === 'reps' ? 'editing' : ''}`}
                                  onClick={() => handleSetClick(exercise.id, set.id, 'reps', getSetValue(set, 'reps'))}
                                >
                                  {editingSet?.setId === set.id && editingSet.field === 'reps' ? (
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      onBlur={handleSetBlur}
                                      onKeyDown={e => e.key === 'Enter' && handleSetBlur()}
                                      autoFocus
                                      className="set-edit-input"
                                    />
                                  ) : (
                                    <>×{set.repsMin && set.repsMax ? `${set.repsMin}-${set.repsMax}` : set.reps || '?'}</>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button 
                    type="button"
                    className="btn btn-secondary btn-sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(workout);
                    }}
                    title="Voir détails"
                  >
                    👁️
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary btn-sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(workout);
                    }}
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Supprimer cette séance ?')) {
                        onDelete(workout.id);
                      }
                    }}
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
