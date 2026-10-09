export type NutritionGoal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'low' | 'moderate' | 'active' | 'veryActive';
export type EquationSex = 'female' | 'male';
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const NUTRITION_PROFILE_NAME = '__nutrition_profile__';
export const NUTRITION_DAY_NAME = '__nutrition_day__';

export interface NutritionProfile {
  weightHistory?: { date: string; weightKg: number }[];
  goal: NutritionGoal;
  targetKg: number;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  equationSex: EquationSex;
  calorieOverride?: number;
  fiberGoal?: number;
  stepGoal?: number;
  baselineSteps?: number;
  adjustForSteps?: boolean;
}

export interface FoodPortion { label: string; quantity: number }
export interface Food {
  id?: string;
  name: string;
  nameEn?: string;
  brand?: string;
  description?: string;
  kind?: 'drink' | 'fresh-fruit';
  barcode?: string;
  source: 'openfoodfacts' | 'ciqual' | 'manual';
  unit: 'g' | 'ml';
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  fiber100?: number;
  servingQuantity?: number;
  servingLabel?: string;
}

export interface FoodEntry {
  id: string;
  meal: Meal;
  food: Food;
  quantity: number;
  addedAt: string;
}

export interface NutritionDay {
  weightKg?: number;
  date: string;
  entries: FoodEntry[];
  steps?: { count: number; source: 'manual' | 'apple-shortcuts'; updatedAt: string };
  waterMl?: number;
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
    fiber: (food.fiber100 ?? 0) * factor,
  };
}

export function sumEntries(entries: FoodEntry[]) {
  return entries.reduce((sum, entry) => {
    const amount = foodTotals(entry.food, entry.quantity);
    return { kcal: sum.kcal + amount.kcal, protein: sum.protein + amount.protein, carbs: sum.carbs + amount.carbs, fat: sum.fat + amount.fat, fiber: sum.fiber + amount.fiber };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}

// Walking estimate, not a wearable measurement. Only EXTRA steps count: the
// activity factor in the profile already includes a typical day's activity.
// 3.8 MET walking at ~4.8 km/h, minus 1 resting MET (2024 Adult Compendium).
// Step length = height × 0.414 is an explicit approximation; cap the bonus.
export function stepEnergy(profile: NutritionProfile, count: number) {
  const steps = Number.isFinite(count) ? Math.max(0, Math.min(100000, Math.round(count))) : 0;
  const baseline = profile.baselineSteps ?? 5000;
  const distanceKm = steps * profile.heightCm * 0.414 / 100000;
  const extraKm = Math.max(0, steps - baseline) * profile.heightCm * 0.414 / 100000;
  const bonus = profile.adjustForSteps ? Math.min(600, Math.round(2.8 * profile.weightKg * extraKm / 4.8)) : 0;
  return { distanceKm, bonus, extraSteps: Math.max(0, steps - baseline) };
}

export function defaultPortions(food: Pick<Food, 'name' | 'unit' | 'kind' | 'servingQuantity' | 'servingLabel'>): FoodPortion[] {
  const name = food.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const portions: FoodPortion[] = [];
  if (food.servingQuantity && Number.isFinite(food.servingQuantity) && food.servingQuantity > 0 && food.servingQuantity <= 10000) {
    portions.push({ label: food.servingLabel || 'Portion de l’étiquette', quantity: food.servingQuantity });
  } else if (food.unit === 'ml' || food.kind === 'drink') portions.push({ label: 'Portion de départ', quantity: food.unit === 'ml' ? 250 : 100 });
  else if (/^(bananes?|bananas?)\b/.test(name) && !/jus|seche|dried|chips|gateau|nectar|plantain/.test(name)) portions.push({ label: '1 banane moyenne', quantity: 120 });
  else if (/^(pomme|apple)[, ]/.test(name) && !/jus|compote|seche|dried/.test(name)) portions.push({ label: '1 pomme moyenne', quantity: 150 });
  else if (/^(oeuf|œuf|egg)\b/.test(name) && !/poudre|omelette|chocolat/.test(name)) portions.push({ label: '1 œuf', quantity: 50 });
  else if (/^(yaourt|yogurt|skyr)\b/.test(name)) portions.push({ label: '1 pot', quantity: 125 });
  else if (/^(huile|oil)\b/.test(name)) portions.push({ label: '1 cuillère à soupe', quantity: 10 });
  else if (/^flocon|^oat flakes/.test(name)) portions.push({ label: '1 bol', quantity: 40 });
  else if (/^(pain|bread)\b/.test(name)) portions.push({ label: '1 tranche', quantity: 30 });
  else portions.push({ label: 'Portion de départ', quantity: 100 });
  for (const quantity of food.unit === 'ml' ? [100, 200, 250, 500] : [50, 100, 150, 200]) {
    if (!portions.some(portion => portion.quantity === quantity)) portions.push({ label: `${quantity} ${food.unit}`, quantity });
  }
  return portions.slice(0, 5);
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
