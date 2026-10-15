import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

test('server statistics dependency graph loads in Node ESM without a bundler', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mygym-statistics-esm-'));
  try {
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    for (const name of ['nutrition','trainingSessions','testedMaxes','statistics']) {
      const source = await readFile(new URL(`../src/${name}.ts`, import.meta.url), 'utf8');
      const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
      await writeFile(join(directory, `${name}.js`), outputText);
    }
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import { profileWithWeightHistory } from './statistics.js'; const result=profileWithWeightHistory({weightKg:80},undefined,'2026-10-15'); if(result.weightHistory[0].weightKg!==80) process.exit(1);"], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    // This is exclusively the fresh directory returned by mkdtemp above.
    await rm(directory, { recursive: true, force: true });
  }
});
