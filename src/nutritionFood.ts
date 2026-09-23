import type { Food } from './nutrition';

type OpenFoodFactsProduct = {
  code?: unknown;
  product_name?: unknown;
  product_name_fr?: unknown;
  brands?: unknown;
  quantity?: unknown;
  product_quantity_unit?: unknown;
  nutriments?: Record<string, unknown>;
};

function nutrient(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeOpenFoodFacts(json: unknown): (Omit<Food, 'kcal100' | 'protein100' | 'carbs100' | 'fat100'> & {
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
}) | null {
  if (!json || typeof json !== 'object') return null;
  const response = json as { status?: unknown; product?: OpenFoodFactsProduct };
  if (response.status !== 1 || !response.product) return null;
  const product = response.product;
  const name = [product.product_name_fr, product.product_name].find(value => typeof value === 'string' && value.trim());
  if (typeof name !== 'string') return null;
  const nutriments = product.nutriments ?? {};
  const calories = nutrient(nutriments['energy-kcal_100g']);
  const energyKj = nutrient(nutriments.energy_100g);
  const unit = product.product_quantity_unit === 'ml' || (typeof product.quantity === 'string' && /\bml\b/i.test(product.quantity)) ? 'ml' : 'g';
  return {
    name: name.trim(),
    brand: typeof product.brands === 'string' ? product.brands.trim() : undefined,
    barcode: typeof product.code === 'string' ? product.code : undefined,
    source: 'openfoodfacts',
    unit,
    kcal100: calories ?? (energyKj === null ? null : energyKj / 4.184),
    protein100: nutrient(nutriments.proteins_100g),
    carbs100: nutrient(nutriments.carbohydrates_100g),
    fat100: nutrient(nutriments.fat_100g),
  };
}

export async function lookupFood(barcode: string) {
  if (!/^\d{8,14}$/.test(barcode)) throw new Error('Entre un code-barres de 8 à 14 chiffres.');
  const response = await fetch(`/api/food?barcode=${encodeURIComponent(barcode)}`);
  const json = await response.json();
  if (!response.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Recherche indisponible.');
  const food = normalizeOpenFoodFacts(json);
  if (!food) throw new Error('Aliment introuvable. Tu peux l’ajouter manuellement.');
  return food;
}
