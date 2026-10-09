import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import ExcelJS from 'exceljs';

const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const nutritionUrl=compile(readFileSync(new URL('../src/nutrition.ts',import.meta.url),'utf8'));
const statisticsUrl=compile(readFileSync(new URL('../src/statistics.ts',import.meta.url),'utf8').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`));
const {buildStatistics}=await import(statisticsUrl);
const fixtureUrl=compile(readFileSync(new URL('./statistics-fixture.ts',import.meta.url),'utf8').replaceAll("from '../src/statistics';",`from ${JSON.stringify(statisticsUrl)};`).replaceAll("from '../src/nutrition';",`from ${JSON.stringify(nutritionUrl)};`));
const {statisticsFixture}=await import(fixtureUrl);
globalThis.statsExcelJS=ExcelJS;
const exportSource=readFileSync(new URL('../src/statisticsExport.ts',import.meta.url),'utf8').replace("import ExcelJS from 'exceljs';",'const ExcelJS=globalThis.statsExcelJS;');
const {createStatisticsWorkbook}=await import(compile(exportSource));

test('Excel export round trip preserves dates, numbers, formulas, filters and all lifts',async()=>{
  const source=statisticsFixture('2026-10-09');source.workouts[0].name='=HYPERLINK("https://invalid.test","test")';
  const stats=buildStatistics(source,'84','2026-10-09');
  const book=await createStatisticsWorkbook(stats,'kg','fr-FR');
  const buffer=await book.xlsx.writeBuffer();const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(buffer);
  assert.deepEqual(reopened.worksheets.map(sheet=>sheet.name),['Synthèse','Force','Pesées','Semaines','Séances']);
  const force=reopened.getWorksheet('Force');assert.equal(force.rowCount,245);
  assert.ok(force.getCell('A6').value instanceof Date);assert.equal(typeof force.getCell('D6').value,'number');
  assert.equal(force.getCell('C6').value,source.workouts[0].name);assert.equal(force.getCell('C6').type,ExcelJS.ValueType.String);
  assert.deepEqual(force.getCell('H6').value,{formula:'D6*E6',result:217.5});
  assert.equal(force.getCell('I6').value,null);
  assert.equal(force.getCell('D6').numFmt,'#,##0.00');
  assert.equal(reopened.getWorksheet('Synthèse').getCell('B8').result,51975);
  assert.equal(reopened.getWorksheet('Pesées').rowCount,24);
  assert.equal(force.views[0].ySplit,5);assert.ok(force.autoFilter);
});
test('Excel export respects period and pounds without converting stored weights',async()=>{
  const source=statisticsFixture('2026-10-09');const stats=buildStatistics(source,'28','2026-10-09');
  const kg=stats.logs[0].weight;const book=await createStatisticsWorkbook(stats,'lb','en-GB');
  assert.equal(book.getWorksheet('Force').rowCount,101);
  assert.equal(book.getWorksheet('Force').getCell('D6').value,kg*2.2046226218);
  assert.equal(book.getWorksheet('Force').getCell('D5').value,'Load (lb)');
  assert.equal(stats.logs[0].weight,kg);
});
test('empty Excel export is valid and missing body weight is not zero',async()=>{
  const book=await createStatisticsWorkbook(buildStatistics({workouts:[],days:[]},'all','2026-10-09'),'kg');
  const buffer=await book.xlsx.writeBuffer();const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(buffer);
  assert.equal(reopened.getWorksheet('Synthèse').getCell('B11').value,null);
  assert.equal(reopened.getWorksheet('Synthèse').getCell('B8').value,0);
  assert.equal(reopened.getWorksheet('Force').rowCount,5);
});
