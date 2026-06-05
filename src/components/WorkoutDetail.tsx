import type { Workout } from '../types';
import './WorkoutDetail.css';

interface WorkoutDetailProps {
  workout: Workout;
  onEdit: (workout: Workout) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export function WorkoutDetail({
  workout,
  onEdit,
  onDelete,
  onBack,
}: WorkoutDetailProps) {
  const handleDelete = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette séance ?')) {
      onDelete(workout.id);
    }
  };

  return (
    <div className="detail-container">
      <button className="btn btn-back" onClick={onBack}>
        ← Retour
      </button>

      <div className="detail-header">
        <h2>{workout.name}</h2>
        <span className="detail-date">
          {new Date(workout.date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>

      <div className="detail-stats">
        <div className="stat-card">
          <span className="stat-label">Exercices</span>
          <span className="stat-value">{workout.exercises.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Séries</span>
          <span className="stat-value">
            {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)}
          </span>
        </div>
      </div>

      <div className="exercises-section">
        <h3>Exercices</h3>
        {workout.exercises.map((exercise, exIndex) => (
          <div key={exercise.id} className="exercise-detail">
            <div className="exercise-header">
              <h4>{exIndex + 1}. {exercise.name}</h4>
              <span className="set-count">{exercise.sets.length} séries</span>
            </div>
            <div className="sets-grid">
              {exercise.sets.map((set, setIndex) => (
                <div key={set.id} className="set-item">
                  <span className="set-number">Série {setIndex + 1}</span>
                  <div className="set-details">
                    <span className="set-weight">{set.weight}kg</span>
                    <span className="set-reps">×{set.repsMin && set.repsMax ? `${set.repsMin}-${set.repsMax}` : set.reps || '?'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="detail-actions">
        <button className="btn btn-primary" onClick={() => onEdit(workout)}>
          ✏️ Modifier
        </button>
        <button className="btn btn-danger" onClick={handleDelete}>
          🗑️ Supprimer
        </button>
      </div>
    </div>
  );
}
