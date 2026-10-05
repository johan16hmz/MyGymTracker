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
import { Icon } from '../src/components/Icon';
import { Settings } from '../src/components/Settings';
import '../src/ui.css';

const noop = () => {};
const workout = { id: 'fixture', name: 'Séance test avec un nom particulièrement long', date: '2026-09-08', exercises: [
  { id: 'exercise', name: 'Développé incliné machine prise large', sets: [{ id: 'set', weight: 77.5, reps: 8 }] },
] };
const force = { ...workout, exercises: [{ id: 'force', name: 'Bloc force', sets: [], strengthBlock: createStrengthBlock({ pullup: 45, bench: 100, dips: 37.5, squat: 120 }, 80) }] };
const view = new URLSearchParams(location.search).get('view');
const screens = {
  list: <WorkoutList workouts={[workout]} onNew={noop} onView={noop} onEdit={noop} onDelete={noop} />,
  edit: <WorkoutForm userId="fixture" workout={workout} onSave={async () => true} onCancel={noop} />,
  create: <WorkoutForm userId="fixture" workout={null} onSave={async () => true} onCancel={noop} />,
  detail: <WorkoutDetail workout={workout} onEdit={noop} onDelete={noop} onBack={noop} />,
  template: <TemplateSelector onSelectTemplate={noop} />,
  force: <Strength userId="fixture" workouts={[force]} onSaved={noop} onPendingChange={noop} />,
  forceCreate: <Strength userId="fixture" workouts={[]} onSaved={noop} onPendingChange={noop} />,
};
createRoot(document.getElementById('app')!).render(view === 'login' ? <Login onLogin={noop} /> : <div className="app">
  <header className="app-header">
    <button className="brand"><span className="brand-mark"><img src="/brand-icon.svg" alt="" /></span><span>MyGym<span className="brand-light">Tracker</span><small>TRAINING JOURNAL</small></span></button>
    <p className="nav-caption">TON ESPACE</p>
    <nav className="app-sections"><button className={`nav-item ${view?.startsWith('force') ? '' : 'active'}`}><Icon name="workout" />Séances</button><button className={`nav-item ${view?.startsWith('force') ? 'active' : ''}`}><Icon name="strength" />Force</button><button className="nav-item"><Icon name="nutrition" />Nutrition</button></nav>
    <div className="header-user"><Settings /><button className="logout-button"><Icon name="logout" />Déconnexion</button></div>
  </header>
  <main className="app-main"><div className="workspace-topbar">MYGYMTRACKER / {view?.startsWith('force') ? 'Force' : 'Séances'}</div>{screens[view as keyof typeof screens] ?? screens.list}</main>
</div>);
