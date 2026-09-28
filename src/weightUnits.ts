import type { WeightUnit } from './i18n';

const poundsPerKg = 2.2046226218;

// Strength blocks stay in kg in storage; only values shown to the user change.
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return Number((kg * (unit === 'lb' ? poundsPerKg : 1)).toFixed(2));
}

export function toStoredWeight(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? Number((value / poundsPerKg).toFixed(2)) : value;
}

// Text inputs preserve the comma typed on French keyboards; convert only once
// the complete value is valid, rather than silently truncating at the comma.
export function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
}

export function convertWeightInput(value: string, from: WeightUnit, to: WeightUnit): string {
  if (!value.trim() || from === to) return value;
  const parsed = parseDecimalInput(value);
  return Number.isFinite(parsed) ? String(toDisplayWeight(toStoredWeight(parsed, from), to)) : value;
}
