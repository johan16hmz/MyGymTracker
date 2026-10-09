// Local, fictitious data only. No database, account or Health writes.
import type { StatsSource } from '../src/statistics';
import type { StrengthBlock } from '../src/strength';
import { localDate } from '../src/nutrition';
import { shiftDate } from '../src/statistics';

export function statisticsFixture(today=localDate()): StatsSource {
  const lifts=[{id:'bench',name:'Bench',base:72.5,step:2.5,weighted:false},{id:'pullup',name:'Tractions',base:10,step:1.25,weighted:true},{id:'squat',name:'Squat',base:90,step:2.5,weighted:false},{id:'dips',name:'Dips',base:15,step:1.25,weighted:true}];
  const block:StrengthBlock={version:1,bodyWeight:80,exercises:lifts.map(lift=>({id:lift.id,name:lift.name,step:lift.step,weighted:lift.weighted,target:lift.base+30,prescriptions:Array.from({length:10},(_,index)=>({id:`${lift.id}-${index}`,week:index+1,reps:3,rpe:8,sets:3,weight:lift.base+index*lift.step,performances:[3,5].flatMap(reps=>Array.from({length:3},()=>({weight:lift.base+index*lift.step-(reps===5?lift.step:0),reps,rpe:8,note:'',date:`${shiftDate(today,-66+index*7)}T16:00:00Z`}))) }))}))};
  return {workouts:[{id:'fixture-force',name:'Cycle de progression',date:shiftDate(today,-70),exercises:[{id:'block',name:'Bloc force',sets:[],strengthBlock:block}]},...Array.from({length:18},(_,index)=>({id:`session-${index}`,name:index%2?'Upper body':'Lower body',date:shiftDate(today,-65+index*3),exercises:[{id:'row',name:'Rowing',sets:[{id:'set',weight:45+index,reps:10}]}]}))],profile:{goal:'gain',weightKg:80.4,targetKg:84,age:25,heightCm:180,equationSex:'male',activity:'active'},days:Array.from({length:19},(_,index)=>({date:shiftDate(today,-65+index*3),entries:[],weightKg:Math.round((78.4+index*.09+(index%3===0?.2:0))*10)/10}))};
}
