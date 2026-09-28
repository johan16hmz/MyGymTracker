import type { WeightUnit } from './i18n';

const poundsPerKg = 2.2046226218;

// Strength blocks stay in kg in storage; only values shown to the user change.
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return Number((kg * (unit === 'lb' ? poundsPerKg : 1)).toFixed(2));
}

export function toStoredWeight(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? Number((value / poundsPerKg).toFixed(2)) : value;
}

export function convertWeightInput(value: string, from: WeightUnit, to: WeightUnit): string {
  if (!value.trim() || from === to) return value;
  return String(toDisplayWeight(toStoredWeight(Number(value), from), to));
}
