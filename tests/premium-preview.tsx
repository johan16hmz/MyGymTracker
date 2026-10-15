import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from '../src/components/AppShell';
import type { AppSection } from '../src/components/AppShell';
import { WorkoutList } from '../src/components/WorkoutList';
import { WorkoutDetail } from '../src/components/WorkoutDetail';
import { WorkoutForm } from '../src/components/WorkoutForm';
import { Strength } from '../src/components/Strength';
import { StatisticsDashboard } from '../src/components/Statistics';
import { TrainingSessionForm } from '../src/components/TrainingSessionForm';
import { PremiumNutritionDemo } from './premium-nutrition-demo';
import { statisticsFixture } from './statistics-fixture';
import { localDate } from '../src/nutrition';
import { buildStatistics } from '../src/statistics';
import { testedMaxes, testedMaxRecord, isTestedMaxRecord } from '../src/testedMaxes';
import { trainingSessions, trainingSessionRecord, isTrainingSessionRecord } from '../src/trainingSessions';
import { createStrengthBlock } from '../src/strength';
import type { Workout } from '../src/types';
import '../src/ui.css';

try{document.documentElement.dataset.theme=localStorage.getItem('mygymtracker-theme')==='dark'?'dark':'light';}catch{/* Device preference is optional. */}
const today=localDate();
const model=(id:string,name:string,exerciseNames:string[],date:string):Workout=>({id,name,date,exercises:exerciseNames.map((name,index)=>({id:`${id}-ex-${index}`,name,sets:Array.from({length:index%2?3:4},(_,i)=>({id:`${id}-set-${index}-${i}`,weight:[60,24,45,15,35][index%5],reps:index%2?10:8}))}))});
const models=[model('upper-a','Upper A · Pectoraux & dos',['Développé couché','Rowing haltère','Tirage vertical','Élévations latérales','Curl incliné'],'2026-10-10'),model('lower-a','Lower A · Quadriceps',['Squat','Presse à cuisses','Leg extension','Mollets debout'],'2026-10-09'),model('upper-b','Upper B · Épaules & bras',['Développé militaire haltères','Tractions','Dips','Curl barre'],'2026-10-08'),model('lower-b','Lower B · Chaîne postérieure',['Soulevé de terre','Leg curl allongé','Fentes bulgares','Mollets assis'],'2026-10-07'),model('machines','Machines · Alternatives',['Développé militaire machine','Chest press','Rowing machine'],'2026-10-06'),model('full-body','Full body · Essentiels',['Goblet squat','Développé incliné','Tirage horizontal'],'2026-10-05')];
models[2].exercises[0].alternatives=[{id:'military-machine',name:'Développé militaire machine',sets:[1,2,3,4].map(i=>({id:`military-alt-${i}`,weight:45,reps:8}))}];
const block:Workout={id:'current-block',name:'Bloc force · Automne',date:today,exercises:[{id:'current-plan',name:'Force',sets:[],strengthBlock:{...createStrengthBlock({bench:100,squat:120,pullup:35,dips:40},80),currentRank:1}}]};
const maxRecords=[{id:'tested-bench',exerciseId:'bench',exercise:'Bench',weight:100,date:'2026-09-15',weighted:false},{id:'tested-squat',exerciseId:'squat',exercise:'Squat',weight:120,date:'2026-09-20',weighted:false},{id:'tested-pullup',exerciseId:'pullup',exercise:'Tractions',weight:35,date:'2026-09-20',weighted:true}].map(value=>testedMaxRecord({version:1,...value,recordedAt:`${value.date}T12:00:00Z`,note:'Fin de bloc'}));

function Preview(){
  const [source,setSource]=useState(()=>({...statisticsFixture(),workouts:[block,...models,...statisticsFixture().workouts,...maxRecords]}));
  const [view,setView]=useState<AppSection|'detail'|'edit'|'create'>('workouts');
  const [selected,setSelected]=useState<Workout | null>(null);
  const [entry,setEntry]=useState<{workout:Workout;week?:number;prescriptionId?:string}>();
  const [pending,setPending]=useState(false);
  const [initialTab,setInitialTab]=useState<'program'|'maxes'>('program');
  const [weightFocus,setWeightFocus]=useState(false);
  const section:AppSection=['detail','edit','create'].includes(view)?'workouts':view as AppSection;
  const update=(workout:Workout)=>{setSource(previous=>({...previous,workouts:previous.workouts.some(item=>item.id===workout.id)?previous.workouts.map(item=>item.id===workout.id?workout:item):[workout,...previous.workouts]}));setSelected(previous=>previous?.id===workout.id?workout:previous);};
  const remove=async(id:string)=>setSource(previous=>({...previous,workouts:previous.workouts.filter(item=>item.id!==id)}));
  const navigate=(next:AppSection)=>{if(pending && next!=='strength' && !confirm('Des modifications du bloc ne sont pas enregistrées. Quitter ?'))return;if(next==='strength')setInitialTab('program');if(next==='nutrition')setWeightFocus(false);setView(next);};
  return <AppShell pageKey={view} section={section} onNavigate={navigate} preview overlay={entry && <TrainingSessionForm workout={entry.workout} initialWeek={entry.week} initialPrescriptionId={entry.prescriptionId} onSave={async session=>update(trainingSessionRecord(session))} onClose={()=>setEntry(undefined)}/>}>
    {view==='workouts' && <WorkoutList workouts={source.workouts.filter(item=>!isTrainingSessionRecord(item) && !isTestedMaxRecord(item) && !item.exercises.some(ex=>ex.strengthBlock))} sessions={trainingSessions(source.workouts)} trainingDays={buildStatistics(source,'all').trainingDates.length} onNew={()=>{setSelected(null);setView('create');}} onView={workout=>{setSelected(workout);setView('detail');}} onEdit={workout=>{setSelected(workout);setView('edit');}} onDelete={id=>void remove(id)} onUpdate={async workout=>update(workout)} onComplete={workout=>setEntry({workout})} onRemoveSession={remove}/>}
    {(view==='edit'||view==='create') && <WorkoutForm key={selected?.id ?? 'new'} userId="premium-ui-demo" workout={selected} workouts={source.workouts} onSave={async workout=>{update(workout);return true;}} onCancel={()=>setView('workouts')}/>}
    {view==='detail' && selected && <WorkoutDetail workout={selected} onUpdate={async workout=>update(workout)} onEdit={workout=>{setSelected(workout);setView('edit');}} onDelete={id=>{void remove(id);setView('workouts');}} onBack={()=>setView('workouts')} onComplete={workout=>setEntry({workout})}/>}
    {view==='strength' && <Strength userId="premium-ui-demo" initialTab={initialTab} workouts={source.workouts} maxTests={testedMaxes(source.workouts)} onSaveMax={async value=>update(testedMaxRecord(value))} onRemoveMax={remove} onSaved={update} onPendingChange={setPending} onRecordSession={(workout,week,prescriptionId)=>setEntry({workout,week,prescriptionId})} onRemoveSession={remove} saveBlock={async(_user,name,next,existing)=>{const workout={id:existing?.id ?? crypto.randomUUID(),name,date:existing?.date ?? today,exercises:[{id:existing?.exercises[0]?.id ?? crypto.randomUUID(),name:'Bloc force',sets:[],strengthBlock:next}]};update(workout);return workout;}}/>}
    {view==='nutrition' && <PremiumNutritionDemo focusWeight={weightFocus}/>}
    {view==='statistics' && <StatisticsDashboard source={source} onStrength={()=>navigate('strength')} onManageMaxes={()=>{setInitialTab('maxes');setView('strength');}} onNutrition={()=>{setWeightFocus(true);setView('nutrition');}}/>}
  </AppShell>;
}
createRoot(document.getElementById('app')!).render(<Preview/>);
