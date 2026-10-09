import type { Workout } from './types';
import type { NutritionDay, NutritionProfile } from './nutrition';
import { localDate } from './nutrition';

export type StatsPeriod = '28' | '84' | '180' | 'all';
export interface StrengthLog {
  date: string; exerciseId: string; exercise: string; block: string;
  weight: number; reps: number; rpe: number; weighted: boolean; note: string;
}
export interface WeightPoint { date: string; weightKg: number }
export interface StatsSource { workouts: Workout[]; profile?: NutritionProfile; days: NutritionDay[] }

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function shiftDate(date: string, offset: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + offset);
  return next.toISOString().slice(0, 10);
}
export function weekStart(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}
export function strengthLogs(workouts: Workout[], today = localDate()): StrengthLog[] {
  const logs: StrengthLog[] = [];
  for (const workout of workouts) {
    const block = workout.exercises.find(exercise => exercise.strengthBlock)?.strengthBlock;
    for (const exercise of block?.exercises ?? []) for (const row of exercise.prescriptions) {
      // A prescription is a plan, not a completed set. Only performances count.
      for (const performance of row.performances ?? []) {
        if (typeof performance.date !== 'string' || !validDate(performance.date.slice(0, 10)) || !Number.isFinite(Date.parse(performance.date))) continue;
        const date = localDate(new Date(performance.date.length === 10 ? `${performance.date}T12:00:00` : performance.date));
        if (date > today || !Number.isFinite(performance.weight) || performance.weight < 0 || !Number.isInteger(performance.reps) || performance.reps < 1) continue;
        logs.push({ date, exerciseId: exercise.id, exercise: exercise.name, block: workout.name, weight: performance.weight, reps: performance.reps, rpe: performance.rpe, weighted: exercise.weighted, note: performance.note });
      }
    }
  }
  return logs.sort((a, b) => a.date.localeCompare(b.date));
}
export function weightPoints(profile: NutritionProfile | undefined, days: NutritionDay[], today = localDate()): WeightPoint[] {
  const points = new Map<string, WeightPoint>();
  for (const item of [...(profile?.weightHistory ?? []), ...days.map(day => ({ date: day.date, weightKg: day.weightKg }))]) {
    if (validDate(item.date) && item.date <= today && Number.isFinite(item.weightKg) && item.weightKg! >= 25 && item.weightKg! <= 400) points.set(item.date, { date: item.date, weightKg: item.weightKg! });
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function loadPoints(logs: StrengthLog[], exerciseId: string, reps: number | 'all') {
  const byDay = new Map<string, StrengthLog>();
  for (const log of logs.filter(log => log.exerciseId === exerciseId && (reps === 'all' || log.reps === reps))) {
    const previous = byDay.get(log.date);
    if (!previous || log.weight > previous.weight || (log.weight === previous.weight && log.reps > previous.reps)) byDay.set(log.date, log);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function buildStatistics(source: StatsSource, period: StatsPeriod, today = localDate()) {
  const allLogs = strengthLogs(source.workouts, today);
  const allWeights = weightPoints(source.profile, source.days, today);
  const ordinary = source.workouts.filter(workout => !workout.exercises.some(ex => ex.strengthBlock || ex.nutritionDay || ex.nutritionProfile) && validDate(workout.date) && workout.date <= today && workout.exercises.some(ex => ex.sets.some(set => Number.isInteger(set.reps) && set.reps > 0 && Number.isFinite(set.weight) && set.weight >= 0)));
  const dates = [...allLogs.map(log => log.date), ...allWeights.map(point => point.date), ...ordinary.map(workout => workout.date)].sort();
  const start = period === 'all' ? dates[0] ?? today : shiftDate(today, 1 - Number(period));
  const logs = allLogs.filter(log => log.date >= start);
  const weights = allWeights.filter(point => point.date >= start);
  const workouts = ordinary.filter(workout => workout.date >= start);
  const trainingDates = [...new Set([...logs.map(log => log.date), ...workouts.map(workout => workout.date)])].sort();
  const weeks: { date: string; days: number; sets: number; volume: number }[] = [];
  const groupedLogs = new Map<string, StrengthLog[]>();
  for (const log of logs) { const key = weekStart(log.date); groupedLogs.set(key, [...(groupedLogs.get(key) ?? []), log]); }
  const groupedDays = new Map<string, number>();
  for (const date of trainingDates) { const key = weekStart(date); groupedDays.set(key, (groupedDays.get(key) ?? 0) + 1); }
  for (let date = weekStart(start); date <= today; date = shiftDate(date, 7)) {
    const weekLogs = groupedLogs.get(date) ?? [];
    weeks.push({ date, days: groupedDays.get(date) ?? 0, sets: weekLogs.length, volume: weekLogs.reduce((sum, log) => sum + log.weight * log.reps, 0) });
  }
  const exercises = [...new Map(allLogs.map(log => [log.exerciseId, { id: log.exerciseId, name: log.exercise, weighted: log.weighted }])).values()];
  for (const workout of source.workouts) for (const exercise of workout.exercises.find(ex => ex.strengthBlock)?.strengthBlock?.exercises ?? []) {
    if (!exercises.some(item => item.id === exercise.id)) exercises.push({ id: exercise.id, name: exercise.name, weighted: exercise.weighted });
  }
  const records = exercises.map(exercise => {
    const exerciseLogs = logs.filter(log => log.exerciseId === exercise.id);
    const best = [...exerciseLogs].sort((a, b) => b.weight - a.weight || b.reps - a.reps || b.date.localeCompare(a.date))[0];
    return { ...exercise, best, sets: exerciseLogs.length, volume: exerciseLogs.reduce((sum, log) => sum + log.weight * log.reps, 0) };
  });
  return { start, today, logs, weights, workouts, trainingDates, weeks, exercises, records, activeWeeks: weeks.filter(week => week.days > 0).length, latestWeight: allWeights.at(-1)?.weightKg ?? source.profile?.weightKg, volume: logs.reduce((sum, log) => sum + log.weight * log.reps, 0) };
}

export function profileWithWeightHistory(profile: NutritionProfile, previous?: NutritionProfile, date = localDate()): NutritionProfile {
  // A legacy profile has no measurement date: never backdate its weight.
  const history = weightPoints(previous, [], date).filter(point => point.date !== date);
  return { ...profile, weightHistory: [...history, { date, weightKg: profile.weightKg }] };
}
