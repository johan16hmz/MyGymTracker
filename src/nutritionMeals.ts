import type { FoodEntry, Meal, NutritionDay, SavedMeal } from './nutrition';

export function validateSavedMeal(meal: SavedMeal): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meal.id) || typeof meal.name !== 'string' || !meal.name.trim() || meal.name.length > 100 || !['breakfast','lunch','snack','dinner'].includes(meal.meal) || !Array.isArray(meal.items) || !meal.items.length || meal.items.length > 100 || !Number.isFinite(Date.parse(meal.updatedAt)) || (meal.archived !== undefined && typeof meal.archived !== 'boolean')) throw new Error('Vérifie le nom et les aliments du repas enregistré.');
  for (const item of meal.items) {
    const food = item?.food;
    if (!food || typeof food.name !== 'string' || !food.name.trim() || !['g','ml'].includes(food.unit) || !['manual','ciqual','openfoodfacts'].includes(food.source) || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 10000 || ![food.kcal100,food.protein100,food.carbs100,food.fat100].every(value=>Number.isFinite(value) && value>=0) || food.kcal100>1000 || [food.protein100,food.carbs100,food.fat100].some(value=>value>100) || (food.fiber100!==undefined && (!Number.isFinite(food.fiber100) || food.fiber100<0 || food.fiber100>100))) throw new Error('Vérifie les quantités et les valeurs nutritionnelles du repas.');
  }
}

export function createSavedMeal(name: string, meal: Meal, items: SavedMeal['items'], id: string = crypto.randomUUID()): SavedMeal {
  const saved: SavedMeal = { id, name:name.trim(), meal, items:structuredClone(items.map(({food,quantity})=>({food,quantity}))), updatedAt:new Date().toISOString() };
  validateSavedMeal(saved);
  return saved;
}

export function savedMealEntries(saved: SavedMeal, meal: Meal): FoodEntry[] {
  validateSavedMeal(saved);
  if (saved.archived || !['breakfast','lunch','snack','dinner'].includes(meal)) throw new Error('Ce repas enregistré n’est plus disponible.');
  const addedAt = new Date().toISOString();
  return saved.items.map(item=>({id:crypto.randomUUID(),meal,food:structuredClone(item.food),quantity:item.quantity,addedAt}));
}

// Stable IDs make retries idempotent; all other meals, water, steps and weight stay intact.
export function appendMealEntries(day: NutritionDay, entries: FoodEntry[]): NutritionDay {
  const ids = new Set(day.entries.map(entry=>entry.id));
  return {...day,entries:[...day.entries,...entries.filter(entry=>{if(ids.has(entry.id))return false;ids.add(entry.id);return true;})]};
}
