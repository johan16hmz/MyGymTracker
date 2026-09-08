import { useState, useEffect } from 'react';
import type { Workout } from './types';
import { WorkoutList } from './components/WorkoutList';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutDetail } from './components/WorkoutDetail';
import { Login } from './components/Login';
import { Strength } from './components/Strength';
import { getStrengthBlock } from './strengthService';
import { onAuthStateChange, signOut } from './authService';
import { getUserWorkouts, addWorkout, updateWorkout, deleteWorkout } from './workoutService';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail' | 'strength'>('list');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [strengthPending, setStrengthPending] = useState(false);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Écouter les changements d'authentification
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (user) => {
      if (user) {
        setCurrentUser(user.email);
        setUserId(user.id);
        // Charger les séances de l'utilisateur
        const result = await getUserWorkouts(user.id);
        if (result.success) {
          setWorkouts(result.data || []);
          setLoadError('');
        } else {
          setLoadError('Impossible de charger tes séances et blocs. Recharge la page pour réessayer.');
        }
        setLoadingWorkouts(false);
      } else {
        setCurrentUser(null);
        setUserId(null);
        setWorkouts([]);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleSaveWorkout = async (workout: Workout) => {
    if (!userId) return;

    if (view === 'edit') {
      const result = await updateWorkout(workout.id, workout);
      if (result.success) {
        setWorkouts(prev => prev.map(w => w.id === workout.id ? workout : w));
      }
    } else {
      const result = await addWorkout(userId, workout);
      if (result.success) {
        setWorkouts(prev => [workout, ...prev]);
      }
    }
    setView('list');
    setSelectedWorkout(null);
  };

  const handleUpdateWorkout = async (workout: Workout) => {
    const result = await updateWorkout(workout.id, workout);
    if (result.success) {
      setWorkouts(prev => prev.map(w => w.id === workout.id ? workout : w));
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    const result = await deleteWorkout(id);
    if (result.success) {
      setWorkouts(prev => prev.filter(w => w.id !== id));
    }
    setView('list');
    setSelectedWorkout(null);
  };

  const handleLogout = async () => {
    if (strengthPending && !confirm('Des modifications du bloc ne sont pas enregistrées. Quitter quand même ?')) return;
    await signOut();
    setCurrentUser(null);
    setUserId(null);
    setWorkouts([]);
    setView('list');
    setSelectedWorkout(null);
  };

  const handleEditWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setView('edit');
  };

  const handleViewWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setView('detail');
  };

  const handleNewWorkout = () => {
    setSelectedWorkout(null);
    setView('create');
  };

  const handleBackToList = () => {
    if (strengthPending && !confirm('Des modifications du bloc ne sont pas enregistrées. Quitter quand même ?')) return;
    setView('list');
    setSelectedWorkout(null);
  };

  if (!currentUser) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1 onClick={() => handleBackToList()} style={{ cursor: 'pointer' }}>
            🏋️ MyGymTracker
          </h1>
          <div className="header-user">
            <span className="username">👤 {currentUser}</span>
            <button className="btn btn-secondary btn-small" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
        <p className="tagline">Suivi d'entraînement intelligent</p>
        <nav className="app-sections" aria-label="Sections">
          <button className={`btn ${view !== 'strength' ? 'btn-primary' : 'btn-secondary'}`} onClick={handleBackToList}>Séances</button>
          <button className={`btn ${view === 'strength' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('strength')}>Force</button>
        </nav>
      </header>

      <main className="app-main">
        {view === 'strength' && loadingWorkouts && <p role="status">Chargement des blocs…</p>}
        {view === 'strength' && loadError && <p role="alert">{loadError}</p>}
        {view === 'strength' && userId && !loadingWorkouts && !loadError && <Strength key={userId} userId={userId} workouts={workouts} onPendingChange={setStrengthPending} onSaved={saved => {
          setWorkouts(previous => previous.some(workout => workout.id === saved.id)
            ? previous.map(workout => workout.id === saved.id ? saved : workout)
            : [saved, ...previous]);
        }} />}
        {view === 'list' && (
          <WorkoutList
            workouts={workouts.filter(workout => !getStrengthBlock(workout))}
            onNew={handleNewWorkout}
            onView={handleViewWorkout}
            onEdit={handleEditWorkout}
            onDelete={handleDeleteWorkout}
            onUpdate={handleUpdateWorkout}
          />
        )}
        {view === 'detail' && selectedWorkout && (
          <WorkoutDetail
            workout={selectedWorkout}
            onEdit={handleEditWorkout}
            onDelete={handleDeleteWorkout}
            onBack={handleBackToList}
          />
        )}
        {(view === 'create' || view === 'edit') && (
          <WorkoutForm
            workout={selectedWorkout}
            onSave={handleSaveWorkout}
            onCancel={() => {
              setView('list');
              setSelectedWorkout(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
