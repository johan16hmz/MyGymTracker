import { useState, useEffect } from 'react';
import type { Workout } from './types';
import { WorkoutList } from './components/WorkoutList';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutDetail } from './components/WorkoutDetail';
import { Login } from './components/Login';
import { BenchProgress } from './components/BenchProgress';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('mygymtracker_currentUser');
  });

  const [workouts, setWorkouts] = useState<Workout[]>(() => {
    if (!currentUser) return [];
    const saved = localStorage.getItem(`mygymtracker_workouts_${currentUser}`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail' | 'bench'>('list');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`mygymtracker_workouts_${currentUser}`, JSON.stringify(workouts));
    }
  }, [workouts, currentUser]);

  const handleLogin = (username: string) => {
    localStorage.setItem('mygymtracker_currentUser', username);
    setCurrentUser(username);
    // Load user's workouts
    const saved = localStorage.getItem(`mygymtracker_workouts_${username}`);
    setWorkouts(saved ? JSON.parse(saved) : []);
  };

  const handleLogout = () => {
    localStorage.removeItem('mygymtracker_currentUser');
    setCurrentUser(null);
    setWorkouts([]);
    setView('list');
    setSelectedWorkout(null);
  };

  const handleSaveWorkout = (workout: Workout) => {
    if (view === 'edit') {
      setWorkouts(prev => prev.map(w => w.id === workout.id ? workout : w));
    } else {
      setWorkouts(prev => [workout, ...prev]);
    }
    setView('list');
    setSelectedWorkout(null);
  };

  const handleUpdateWorkout = (workout: Workout) => {
    setWorkouts(prev => prev.map(w => w.id === workout.id ? workout : w));
  };

  const handleDeleteWorkout = (id: string) => {
    setWorkouts(prev => prev.filter(w => w.id !== id));
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

  const handleGoToBench = () => {
    setView('bench');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedWorkout(null);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1 onClick={() => handleBackToList()} style={{ cursor: 'pointer' }}>
            🏋️ MyGymTracker
          </h1>
          <div className="header-user">
            <button className="bench-quick-btn" onClick={handleGoToBench}>
              <span className="bench-icon">🏋️</span>
              <span className="bench-label">Bench</span>
            </button>
            <span className="username">👤 {currentUser}</span>
            <button className="btn btn-secondary btn-small" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
        <p className="tagline">Suivi d'entraînement intelligent</p>
      </header>

      <main className="app-main">
        {view === 'bench' && (
          <BenchProgress
            currentUser={currentUser}
            onBack={handleBackToList}
          />
        )}
        {view === 'list' && (
          <WorkoutList
            workouts={workouts}
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
