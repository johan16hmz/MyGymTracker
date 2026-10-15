import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkoutList } from '../src/components/WorkoutList';
import { WorkoutDetail } from '../src/components/WorkoutDetail';
import { WorkoutForm } from '../src/components/WorkoutForm';
import { testedMaxRecord, testedMaxes, isTestedMaxRecord } from '../src/testedMaxes';
import { Strength } from '../src/components/Strength';
import { TrainingSessionForm } from '../src/components/TrainingSessionForm';
import { StatisticsDashboard } from '../src/components/Statistics';
import { Icon } from '../src/components/Icon';
import { trainingSessionRecord, trainingSessions, isTrainingSessionRecord } from '../src/trainingSessions';
import { localDate } from '../src/nutrition';
import { buildStatistics } from '../src/statistics';
import { createStrengthBlock } from '../src/strength';
import type { Workout, TrainingSession } from '../src/types';
import { statisticsFixture } from './statistics-fixture';
import { t, setLanguage, setWeightUnit, useLanguage, useWeightUnit } from '../src/i18n';
import '../src/ui.css';

const sample=statisticsFixture();
const today=localDate();
const models:Workout[]=[{id:'upper-model',name:'Haut du corps',date:'2026-08-01',exercises:[{id:'row',name:'Rowing',sets:[{id:'s1',weight:60,reps:10},{id:'s2',weight:60,reps:10}]}]},{id:'lower-model',name:'Bas du corps',date:'2026-08-02',exercises:[{id:'leg',name:'Presse à cuisses',sets:[{id:'s3',weight:150,reps:12}]}]}];
const newBlock:Workout={id:'current-block',name:'Mon bloc actuel',date:today,exercises:[{id:'block-now',name:'Bloc force',sets:[],strengthBlock:{...createStrengthBlock({pullup:35,bench:100,dips:40,squat:120},80),currentRank:1}}]};
models[0].exercises.push({id:'press-dumbbell',name:'Développé militaire haltères',sets:[1,2,3].map(i=>({id:`db-${i}`,weight:22,reps:8})),alternatives:[{id:'press-machine',name:'Développé militaire machine',sets:[1,2,3].map(i=>({id:`machine-${i}`,weight:45,reps:10}))}]});
models.push({id:'shoulder-model',name:'Épaules · machines',date:'2026-08-03',exercises:[{id:'shoulder-machine',name:'Développé militaire machine guidée',sets:[1,2,3].map(index=>({id:`shoulder-${index}`,weight:50,reps:10}))}]});
const maxSamples=[{version:1 as const,id:'max-bench-old',exerciseId:'bench',exercise:'Bench',weighted:false,weight:100,date:'2026-09-05',recordedAt:'2026-09-05T12:00:00Z',note:'Fin de bloc'},{version:1 as const,id:'max-bench-new',exerciseId:'bench',exercise:'Bench',weighted:false,weight:107.5,date:'2026-10-12',recordedAt:'2026-10-12T12:00:00Z',note:'Test réussi'}].map(value=>testedMaxRecord(value));

function Preview() {
  const lang=useLanguage();const unit=useWeightUnit();
  const [source,setSource]=useState({...sample,workouts:[newBlock,...models,...sample.workouts,...maxSamples]});
  const [view,setView]=useState<'workouts'|'force'|'statistics'|'detail'|'edit'|'create'>('force');
  const [editing,setEditing]=useState<Workout | null>(null);
  const [detail,setDetail]=useState<Workout>();
  const [entry,setEntry]=useState<{workout:Workout;week?:number;prescriptionId?:string}>();
  const [pending,setPending]=useState(false);
  const [fail,setFail]=useState(false);
  const [dark,setDark]=useState(false);
  const update=(workout:Workout)=>setSource(previous=>({...previous,workouts:previous.workouts.some(item=>item.id===workout.id)?previous.workouts.map(item=>item.id===workout.id?workout:item):[workout,...previous.workouts]}));
  const updateModel=async(workout:Workout)=>{if(fail){setFail(false);throw new Error('Échec simulé.');}update(workout);setDetail(previous=>previous?.id===workout.id?workout:previous);};
  const save=async(session:TrainingSession)=>{if(fail){setFail(false);throw new Error('Échec simulé : tes saisies restent conservées.');}update(trainingSessionRecord(session));};
  const savePlan=async(_userId:string,name:string,block:ReturnType<typeof createStrengthBlock>,existing?:Workout)=>{if(fail){setFail(false);throw new Error('Échec simulé : tes saisies restent conservées.');}const record:Workout={id:existing?.id ?? crypto.randomUUID(),name,date:existing?.date ?? today,exercises:[{id:existing?.exercises[0]?.id ?? crypto.randomUUID(),name:'Bloc force',sets:[],strengthBlock:block}]};update(record);return record;};
  const remove=async(id:string)=>setSource(previous=>({...previous,workouts:previous.workouts.filter(item=>item.id!==id)}));
  const navigate=(next:typeof view)=>{if(pending && !confirm('Les changements du bloc ne sont pas enregistrés. Quitter ?'))return;setView(next);};
  document.documentElement.dataset.theme=dark?'dark':'light';
  return <div className="app"><header className="app-header"><button className="brand" onClick={()=>navigate('workouts')}><span className="brand-mark"><img src="/brand-icon.svg" alt=""/></span><span>MyGym<span className="brand-light">Tracker</span><small>TRAINING JOURNAL</small></span></button><p className="nav-caption">APERÇU LOCAL</p><nav className="app-sections">
    <button className={`nav-item ${view==='workouts'||view==='detail'?'active':''}`} onClick={()=>navigate('workouts')}><Icon name="workout"/>{t('Séances')}</button>
    <button className={`nav-item ${view==='force'?'active':''}`} onClick={()=>navigate('force')}><Icon name="strength"/>{t('Force')}</button>
    <button className="nav-item" onClick={()=>alert('Cet aperçu porte sur les entraînements et les statistiques.')}><Icon name="nutrition"/>Nutrition</button>
    <button className={`nav-item ${view==='statistics'?'active':''}`} onClick={()=>navigate('statistics')}><Icon name="statistics"/>{t('Statistiques')}</button>
  </nav><div className="sidebar-note"><Icon name="check" size={28}/><p>Un modèle. Plusieurs entraînements.</p><span>Données fictives uniquement.</span></div></header><main className="app-main"><div className="workspace-topbar"><span>MYGYMTRACKER / {t(view==='force'?'Force':view==='statistics'?'Statistiques':'Séances')}</span><span className="workspace-status"><span/>Non publié</span></div>
    <div className="stats-preview-controls"><span>Démo locale · aucune connexion à ton compte, aucun envoi de données</span><button className="btn btn-small" onClick={()=>setFail(value=>!value)}>{fail?'Rétablir l’enregistrement':'Simuler un échec'}</button><button className="btn btn-small" onClick={()=>setDark(value=>!value)}>{dark?'Thème clair':'Thème sombre'}</button><button className="btn btn-small" onClick={()=>setLanguage(lang==='fr'?'en':'fr')}>{lang==='fr'?'English':'Français'}</button><button className="btn btn-small" onClick={()=>setWeightUnit(unit==='kg'?'lb':'kg')}>{unit==='kg'?'Passer en lb':'Passer en kg'}</button></div>
    {view==='workouts' && <WorkoutList workouts={source.workouts.filter(item=>!isTrainingSessionRecord(item) && !isTestedMaxRecord(item) && !item.exercises.some(ex=>ex.strengthBlock))} sessions={trainingSessions(source.workouts)} trainingDays={buildStatistics(source,'all').trainingDates.length} onNew={()=>{setEditing(null);setView('create');}} onView={workout=>{setDetail(workout);setView('detail');}} onEdit={workout=>{setEditing(workout);setView('edit');}} onDelete={id=>void remove(id)} onUpdate={updateModel} onComplete={workout=>setEntry({workout})} onRemoveSession={remove}/>}
    {(view==='edit'||view==='create') && <WorkoutForm key={editing?.id ?? 'new'} userId="local-variant-demo" workout={editing} workouts={source.workouts} onSave={async workout=>{await updateModel(workout);return true;}} onCancel={()=>setView('workouts')}/>}
    {view==='detail' && detail && <WorkoutDetail workout={detail} onUpdate={updateModel} onEdit={workout=>{setEditing(workout);setView('edit');}} onDelete={id=>{void remove(id);setView('workouts');}} onBack={()=>setView('workouts')} onComplete={workout=>setEntry({workout})}/>}
    {view==='force' && <Strength userId="local-demo" workouts={source.workouts} onSaved={update} onPendingChange={setPending} onRecordSession={(workout,week,prescriptionId)=>setEntry({workout,week,prescriptionId})} onRemoveSession={remove} saveBlock={savePlan} maxTests={testedMaxes(source.workouts)} onSaveMax={async value=>{await updateModel(testedMaxRecord(value));}} onRemoveMax={remove}/>}
    {view==='statistics' && <StatisticsDashboard source={source} onStrength={()=>navigate('force')} onNutrition={()=>alert('Les pesées de cette démonstration sont fictives.')}/>}
  </main>{entry && <TrainingSessionForm workout={entry.workout} initialWeek={entry.week} initialPrescriptionId={entry.prescriptionId} onSave={save} onClose={()=>setEntry(undefined)}/>}</div>;
}
createRoot(document.getElementById('app')!).render(<Preview/>);
