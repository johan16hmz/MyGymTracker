export interface HealthStepImport { date: string; steps: number }

export function parseHealthImport(value: string): HealthStepImport {
  if (value.length > 500) throw new Error('Import Santé invalide.');
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('Import Santé invalide.'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('Import Santé invalide.');
  const { date, steps } = parsed as Record<string, unknown>;
  const day = typeof date === 'string' ? new Date(`${date}T12:00:00Z`) : new Date(NaN);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== date || typeof steps !== 'number' || !Number.isInteger(steps) || steps < 0 || steps > 100000) throw new Error('Import Santé invalide.');
  return { date, steps };
}
