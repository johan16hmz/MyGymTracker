import { t, useLanguage, locale, formatWeight, useWeightUnit } from '../i18n';
import { useState, useCallback, useEffect } from 'react';
import type { Workout, Exercise } from '../types';
import { Icon } from './Icon';

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
  useLanguage();
  useWeightUnit();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<{ exerciseId: string; setId: string; field: 'weight' | 'reps' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>(workouts);
  const [query, setQuery] = useState('');
  const visibleWorkouts = localWorkouts.filter(workout => workout.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const totalSets = workouts.reduce((total, workout) => total + workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0), 0);
  const days = new Set(workouts.map(workout => workout.date.slice(0, 10))).size;

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
      <section className="dashboard-hero"><div><p className="eyebrow">{t('TON JOURNAL D’ENTRAÎNEMENT')}</p><h1>{t('Chaque séance compte.')}</h1><p>{t('Retrouve tes séances. Prépare la prochaine. Continue de progresser.')}</p><button className="btn btn-primary" onClick={onNew}><Icon name="plus" />{t('Nouvelle séance')}</button></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit" /><span>MAKE<br />IT COUNT.</span><Icon name="arrow" size={32} /></div></section>
      <section className="overview-stats" aria-label={t('Vue d’ensemble')}><div><span><Icon name="workout" />{t('Séances enregistrées')}</span><strong>{workouts.length.toString().padStart(2, '0')}<small>{t('depuis le début')}</small></strong></div><div><span><Icon name="strength" />{t('Séries planifiées')}</span><strong>{totalSets.toLocaleString(locale())}<small>{t('dans tes séances')}</small></strong></div><div><span><Icon name="calendar" />{t('Jours d’entraînement')}</span><strong>{days.toString().padStart(2, '0')}<small>{t('dates distinctes')}</small></strong></div></section>
      <div className="list-header">
        <h2>{t("Mes Séances")} <span className="count-pill">{workouts.length}</span></h2>
        <label className="search-field"><Icon name="search" /><input aria-label={t('Rechercher une séance')} placeholder={t('Rechercher une séance')} value={query} onChange={event => setQuery(event.target.value)} /></label>
      </div>

      {workouts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="workout" size={32} /></div>
          <p>{t("Aucune séance enregistrée")}</p>
          <p className="hint">{t("Commencez par créer votre première séance !")}</p>
        </div>
      ) : (
        <div className="workout-cards">
          {visibleWorkouts.length === 0 && <p className="empty-state">{t('Aucune séance ne correspond à ta recherche.')}</p>}
          {visibleWorkouts.map((workout, index) => {
            const isExpanded = expandedId === workout.id;
            return (
              <div 
                key={workout.id} 
                className={`workout-card ${isExpanded ? 'expanded' : ''}`}
              >
                <div 
                  className="card-header"
                >
                  <div className="card-title">
                    <span className="card-index">{t('Séance')} / {String(index + 1).padStart(2, '0')}</span>
                    <h3><button className="card-title-link" onClick={() => onView(workout)}>{workout.name}</button></h3>
                    <span className="workout-date">
                      {new Date(workout.date).toLocaleDateString(locale(), {
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
                    aria-label={isExpanded ? t("Masquer les séries") : t("Afficher les séries")}
                    aria-expanded={isExpanded}
                    title={isExpanded ? t("Masquer les séries") : t("Afficher les séries")}
                  >
                    <span className={isExpanded ? 'chevron open' : 'chevron'}>⌄</span>
                  </button>
                </div>

                <div className="card-stats" onClick={(e) => e.stopPropagation()}>
                  <span className="stat">
                    {workout.exercises.length} {t("exercices")} </span>
                  <span className="stat">
                    {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} {t("séries")} </span>
                </div>

                {isExpanded && (
                  <div className="card-details" onClick={(e) => e.stopPropagation()}>
                    <div className="exercises-list">
                      <h4>{t("Exercices :")}</h4>
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
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`${t('Modifier')} · ${exercise.name} · ${t('Série')} ${setIdx + 1} · ${t('Poids (kg)')}`}
                                  onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleSetClick(exercise.id, set.id, 'weight', getSetValue(set, 'weight')); } }}
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
                                    <>S{setIdx + 1}: {set.weight > 0 ? formatWeight(set.weight) : '?'}</>
                                  )}
                                </span>
                                <span 
                                  className={`set-badge editable ${editingSet?.setId === set.id && editingSet.field === 'reps' ? 'editing' : ''}`}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`${t('Modifier')} · ${exercise.name} · ${t('Série')} ${setIdx + 1} · Reps`}
                                  onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleSetClick(exercise.id, set.id, 'reps', getSetValue(set, 'reps')); } }}
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
                    title={t("Voir détails")}
                  >
                    {t('Voir détails')}<Icon name="arrow" size={16} />
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary btn-sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(workout);
                    }}
                    title={t("Modifier")}
                  >
                    <Icon name="edit" size={18} /><span className="sr-only">{t('Modifier')}</span>
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t("Supprimer cette séance ?"))) {
                        onDelete(workout.id);
                      }
                    }}
                    title={t("Supprimer")}
                  >
                    <Icon name="trash" size={18} /><span className="sr-only">{t('Supprimer')}</span>
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
