// Development-only fixture. No authenticated account or production data needed.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorkoutList } from '../src/components/WorkoutList';
import { WorkoutForm } from '../src/components/WorkoutForm';
import { WorkoutDetail } from '../src/components/WorkoutDetail';
import { Login } from '../src/components/Login';
import { Strength } from '../src/components/Strength';
import { TemplateSelector } from '../src/components/TemplateSelector';
import { createStrengthBlock } from '../src/strength';
import '../src/App.css';
import '../src/index.css';
import '../src/mobile.css';

const noop = () => {};
const workout = { id: 'fixture', name: 'Séance test avec un nom particulièrement long', date: '2026-09-08', exercises: [
  { id: 'exercise', name: 'Développé incliné machine prise large', sets: [{ id: 'set', weight: 77.5, reps: 8 }] },
] };
const force = { ...workout, exercises: [{ id: 'force', name: 'Bloc force', sets: [], strengthBlock: createStrengthBlock({ pullup: 45, bench: 100, dips: 37.5, squat: 120 }, 80) }] };
const view = new URLSearchParams(location.search).get('view');
const screens = {
  list: <WorkoutList workouts={[workout]} onNew={noop} onView={noop} onEdit={noop} onDelete={noop} />,
  edit: <WorkoutForm workout={workout} onSave={noop} onCancel={noop} />,
  create: <WorkoutForm workout={null} onSave={noop} onCancel={noop} />,
  detail: <WorkoutDetail workout={workout} onEdit={noop} onDelete={noop} onBack={noop} />,
  template: <TemplateSelector onSelectTemplate={noop} />,
  force: <Strength userId="fixture" workouts={[force]} onSaved={noop} onPendingChange={noop} />,
  forceCreate: <Strength userId="fixture" workouts={[]} onSaved={noop} onPendingChange={noop} />,
};
createRoot(document.getElementById('app')!).render(view === 'login' ? <Login onLogin={noop} /> : <div className="app">
  <header className="app-header"><div className="header-top"><h1>🏋️ MyGymTracker</h1><div className="header-user"><button className="btn btn-secondary btn-small">Déconnexion</button></div></div><p className="tagline">Suivi d'entraînement intelligent</p><nav className="app-sections"><button className="btn btn-primary">Séances</button><button className="btn btn-secondary">Force</button></nav></header>
  <main className="app-main">{screens[view as keyof typeof screens] ?? screens.list}</main>
</div>);
