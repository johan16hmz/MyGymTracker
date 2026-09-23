export type NutritionGoal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'low' | 'moderate' | 'active' | 'veryActive';
export type EquationSex = 'female' | 'male';
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const NUTRITION_PROFILE_NAME = '__nutrition_profile__';
export const NUTRITION_DAY_NAME = '__nutrition_day__';

export interface NutritionProfile {
  goal: NutritionGoal;
  targetKg: number;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  equationSex: EquationSex;
  calorieOverride?: number;
}

export interface Food {
  name: string;
  brand?: string;
  barcode?: string;
  source: 'openfoodfacts' | 'manual';
  unit: 'g' | 'ml';
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
}

export interface FoodEntry {
  id: string;
  meal: Meal;
  food: Food;
  quantity: number;
  addedAt: string;
}

export interface NutritionDay {
  date: string;
  entries: FoodEntry[];
}

const activityFactors: Record<ActivityLevel, number> = {
  low: 1.2,
  moderate: 1.35,
  active: 1.5,
  veryActive: 1.65,
};

export function estimateCalories(profile: NutritionProfile) {
  const { age, heightCm, weightKg, targetKg, activity, equationSex, goal } = profile;
  if (![age, heightCm, weightKg, targetKg].every(Number.isFinite) || age < 18 || age > 100 || heightCm < 100 || heightCm > 250 || weightKg < 25 || weightKg > 400 || targetKg < 25 || targetKg > 400) {
    throw new Error('Renseigne des valeurs valides pour un adulte.');
  }
  if ((goal === 'lose' && targetKg >= weightKg) || (goal === 'gain' && targetKg <= weightKg) || (goal === 'maintain' && Math.abs(targetKg - weightKg) > 0.1)) {
    throw new Error('Le poids visé doit correspondre à ton objectif.');
  }
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (equationSex === 'male' ? 5 : -161);
  const maintenance = bmr * activityFactors[activity];
  if (!Number.isFinite(maintenance)) throw new Error('Fréquence d’entraînement invalide.');
  if (goal === 'lose' && maintenance <= 1200) throw new Error('Estimation trop basse pour proposer une perte de poids automatiquement. Demande un avis professionnel.');
  const adjustment = Math.min(300, maintenance * 0.1);
  const estimated = goal === 'lose' ? Math.max(1200, bmr, maintenance - adjustment) : goal === 'gain' ? maintenance + adjustment : maintenance;
  return { bmr: Math.round(bmr), maintenance: Math.round(maintenance / 10) * 10, target: Math.round(estimated / 10) * 10 };
}

export function foodTotals(food: Food, quantity: number) {
  const factor = quantity / 100;
  return {
    kcal: food.kcal100 * factor,
    protein: food.protein100 * factor,
    carbs: food.carbs100 * factor,
    fat: food.fat100 * factor,
  };
}

export function sumEntries(entries: FoodEntry[]) {
  return entries.reduce((sum, entry) => {
    const amount = foodTotals(entry.food, entry.quantity);
    return { kcal: sum.kcal + amount.kcal, protein: sum.protein + amount.protein, carbs: sum.carbs + amount.carbs, fat: sum.fat + amount.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
