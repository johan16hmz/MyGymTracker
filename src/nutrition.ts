export type NutritionGoal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'low' | 'moderate' | 'active' | 'veryActive';
export type EquationSex = 'female' | 'male';
export type DailyActivity = 'sedentary' | 'light' | 'moderate' | 'high';
export type TrainingKind = 'strength' | 'strengthHard' | 'cardio' | 'mixed';
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
  dailyActivity?: DailyActivity;
  sessionsPerWeek?: number;
  sessionMinutes?: number;
  trainingKind?: TrainingKind;
  goalDate?: string;
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
const dailyFactors:Record<DailyActivity,number>={sedentary:1.2,light:1.35,moderate:1.5,high:1.7};
const trainingMets:Record<TrainingKind,number>={strength:3.5,strengthHard:6,cardio:5,mixed:5};
export function trainingActivity(sessions:number):ActivityLevel { return sessions<=1?'low':sessions<=3?'moderate':sessions<=5?'active':'veryActive'; }

function calendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choisis une date cible valide.');
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new Error('Choisis une date cible valide.');
  return timestamp / 86400000;
}

export function goalDateInWeeks(weeks: number, today = localDate()) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 156) throw new Error('Choisis une durée entre 1 et 156 semaines.');
  return new Date((calendarDay(today) + weeks * 7) * 86400000).toISOString().slice(0, 10);
}

export function goalDateInMonths(months: number, today = localDate()) {
  if (!Number.isInteger(months) || months < 1 || months > 36) throw new Error('Choisis une durée entre 1 et 36 mois.');
  const start = new Date(calendarDay(today) * 86400000);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months + 1, 0));
  end.setUTCDate(Math.min(start.getUTCDate(), end.getUTCDate()));
  return end.toISOString().slice(0, 10);
}

function remainingMonths(today: string, goalDate: string) {
  const start = new Date(calendarDay(today) * 86400000);
  const end = new Date(calendarDay(goalDate) * 86400000);
  if (end <= start) return 0;
  let whole = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  const anchor = (months: number) => months ? calendarDay(goalDateInMonths(months, today)) : calendarDay(today);
  if (anchor(whole) > calendarDay(goalDate)) whole--;
  if (anchor(whole) === calendarDay(goalDate)) return whole;
  return whole + (calendarDay(goalDate) - anchor(whole)) / (anchor(whole + 1) - anchor(whole));
}

export function estimateCalories(profile: NutritionProfile, today = localDate()) {
  const { age, heightCm, weightKg, targetKg, activity, equationSex, goal } = profile;
  if (![age, heightCm, weightKg, targetKg].every(Number.isFinite) || age < 18 || age > 100 || heightCm < 100 || heightCm > 250 || weightKg < 25 || weightKg > 400 || targetKg < 25 || targetKg > 400) {
    throw new Error('Renseigne des valeurs valides pour un adulte.');
  }
  if ((goal === 'lose' && targetKg >= weightKg) || (goal === 'gain' && targetKg <= weightKg) || (goal === 'maintain' && Math.abs(targetKg - weightKg) > 0.1)) {
    throw new Error('Le poids visé doit correspondre à ton objectif.');
  }
  if(!['male','female'].includes(equationSex))throw new Error('Choisis une formule de calcul.');
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (equationSex === 'male' ? 5 : -161);
  let maintenance = bmr * activityFactors[activity];
  let trainingDaily=0;
  const refined=[profile.dailyActivity,profile.sessionsPerWeek,profile.sessionMinutes,profile.trainingKind].some(value=>value!==undefined);
  if(refined){
    if(!profile.dailyActivity || !Object.hasOwn(dailyFactors,profile.dailyActivity) || !Number.isInteger(profile.sessionsPerWeek) || profile.sessionsPerWeek!<0 || profile.sessionsPerWeek!>14)throw new Error('Vérifie ton activité quotidienne et le nombre de séances.');
    if(profile.sessionsPerWeek!>0){
      if(!profile.trainingKind || !Object.hasOwn(trainingMets,profile.trainingKind) || !Number.isFinite(profile.sessionMinutes) || profile.sessionMinutes!<10 || profile.sessionMinutes!>180)throw new Error('Vérifie le type et la durée de tes entraînements.');
      // Net average exercise energy: rest is already in the daily baseline.
      trainingDaily=(trainingMets[profile.trainingKind]-1)*weightKg*(profile.sessionMinutes!/60)*profile.sessionsPerWeek!/7;
    }
    maintenance=bmr*dailyFactors[profile.dailyActivity]+trainingDaily;
  }
  if (!Number.isFinite(maintenance)) throw new Error('Fréquence d’entraînement invalide.');
  if (goal === 'lose' && maintenance <= 1200) throw new Error('Estimation trop basse pour proposer une perte de poids automatiquement. Demande un avis professionnel.');
  let adjustment = Math.min(300, maintenance * 0.1);
  let timeline: { daysRemaining: number; monthsRemaining: number; requestedMonthlyKg: number; requestedMonthlyPercent: number; requestedWeeklyKg: number; requestedPercent: number; limited: boolean; expired: boolean } | undefined;
  if (goal !== 'maintain' && profile.goalDate) {
    const daysRemaining = calendarDay(profile.goalDate) - calendarDay(today);
    if (calendarDay(profile.goalDate) > calendarDay(goalDateInMonths(36, today))) throw new Error('Choisis une durée entre 1 et 36 mois.');
    const expired = daysRemaining <= 0;
    const requestedWeeklyKg = expired ? 0 : Math.abs(targetKg - weightKg) * 7 / daysRemaining;
    const requestedPercent = requestedWeeklyKg / weightKg * 100;
    // App heuristic: requested weekly change as a fraction of body mass × 20
    // sets a starting energy adjustment, NOT a physiological weight forecast.
    // Conservative limits: gain 10%, loss 20%, absolute 500 kcal, plus loss floor.
    const requested = maintenance * requestedWeeklyKg / weightKg * 20;
    const maxWeeklyKg = goal === 'gain' ? weightKg * .005 : Math.min(weightKg * .01, .9);
    const cap = Math.min(500, maintenance * (goal === 'gain' ? .1 : .2), maintenance * maxWeeklyKg / weightKg * 20, goal === 'lose' ? Math.max(0, maintenance - Math.max(1200, bmr)) : Infinity);
    adjustment = expired ? 0 : Math.min(requested, cap);
    const monthsRemaining = remainingMonths(today, profile.goalDate);
    const requestedMonthlyKg = expired ? 0 : Math.abs(targetKg - weightKg) / monthsRemaining;
    timeline = { daysRemaining, monthsRemaining, requestedMonthlyKg, requestedMonthlyPercent: requestedMonthlyKg / weightKg * 100, requestedWeeklyKg, requestedPercent, expired, limited: !expired && (requested > cap + .01 || requestedPercent > (goal === 'gain' ? .5 : 1) || (goal === 'lose' && requestedWeeklyKg > .9)) };
  }
  const estimated = goal === 'lose' ? Math.max(1200, bmr, maintenance - adjustment) : goal === 'gain' ? maintenance + adjustment : maintenance;
  return { bmr: Math.round(bmr), maintenance: Math.round(maintenance / 10) * 10, target: Math.round(estimated / 10) * 10, trainingDaily:Math.round(trainingDaily), refined, timeline, adjustment: Math.round(estimated / 10) * 10 - Math.round(maintenance / 10) * 10 };
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

// Research-informed app heuristics for healthy adults, not a clinical formula:
// protein coefficients reflect goal / training; age, height and equation already
// influence the calorie estimate. Fat uses 30% energy for regular training,
// 35% for low activity; carbohydrates receive the remaining 4/4/9 energy budget.
export function macroTargets(profile: NutritionProfile, calories:number) {
  const energy=Number.isFinite(calories)?Math.max(0,calories):0;
  const fiber=profile.fiberGoal!==undefined && Number.isFinite(profile.fiberGoal) && profile.fiberGoal>=10 && profile.fiberGoal<=100 ? profile.fiberGoal : 30;
  if(!energy || !Number.isFinite(profile.weightKg) || profile.weightKg<25 || profile.weightKg>400)return {protein:0,carbs:0,fat:0,fiber,proteinPerKg:0,proteinLimited:false};
  const activity=Number.isInteger(profile.sessionsPerWeek) && profile.sessionsPerWeek!>=0 && profile.sessionsPerWeek!<=14 ? trainingActivity(profile.sessionsPerWeek!) : profile.activity;
  const low=activity==='low';
  const high=activity==='active' || activity==='veryActive';
  const proteinPerKg=profile.goal==='gain' ? low?1.6:activity==='veryActive'?2:1.8 : profile.goal==='lose' ? low?1.4:high?2:1.8 : low?1.2:1.6;
  const requestedProtein=profile.weightKg*proteinPerKg;
  const proteinBudget=energy*.35/4;
  const protein=Math.round(Math.min(requestedProtein,proteinBudget));
  const fat=Math.round(energy*(low?.35:.30)/9);
  const carbs=Math.max(0,Math.round((energy-protein*4-fat*9)/4));
  return {protein,carbs,fat,fiber,proteinPerKg,proteinLimited:requestedProtein>proteinBudget};
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
