import { t, useLanguage } from './i18n';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { Workout, TrainingSession } from './types';
import { isTrainingSessionRecord, trainingSessions } from './trainingSessions';
import { saveTrainingSession, removeTrainingSession } from './trainingSessionService';
import { TrainingSessionForm } from './components/TrainingSessionForm';
import { buildStatistics } from './statistics';
import { WorkoutList } from './components/WorkoutList';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutDetail } from './components/WorkoutDetail';
import { Login } from './components/Login';
import { ResetPassword } from './components/ResetPassword';
import { clearRecoveryLocation, hasRecoveryErrorLocation, isRecoveryLocation } from './authRecovery';
import { Strength } from './components/Strength';
import { getStrengthBlock } from './strengthService';
import { onAuthStateChange, signOut } from './authService';
import { getUserWorkouts, addWorkout, updateWorkout, deleteWorkout } from './workoutService';
import { AppShell } from './components/AppShell';
import type { AppSection } from './components/AppShell';
import { listWorkoutDrafts, removeWorkoutDraft } from './workoutDrafts';
import type { WorkoutDraft } from './workoutDrafts';

const Nutrition = lazy(() => import('./components/Nutrition').then(module => ({ default: module.Nutrition })));
const Statistics = lazy(() => import('./components/Statistics').then(module => ({ default: module.Statistics })));

function App() {
  useLanguage();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(() => isRecoveryLocation(window.location.href));
  const [authReady, setAuthReady] = useState(false);
  const [recoveryInvalid, setRecoveryInvalid] = useState(() => hasRecoveryErrorLocation(window.location.href));
  const [userId, setUserId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail' | 'strength' | 'nutrition' | 'statistics'>('list');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [strengthPending, setStrengthPending] = useState(false);
  const [strengthInitialTab,setStrengthInitialTab] = useState<'program'|'maxes'>('program');
  const [nutritionWeightFocus, setNutritionWeightFocus] = useState(false);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [drafts, setDrafts] = useState<WorkoutDraft[]>([]);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [sessionEntry, setSessionEntry] = useState<{workout:Workout;week?:number;prescriptionId?:string}>();
  const activeUserId = useRef<string | null>(null);
  useEffect(() => {
    setDrafts(userId ? listWorkoutDrafts(userId) : []);
  }, [userId, view]);

  // Écouter les changements d'authentification
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = onAuthStateChange(async (user, event) => {
      if (!active) return;
      setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); setRecoveryInvalid(false); }
      if (activeUserId.current !== (user?.id ?? null)) {
        setView('list'); setSelectedWorkout(null); setWorkouts([]); setDrafts([]); setNutritionWeightFocus(false);
        setLoadingWorkouts(true); setLoadError(''); setSessionEntry(undefined);
      }
      activeUserId.current = user?.id ?? null;
      if (user) {
        setCurrentUser(user.email);
        setUserId(user.id);
        // Charger les séances de l'utilisateur
        const result = await getUserWorkouts(user.id);
        if (!active || activeUserId.current !== user.id) return;
        if (result.success) {
          setWorkouts(result.data || []);
          setLoadError('');
        } else {
          setLoadError(t("Impossible de charger tes séances et blocs. Recharge la page pour réessayer."));
        }
        setLoadingWorkouts(false);
      } else {
        setCurrentUser(null);
        setUserId(null);
        setWorkouts([]);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleSaveWorkout = async (workout: Workout) => {
    if (!userId || savingWorkout) return false;
    setSavingWorkout(true);
    try {
      const result = view === 'edit' ? await updateWorkout(workout.id, workout) : await addWorkout(userId, workout);
      if (activeUserId.current !== userId) return false;
      if (!result.success || !('data' in result) || !result.data) return false;
      const saved = result.data;
      setWorkouts(prev => prev.some(w => w.id === saved.id) ? prev.map(w => w.id === saved.id ? saved : w) : [saved, ...prev]);
      return true;
    } finally { setSavingWorkout(false); }
  };

  const handleUpdateWorkout = async (workout: Workout) => {
    const ownerId = userId;
    const result = await updateWorkout(workout.id, workout);
    if (activeUserId.current !== ownerId) return;
    if (result.success && 'data' in result && result.data) {
      setWorkouts(prev => prev.map(w => w.id === workout.id ? result.data : w));
      setSelectedWorkout(previous => previous?.id === workout.id ? result.data : previous);
    } else {
      throw new Error('Enregistrement impossible. Réessaie.');
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
    if (savingWorkout) return;
    if (strengthPending && !confirm(t("Des modifications du bloc ne sont pas enregistrées. Quitter quand même ?"))) return;
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

  const handleSaveSession = async (session: TrainingSession) => {
    if (!userId) throw new Error(t('Connecte-toi pour enregistrer ton entraînement.'));
    const owner=userId;
    const saved=await saveTrainingSession(owner,session);
    if(activeUserId.current!==owner)throw new Error(t('La connexion a changé.'));
    setWorkouts(previous=>previous.some(item=>item.id===saved.id)?previous.map(item=>item.id===saved.id?saved:item):[saved,...previous]);
  };
  const handleRemoveSession = async (id:string) => {
    if(!userId)return;
    const owner=userId;await removeTrainingSession(owner,id);
    if(activeUserId.current===owner)setWorkouts(previous=>previous.filter(item=>item.id!==id));
  };

  const handleBackToList = () => {
    if (savingWorkout) return;
    if (strengthPending && !confirm(t("Des modifications du bloc ne sont pas enregistrées. Quitter quand même ?"))) return;
    setView('list');
    setSelectedWorkout(null);
  };

  if (passwordRecovery) {
    return <ResetPassword ready={authReady} hasSession={!!currentUser} invalidLink={recoveryInvalid} onDone={() => { clearRecoveryLocation(); setPasswordRecovery(false); }} />;
  }

  if (!currentUser) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <AppShell pageKey={view} section={view==='strength'?'strength':view==='nutrition'?'nutrition':view==='statistics'?'statistics':'workouts'} email={currentUser} onLogout={handleLogout} navigationDisabled={savingWorkout} onNavigate={(section:AppSection)=>{
      if(savingWorkout)return;
      if(section==='workouts'){handleBackToList();return;}
      if(section!=='strength' && strengthPending && !confirm(t("Des modifications du bloc ne sont pas enregistrées. Quitter quand même ?")))return;
      if(section==='nutrition')setNutritionWeightFocus(false);
      if(section==='strength')setStrengthInitialTab('program');
      setView(section);
    }}>
        {view === 'statistics' && userId && <Suspense fallback={<div className="loading-panel" role="status"><span className="loading-spinner"/>{t('Chargement des statistiques…')}</div>}><Statistics key={userId} userId={userId} onNutrition={()=>{setNutritionWeightFocus(true);setView('nutrition');}} onStrength={()=>{setStrengthInitialTab('program');setView('strength');}} onManageMaxes={()=>{setStrengthInitialTab('maxes');setView('strength');}}/></Suspense>}
        {view === 'list' && userId && drafts.length > 0 && <section className="draft-list" aria-label={t('Brouillons de séances')}>
          <h2>{t('Brouillons de séances')}</h2>
          <p>{t('Tes saisies sont conservées sur cet appareil. Reprends-les pour les enregistrer dans ton compte.')}</p>
          {drafts.map(draft => <div className="draft-row" key={draft.workout.id}>
            <strong>{draft.workout.name || t('Nouvelle séance')}</strong>
            <button className="btn btn-primary btn-small" onClick={() => {
              setSelectedWorkout(draft.mode === 'edit' ? draft.workout : null);
              setView(draft.mode === 'edit' ? 'edit' : 'create');
            }}>{t('Reprendre')}</button>
            <button className="btn btn-secondary btn-small" onClick={() => {
              if (!confirm(t('Supprimer ce brouillon ? La séance déjà enregistrée ne sera pas supprimée.'))) return;
              try {
                removeWorkoutDraft(userId, draft.mode === 'edit' ? draft.workout.id : undefined);
                setDrafts(listWorkoutDrafts(userId));
              } catch { setLoadError(t('Suppression impossible.')); }
            }}>{t('Supprimer')}</button>
          </div>)}
        </section>}
        {view === 'nutrition' && userId && <Suspense fallback={<div className="loading-panel" role="status"><span className="loading-spinner" />{t('Chargement de ton journal nutrition…')}</div>}><Nutrition userId={userId} focusWeight={nutritionWeightFocus} /></Suspense>}
        {(view === 'strength' || view === 'list') && loadingWorkouts && <div className="loading-panel" role="status"><span className="loading-spinner" />{t('Chargement de tes entraînements…')}</div>}
        {(view === 'strength' || view === 'list') && loadError && <p role="alert">{loadError}</p>}
        {view === 'strength' && userId && !loadingWorkouts && !loadError && <Strength key={userId} initialTab={strengthInitialTab} userId={userId} workouts={workouts} onPendingChange={setStrengthPending} onRecordSession={(workout,week,prescriptionId)=>setSessionEntry({workout,week,prescriptionId})} onRemoveSession={handleRemoveSession} onSaved={saved => {
          setWorkouts(previous => previous.some(workout => workout.id === saved.id)
            ? previous.map(workout => workout.id === saved.id ? saved : workout)
            : [saved, ...previous]);
        }} />}
        {view === 'list' && !loadingWorkouts && !loadError && (
          <WorkoutList
            workouts={workouts.filter(workout => !getStrengthBlock(workout) && !isTrainingSessionRecord(workout))}
            sessions={trainingSessions(workouts)}
            trainingDays={buildStatistics({workouts,days:[]},'all').trainingDates.length}
            onComplete={workout=>setSessionEntry({workout})}
            onRemoveSession={handleRemoveSession}
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
            onUpdate={handleUpdateWorkout}
            onEdit={handleEditWorkout}
            onDelete={handleDeleteWorkout}
            onBack={handleBackToList}
            onComplete={workout=>setSessionEntry({workout})}
          />
        )}
        {(view === 'create' || view === 'edit') && userId && (
          <WorkoutForm
            key={`${userId}-${selectedWorkout?.id ?? 'new'}`}
            userId={userId}
            workout={selectedWorkout}
            workouts={workouts}
            onSave={handleSaveWorkout}
            onCancel={() => {
              setView('list');
              setSelectedWorkout(null);
            }}
          />
        )}
      {sessionEntry && userId && <TrainingSessionForm key={`${userId}-${sessionEntry.workout.id}`} workout={sessionEntry.workout} initialWeek={sessionEntry.week} initialPrescriptionId={sessionEntry.prescriptionId} onSave={handleSaveSession} onClose={()=>setSessionEntry(undefined)}/>}
    </AppShell>
  );
}

export default App;
