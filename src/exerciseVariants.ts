import type { Exercise, ExerciseVariant, Workout } from './types';

export function workoutExerciseBank(workouts: Workout[]): Workout[] {
  const reserved = ['__nutrition_profile__','__nutrition_day__','__nutrition_meal__','__training_session__','__strength_tested_max__'];
  return workouts.filter(workout => !reserved.includes(workout.name) && !workout.exercises.some(exercise => exercise.strengthBlock || exercise.trainingSession || exercise.testedMax || exercise.nutritionDay || exercise.nutritionProfile || exercise.nutritionMeal));
}

// A cross-session alternative is an independent snapshot, never a live link.
// New IDs also prevent quick editing a copied set from touching its source.
export function copyExerciseVariant(exercise: Exercise, source: ExerciseVariant, newId: () => string = () => crypto.randomUUID()): Exercise {
  const variant = { id: newId(), name: source.name, sets: source.sets.map(set => ({ ...set, id: newId() })) };
  return { ...exercise, alternatives: [...(exercise.alternatives ?? []), variant] };
}

export function exerciseVariants(exercise: Exercise): ExerciseVariant[] {
  return [{ id: exercise.activeVariantId ?? exercise.id, name: exercise.name, sets: exercise.sets }, ...(exercise.alternatives ?? [])];
}

export function selectExerciseVariant(exercise: Exercise, id: string): Exercise {
  const variants = exerciseVariants(exercise);
  const selected = variants.find(variant => variant.id === id);
  if (!selected || selected.id === variants[0].id) return exercise;
  return { ...exercise, activeVariantId: selected.id, name: selected.name, sets: selected.sets, alternatives: variants.filter(variant => variant.id !== id) };
}

export function removeExerciseVariant(exercise: Exercise, id: string): Exercise {
  const variants=exerciseVariants(exercise);
  if(variants.length<2 || !variants.some(variant=>variant.id===id))return exercise;
  const active=variants[0].id===id?selectExerciseVariant(exercise,variants[1].id):exercise;
  return {...active,alternatives:(active.alternatives ?? []).filter(variant=>variant.id!==id)};
}

export function addExerciseVariant(exercise: Exercise, name: string, id: string = crypto.randomUUID()): Exercise {
  if (!name.trim() || exerciseVariants(exercise).some(variant => variant.id === id)) throw new Error('Vérifie le nom de la variante.');
  const variant: ExerciseVariant = { id, name: name.trim(), sets: exercise.sets.map(set => ({ ...set, id: crypto.randomUUID(), weight: 0 })) };
  return selectExerciseVariant({ ...exercise, alternatives: [...(exercise.alternatives ?? []), variant] }, id);
}

// Moving existing entries into a slot preserves every load, rep range and ID.
// Only the chosen variant stays at the top level, so sets are never summed.
export function groupExerciseVariants(exercises: Exercise[], targetId: string, sourceId: string): Exercise[] {
  const target = exercises.find(exercise => exercise.id === targetId);
  const source = exercises.find(exercise => exercise.id === sourceId);
  if (!target || !source || target === source) return exercises;
  const variants = exerciseVariants(source);
  const ids = new Set(exerciseVariants(target).map(variant => variant.id));
  if (variants.some(variant => ids.has(variant.id))) throw new Error('Ces variantes sont déjà associées.');
  return exercises.filter(exercise => exercise.id !== sourceId).map(exercise => exercise.id === targetId ? { ...exercise, alternatives: [...(exercise.alternatives ?? []), ...variants] } : exercise);
}

export function ungroupExerciseVariant(exercises: Exercise[], exerciseId: string, variantId: string, id: string = crypto.randomUUID()): Exercise[] {
  const exercise = exercises.find(item => item.id === exerciseId);
  const variant = exercise?.alternatives?.find(item => item.id === variantId);
  if (!exercise || !variant) return exercises;
  return [...exercises.map(item => item.id === exerciseId ? { ...item, alternatives: item.alternatives?.filter(alt => alt.id !== variantId) } : item), { ...variant, id, activeVariantId: variant.id }];
}
