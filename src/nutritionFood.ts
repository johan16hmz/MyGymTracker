import type { Food } from './nutrition';

type OpenFoodFactsProduct = {
  code?: unknown;
  product_name?: unknown;
  product_name_fr?: unknown;
  generic_name?: unknown;
  generic_name_fr?: unknown;
  categories_tags?: unknown;
  brands?: unknown;
  quantity?: unknown;
  product_quantity_unit?: unknown;
  serving_size?: unknown;
  serving_quantity?: unknown;
  nutriments?: Record<string, unknown>;
};

function nutrient(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export type FoodCandidate = Omit<Food, 'kcal100' | 'protein100' | 'carbs100' | 'fat100'> & {
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
};

const beverageWords = /\b(nectar|jus|smoothie|boisson|soda|juice|drink|beverage)\b/;
const beverageName = /^(?:(?:le|la|the)\s+)?(?:nectar|jus|smoothie|boisson|soda|juice|drink|beverage)\b/;
const bareFruitName = /^(bananes?|bananas?|pommes?|apples?|poires?|pears?|oranges?|mangues?|mangos?|fraises?|strawberries|peches?|peaches|ananas)$/;

function productKind(product:OpenFoodFactsProduct, name:string, description?:string): Food['kind'] {
  const categories=Array.isArray(product.categories_tags) ? product.categories_tags.filter((category):category is string=>typeof category==='string') : [];
  // Exact taxonomy entries: "plant-based-foods-and-beverages" alone does not
  // mean a drink, and a liquid cooking oil is not a beverage either.
  if(categories.includes('en:beverages') || beverageName.test(normalizeFoodName(name)) || beverageName.test(normalizeFoodName(description ?? '')))return 'drink';
  if((categories.includes('en:fresh-fruits') || categories.includes('en:fruits')) && !categories.some(category=>/dried|canned|cooked|puree|compote|jam|frozen/.test(category)) && !/\b(seche|dried|chips|compote|confiture|puree|cuit)\b/.test(normalizeFoodName(name)))return 'fresh-fruit';
  return undefined;
}

export function normalizeOpenFoodFacts(json: unknown): FoodCandidate | null {
  if (!json || typeof json !== 'object') return null;
  const response = json as { status?: unknown; product?: OpenFoodFactsProduct };
  if (response.status !== 1 || !response.product) return null;
  const product = response.product;
  const rawName = [product.product_name_fr, product.product_name].find(value => typeof value === 'string' && value.trim());
  if (typeof rawName !== 'string') return null;
  const genericName = [product.generic_name_fr,product.generic_name].find(value=>typeof value==='string' && value.trim());
  const description = typeof genericName==='string' ? genericName.trim().slice(0,500) : undefined;
  const kind=productKind(product,rawName,description);
  const descriptiveName=description?.split(/[.!?]/)[0].trim();
  // OFF may label a nectar simply "Banane". Use its legal description, not
  // invented fruit nutrition facts or a silent ml-to-g conversion.
  const name=kind==='drink' && bareFruitName.test(normalizeFoodName(rawName))
    ? descriptiveName && beverageWords.test(normalizeFoodName(descriptiveName)) ? descriptiveName.slice(0,150) : `${rawName.trim()} — boisson`
    : rawName.trim();
  const nutriments = product.nutriments ?? {};
  const calories = nutrient(nutriments['energy-kcal_100g']);
  const energyKj = nutrient(nutriments.energy_100g);
  const unit = product.product_quantity_unit === 'g' ? 'g' : product.product_quantity_unit === 'ml' || (typeof product.quantity === 'string' && /\d\s*(?:ml|cl|dl|l)\b/i.test(product.quantity)) || (typeof product.serving_size==='string' && /\d\s*ml\b/i.test(product.serving_size)) ? 'ml' : 'g';
  const servingLabel = typeof product.serving_size === 'string' ? product.serving_size.trim() : undefined;
  const servingMatch = servingLabel?.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  const servingQuantity = servingMatch && servingMatch[2].toLowerCase() === unit ? Number(servingMatch[1].replace(',', '.')) : undefined;
  return {
    name,
    description: description && normalizeFoodName(description)!==normalizeFoodName(name) ? description : undefined,
    kind,
    brand: typeof product.brands === 'string' ? product.brands.trim() || undefined : undefined,
    barcode: typeof product.code === 'string' ? product.code : undefined,
    source: 'openfoodfacts',
    unit,
    kcal100: calories ?? (energyKj === null ? null : energyKj / 4.184),
    protein100: nutrient(nutriments.proteins_100g),
    carbs100: nutrient(nutriments.carbohydrates_100g),
    fat100: nutrient(nutriments.fat_100g),
    fiber100: nutrient(nutriments.fiber_100g) ?? undefined,
    servingQuantity: servingQuantity && servingQuantity <= 10000 ? servingQuantity : undefined,
    servingLabel,
  };
}

export function normalizeFoodSearch(json: unknown): FoodCandidate[] {
  if (!json || typeof json !== 'object' || !Array.isArray((json as {products?: unknown}).products)) return [];
  const quality=(food:FoodCandidate)=>(food.servingQuantity?100:0)+(food.fiber100!==undefined?10:0)+[food.protein100,food.carbs100,food.fat100].filter(value=>value!==null).length*5;
  return (json as {products: unknown[]}).products.map(product => normalizeOpenFoodFacts({status:1,product})).filter((food): food is FoodCandidate => !!food).sort((a,b)=>quality(b)-quality(a));
}

// Generic CIQUAL foods have no brand; missing product metadata is a different case.
export function foodBrandLabel(food: Pick<Food, 'brand' | 'source'>) {
  return food.brand?.trim() || (food.source === 'ciqual' ? 'Aliment générique · sans marque' : food.source === 'openfoodfacts' ? 'Marque non renseignée' : 'Aliment personnel');
}

export function foodKindLabel(food: Pick<Food, 'kind' | 'unit'>) {
  return food.kind==='drink' ? 'Boisson' : food.kind==='fresh-fruit' ? 'Fruit frais' : food.unit==='ml' ? 'Produit liquide' : undefined;
}

const searchCache = new Map<string, FoodCandidate[]>();
async function foodResponse(response:Response) {
  let json:unknown;
  try{json=await response.json();}catch{throw new Error('Recherche indisponible. Réessaie plus tard.');}
  if(!response.ok){
    const error=json && typeof json==='object' ? (json as {error?:unknown}).error : undefined;
    throw new Error(typeof error==='string'?error:'Recherche indisponible.');
  }
  return json;
}
export async function searchBrandedFoods(query: string, signal?: AbortSignal) {
  const term = query.trim();
  if (term.length < 2 || term.length > 80) throw new Error('Saisis de 2 à 80 caractères.');
  const key = term.toLocaleLowerCase();
  if (searchCache.has(key)) return searchCache.get(key)!;
  const response = await fetch(`/api/food?query=${encodeURIComponent(term)}`, {signal});
  const json = await foodResponse(response);
  const foods = rankFoodSearch(normalizeFoodSearch(json),term);
  if (searchCache.size >= 50) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(key, foods);
  return foods;
}

export function normalizeFoodName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g,'oe').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}

export function rankFoodSearch(foods: FoodCandidate[], query: string) {
  const words = normalizeFoodName(query).split(' ').filter(Boolean);
  if (!words.length) return foods;
  const wantsDrink=beverageWords.test(normalizeFoodName(query));
  const matches = (candidate:string, word:string) => candidate.startsWith(word) || (word.endsWith('s') && candidate===word.slice(0,-1));
  const score = (food:FoodCandidate) => {
    const name = normalizeFoodName(`${food.name} ${food.nameEn ?? ''}`).split(' ');
    const primaryName = normalizeFoodName(food.name).split(' ');
    const brand = normalizeFoodName(food.brand ?? '').split(' ');
    const hasName = (word:string) => name.some(candidate=>matches(candidate,word));
    const hasBrand = (word:string) => brand.some(candidate=>matches(candidate,word));
    const covered = words.filter(word=>hasName(word) || hasBrand(word)).length;
    const foodWords = words.filter(word=>!hasBrand(word));
    const nameWithoutBrand = primaryName.filter(candidate=>!words.some(word=>hasBrand(word) && matches(candidate,word)));
    const exactFood = foodWords.length>0 && nameWithoutBrand.length===foodWords.length && foodWords.every((word,index)=>matches(nameWithoutBrand[index],word));
    const foodFirst = foodWords.length>0 && foodWords.every((word,index)=>nameWithoutBrand[index]!==undefined && matches(nameWithoutBrand[index],word));
    // A complete name+brand match outranks an ingredient-only search hit.
    // "Bananes Carrefour" then outranks "Barres céréales goût banane Carrefour".
    const liquidPenalty=!wantsDrink && (food.kind==='drink' || food.unit==='ml') ? 900 : 0;
    const wholeFoodBonus=food.kind==='fresh-fruit' ? 80 : food.source==='ciqual' ? 100 : 0;
    const everydayBonus=food.source==='ciqual' && foodFirst && ['13005','9104','36018'].includes(food.id ?? '') ? 400 : 0;
    const relevance = covered*1000 + (exactFood?800:foodFirst?500:0) + wholeFoodBonus + everydayBonus - liquidPenalty - primaryName.length*4;
    const quality = [food.kcal100,food.protein100,food.carbs100,food.fat100].filter(value=>value!==null).length + (food.fiber100!==undefined?1:0);
    return relevance+quality;
  };
  const fullMatches=foods.filter(food=>{
    const candidates=normalizeFoodName(`${food.name} ${food.nameEn ?? ''} ${food.brand ?? ''}`).split(' ');
    return words.every(word=>candidates.some(candidate=>matches(candidate,word)));
  });
  // If exact name+brand matches exist, do not bury them among broad OR hits
  // (e.g. Carrefour mustard or an unrelated brand literally called "Banane").
  return [...(fullMatches.length?fullMatches:foods)].sort((a,b)=>score(b)-score(a));
}

export function filterFoodCatalog(foods: FoodCandidate[], query: string) {
  const term = normalizeFoodName(query);
  const words = term.split(' ').filter(Boolean);
  return foods.filter(food => {
    const candidates=normalizeFoodName(`${food.name} ${food.nameEn ?? ''} ${food.brand ?? ''}`).split(' ');
    return words.every(word=>candidates.some(candidate=>candidate.startsWith(word)));
  })
    .sort((a,b) => {
      const score = (food: FoodCandidate) => {
        const name = normalizeFoodName(food.name);
        const everyday = ['13005','9104','36018'].includes(food.id ?? '') ? 100 : 0;
        const complete = [food.kcal100,food.protein100,food.carbs100,food.fat100].every(value=>value!==null) ? 25 : 0;
        return (name === term ? 1000 : name.startsWith(term + ' ') ? 500 : 0) + everyday + complete - name.length;
      };
      return score(b) - score(a);
    }).slice(0,30);
}

let catalogPromise: Promise<FoodCandidate[]> | undefined;
export function loadFoodCatalog() {
  catalogPromise ??= fetch('/data/ciqual-2025.json').then(async response => {
    if (!response.ok) throw new Error('Catalogue alimentaire indisponible.');
    const json = await response.json() as { foods: Array<[string,string,string,number|null,number|null,number|null,number|null,number|null]> };
    return json.foods.map(([id,name,nameEn,kcal100,protein100,carbs100,fat100,fiber100]) => ({id,name,nameEn,kcal100,protein100,carbs100,fat100,fiber100:fiber100 ?? undefined,kind:beverageName.test(normalizeFoodName(name))?'drink' as const:undefined,source:'ciqual' as const,unit:'g' as const}));
  }).catch(error => {catalogPromise = undefined; throw error;});
  return catalogPromise;
}

export async function lookupFood(barcode: string) {
  if (!/^\d{8,14}$/.test(barcode)) throw new Error('Entre un code-barres de 8 à 14 chiffres.');
  const response = await fetch(`/api/food?barcode=${encodeURIComponent(barcode)}`);
  const json = await foodResponse(response);
  const food = normalizeOpenFoodFacts(json);
  if (!food) throw new Error('Aliment introuvable. Tu peux l’ajouter manuellement.');
  return food;
}
