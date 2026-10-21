import ExcelJS from 'exceljs';
import type { buildStatistics } from './statistics';
import type { WeightUnit } from './i18n';
import { estimatedOneRM } from './statistics';

type Statistics = ReturnType<typeof buildStatistics>;
const excelDate = (date: string) => new Date(`${date}T00:00:00Z`);

// Document-only ExcelJS runs in the browser. No server upload or account key.
export async function createStatisticsWorkbook(stats: Statistics, unit: WeightUnit, language = 'fr-FR') {
  const en = language.startsWith('en');
  const tr = (fr: string, english: string) => en ? english : fr;
  const weight = (kg: number) => kg * (unit === 'lb' ? 2.2046226218 : 1);
  const book = new ExcelJS.Workbook();
  book.creator = 'MyGymTracker';
  book.created = new Date();
  book.calcProperties.fullCalcOnLoad = true;
  const makeSheet = (name: string, title: string, headers: string[], widths: number[], note: string) => {
    const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
    sheet.columns = widths.map(width => ({ width }));
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF233C2C' } };
    sheet.getRow(1).height = 30;
    sheet.getCell('A2').value = `${tr('Période', 'Period')} : ${stats.start} — ${stats.today}`;
    sheet.getCell('A3').value = note;
    sheet.getCell('A3').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF697168' } };
    sheet.getRow(5).values = headers;
    sheet.getRow(5).height = 32;
    sheet.getRow(5).eachCell(cell => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF233C2C' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
    });
    return sheet;
  };
  const summary = makeSheet('Synthèse', tr('Bilan de progression','Progress summary'), [tr('Indicateur','Metric'),tr('Valeur','Value'),tr('Unité','Unit')], [42,20,20], tr('Export de la période, tous les exercices.','Period export, all exercises.'));
  const force = makeSheet('Force', tr('Séries de force réalisées','Logged strength sets'), [tr('Date','Date'),tr('Exercice','Exercise'),tr('Bloc','Block'),`${tr('Charge','Load')} (${unit})`,tr('Répétitions','Repetitions'),'RPE',tr('Type de charge','Load type'),`${tr('Volume','Volume')} (${unit}·reps)`,tr('Note','Note'),`${tr('Poids du corps','Body weight')} (${unit})`,`${tr('1RM estimé','Estimated 1RM')} (${unit})`], [16,24,28,18,16,10,30,22,42,22,22], tr('Force uniquement. 1RM Epley : 1–10 reps, lest hors poids du corps.','Strength only. Epley 1RM: 1–10 reps, added load excludes body weight.'));
  for (const log of stats.logs) {
    const estimate=estimatedOneRM(log);
    const row = force.addRow([excelDate(log.date),log.exercise,log.block,weight(log.weight),log.reps,Number.isFinite(log.rpe)?log.rpe:null,log.weighted?tr('Lest ajouté','Added weight'):tr('Charge externe','External load'),null,log.note || null,log.weighted && log.bodyWeightKg!==undefined?weight(log.bodyWeightKg):null,null]);
    row.getCell(8).value = { formula: `D${row.number}*E${row.number}`, result: weight(log.weight)*log.reps };
    const n=row.number;
    const types=`ISNUMBER(D${n}),ISNUMBER(E${n})${log.weighted?`,ISNUMBER(J${n})`:''}`;
    const limits=`D${n}>=0,E${n}>=1,E${n}<=10,MOD(E${n},1)=0${log.weighted?`,J${n}>=${weight(25)},J${n}<=${weight(400)}`:''}`;
    const calculation=log.weighted?`(D${n}+J${n})*(1+E${n}/30)-J${n}`:`D${n}*(1+E${n}/30)`;
    row.getCell(11).value={formula:`IF(AND(${types}),IF(AND(${limits}),IF(E${n}=1,D${n},${calculation}),""),"")`,result:estimate===undefined?'':weight(estimate)};
  }
  const body = makeSheet('Pesées', tr('Historique du poids','Body weight history'), [tr('Date','Date'),`${tr('Poids','Weight')} (${unit})`], [18,22], tr('Source : Nutrition. Une mesure par jour.','Source: Nutrition. One measurement per day.'));
  for (const point of stats.weights) body.addRow([excelDate(point.date),weight(point.weightKg)]);
  const weeks = makeSheet('Semaines',tr('Régularité hebdomadaire','Weekly consistency'),[tr('Lundi de la semaine','Week starting Monday'),tr('Jours d’entraînement','Training days'),tr('Séries de force','Strength sets'),`${tr('Volume de force','Strength volume')} (${unit}·reps)`],[24,26,24,30],tr('Source : Séances et Force. Jours uniques. Semaines aux extrémités parfois partielles.','Source: Workouts and Strength. Unique days; boundary weeks may be partial.'));
  for (const week of stats.weeks) weeks.addRow([excelDate(week.date),week.days,week.sets,weight(week.volume)]);
  const sessions = makeSheet('Séances',tr('Entraînements validés','Completed training sessions'),[tr('Date','Date'),tr('Modèle utilisé','Template used'),tr('Type','Type'),tr('Note','Note')],[18,34,18,52],tr('Validations uniquement. Les dates de création des modèles sont exclues.','Completions only. Template creation dates are excluded.'));
  for (const session of [...stats.sessions].sort((a,b)=>a.date.localeCompare(b.date))) sessions.addRow([excelDate(session.date),session.name,session.source==='strength'?tr('Force','Strength'):tr('Séances','Workouts'),session.note || null]);
  const tests = makeSheet('1RM testés', tr('Maximums réellement testés','Tested one-rep maximums'), [tr('Date','Date'),tr('Exercice','Exercise'),`1RM (${unit})`,tr('Type de charge','Load type'),tr('Note','Note')], [18,28,20,28,52], tr('Tests réussis, distincts des estimations. Exclus du nombre et du volume des séries de travail.','Successful tests, separate from estimates. Excluded from working-set count and volume.'));
  for (const value of stats.maxTests) tests.addRow([excelDate(value.date),value.exercise,weight(value.weight),value.weighted?tr('Lest ajouté','Added weight'):tr('Charge externe','External load'),value.note || null]);
  summary.addRow([tr('Jours d’entraînement uniques','Unique training days'),stats.trainingDates.length,tr('jours','days')]);
  summary.addRow([tr('Séries de force réalisées','Logged strength sets'),stats.logs.length,tr('séries','sets')]);
  const volumeRow = summary.addRow([tr('Volume de force hors poids du corps','Strength volume excluding body weight'),null,`${unit}·reps`]);
  volumeRow.getCell(2).value = stats.logs.length ? { formula: `SUM('Force'!H6:H${5+stats.logs.length})`, result: weight(stats.volume) } : 0;
  summary.addRow([tr('Semaines avec entraînement','Active training weeks'),stats.activeWeeks,tr('semaines','weeks')]);
  summary.addRow([tr('Semaines dans la période','Weeks in the period'),stats.weeks.length,tr('semaines','weeks')]);
  summary.addRow([tr('Dernier poids connu (hors filtre de période)','Latest known weight (outside period filter)'),stats.latestWeight===undefined?null:weight(stats.latestWeight),unit]);
  summary.addRow([tr('Pesées datées dans la période','Dated measurements in period'),stats.weights.length,tr('mesures','measurements')]);
  summary.addRow([tr('Tests 1RM réussis','Successful 1RM tests'),stats.maxTests.length,tr('tests','tests')]);
  const averageRow=summary.addRow([tr('Poids moyen des 7 derniers jours','Average weight over the last 7 days'),stats.weightAverage7Days.meanKg===undefined?null:weight(stats.weightAverage7Days.meanKg),unit]);
  summary.addRow([tr('Pesées utilisées dans la moyenne 7 jours','Measurements used in 7-day average'),stats.weightAverage7Days.count,tr('mesures','measurements')]);
  summary.addRow([tr('Fenêtre de la moyenne 7 jours','7-day average window'),`${stats.weightAverage7Days.start} — ${stats.weightAverage7Days.end}`,tr('jours sans pesée ignorés','days without measurements ignored')]);
  for (const sheet of book.worksheets) {
    if (sheet.rowCount > 5) sheet.autoFilter = { from: {row:5,column:1}, to: {row:sheet.rowCount,column:sheet.columnCount} };
    for (let index=6;index<=sheet.rowCount;index++) {
      const row=sheet.getRow(index);row.height=24;
      row.eachCell(cell=>{
        cell.font={name:'Arial',size:10,color:{argb:'FF202722'}};
        cell.alignment={vertical:'middle',horizontal:typeof cell.value==='number' || cell.type===ExcelJS.ValueType.Formula?'right':'left',indent:1};
        if(index%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F3EC'}};
        if(typeof cell.value==='number' || cell.type===ExcelJS.ValueType.Formula)cell.numFmt='#,##0';
        if(cell.value instanceof Date)cell.numFmt='dd/mm/yyyy';
      });
    }
  }
  for(let index=6;index<=force.rowCount;index++) { force.getCell(`D${index}`).numFmt='#,##0.00';force.getCell(`H${index}`).numFmt='#,##0.00';force.getCell(`F${index}`).numFmt='0.0';force.getCell(`J${index}`).numFmt='0.0';force.getCell(`K${index}`).numFmt='#,##0.00'; }
  for(let index=6;index<=body.rowCount;index++)body.getCell(`B${index}`).numFmt='0.0';
  for(let index=6;index<=weeks.rowCount;index++)weeks.getCell(`D${index}`).numFmt='#,##0.00';
  for(let index=6;index<=tests.rowCount;index++)tests.getCell(`C${index}`).numFmt='#,##0.00';
  summary.getCell('B8').numFmt='#,##0.00';summary.getCell('B11').numFmt='0.0';
  averageRow.getCell(2).numFmt='0.00';
  summary.views=[{showGridLines:false}];
  // Long context sits above the tables; give it room without merging data cells.
  for (const sheet of book.worksheets) { sheet.getRow(2).height=22;sheet.getRow(3).height=30; }
  return book;
}

export async function downloadStatistics(stats: Statistics, unit: WeightUnit, language: string) {
  const book=await createStatisticsWorkbook(stats,unit,language);
  const buffer=await book.xlsx.writeBuffer();
  const blob=new Blob([new Uint8Array(buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`MyGymTracker-statistiques-${stats.start}-${stats.today}.xlsx`;
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
