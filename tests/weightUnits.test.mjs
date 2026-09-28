import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/weightUnits.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { toDisplayWeight, toStoredWeight, convertWeightInput } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('les charges de force restent en kg et s’affichent en livres', () => {
  assert.equal(toDisplayWeight(100, 'kg'), 100);
  assert.equal(toDisplayWeight(100, 'lb'), 220.46);
  assert.equal(toDisplayWeight(1.25, 'lb'), 2.76);
  assert.equal(toStoredWeight(220.46, 'lb'), 100);
  assert.equal(toStoredWeight(2.76, 'lb'), 1.25);
  assert.equal(toStoredWeight(100, 'kg'), 100);
});

test('changer d’unité convertit une saisie sans transformer un champ vide en zéro', () => {
  assert.equal(convertWeightInput('80', 'kg', 'lb'), '176.37');
  assert.equal(convertWeightInput('176.37', 'lb', 'kg'), '80');
  assert.equal(convertWeightInput('', 'kg', 'lb'), '');
  assert.equal(convertWeightInput('0', 'kg', 'lb'), '0');
});
