import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildStatistics, loadPoints } from '../statistics';
import type { StatsPeriod, StatsSource } from '../statistics';
import { loadStatistics } from '../statisticsService';
import { locale, t, useLanguage, useWeightUnit } from '../i18n';
import { toDisplayWeight } from '../weightUnits';
import { Icon } from './Icon';
import '../statistics.css';

const format = (value: number, decimals = 2) => value.toLocaleString(locale(), { maximumFractionDigits: decimals });
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
const time = (date: string) => Date.parse(`${date}T12:00:00Z`);
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${format(Math.abs(value))}`;

function ChartEmpty({ title, description }: { title: string; description: string }) {
  return <div className="stats-chart-empty"><Icon name="statistics" size={32}/><strong>{t(title)}</strong><p>{t(description)}</p></div>;
}
function PlotTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: { date: string; value: number; reps?: number } }[] }) {
  const unit = useWeightUnit();
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="stats-tooltip"><span>{dateLabel(point.date)}</span><strong>{format(point.value)} {unit}</strong>{point.reps !== undefined && <small>{point.reps} {t('répétitions')}</small>}</div>;
}

export function StatisticsDashboard({ source, onNutrition, onStrength, onRefresh, today }: {
  source: StatsSource; onNutrition: () => void; onStrength: () => void; onRefresh?: () => void; today?: string;
}) {
  useLanguage();
  const unit = useWeightUnit();
  const [period, setPeriod] = useState<StatsPeriod>('84');
  const [exerciseId, setExerciseId] = useState('bench');
  const [reps, setReps] = useState<number | 'all'>(3);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const stats = useMemo(() => buildStatistics(source, period, today), [source, period, today]);
  const exercise = stats.exercises.find(item => item.id === exerciseId) ?? stats.exercises[0];
  const points = loadPoints(stats.logs, exercise?.id ?? '', reps);
  const loads = points.map(point => ({ ...point, time: time(point.date), value: toDisplayWeight(point.weight, unit) }));
  const weights = stats.weights.map(point => ({ ...point, time: time(point.date), value: toDisplayWeight(point.weightKg, unit) }));
  const change = points.length > 1 ? points.at(-1)!.weight - points[0].weight : undefined;
  const weightChange = weights.length > 1 ? stats.weights.at(-1)!.weightKg - stats.weights[0].weightKg : undefined;
  const repOptions = [...new Set([3, 5, ...stats.logs.filter(log => log.exerciseId === exercise?.id).map(log => log.reps)])].sort((a,b)=>a-b);
  const best = points.length ? Math.max(...points.map(point => point.weight)) : undefined;
  const selectedVolume = stats.logs.filter(log => log.exerciseId === exercise?.id).reduce((sum, log) => sum + log.weight * log.reps, 0);
  const ticks = { fill: 'var(--text-muted)', fontSize: 11 };
  const dateTick = (value: number) => dateLabel(new Date(value).toISOString().slice(0, 10));
  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true); setExportMessage('');
    try {
      const { downloadStatistics } = await import('../statisticsExport');
      await downloadStatistics(stats, unit, locale());
      setExportMessage(t('Export Excel prêt. Vérifie tes téléchargements.'));
    } catch { setExportMessage(t('Export impossible. Réessaie.')); }
    finally { setExporting(false); }
  };

  return <section className="stats-page">
    <header className="stats-heading"><div><p className="eyebrow">{t('STATISTIQUES / TA PROGRESSION')}</p><h1>{t('Tes efforts prennent forme.')}</h1><p>{t('Tes charges, ton poids, ta régularité. Un regard sur le chemin parcouru.')}</p></div><div className="stats-header-actions">{onRefresh && <button className="btn btn-secondary" onClick={onRefresh} aria-label={t('Actualiser les statistiques')}><Icon name="refresh" size={17}/></button>}<button className="btn btn-secondary" disabled={exporting} onClick={()=>void exportExcel()}><Icon name="download" size={17}/>{t(exporting?'Préparation…':'Exporter en Excel')}</button></div></header>
    <div className="stats-period-row"><div className="stats-periods" aria-label={t('Période des statistiques')}>{(['28','84','180','all'] as const).map(value=><button key={value} aria-pressed={period===value} onClick={()=>{setPeriod(value);setExportMessage('');}}>{t(value==='28'?'4 semaines':value==='84'?'12 semaines':value==='180'?'6 mois':'Tout')}</button>)}</div><span>{dateLabel(stats.start)} {stats.start.slice(0,4)} — {dateLabel(stats.today)} {stats.today.slice(0,4)}</span></div>
    {exportMessage && <p className="stats-export-status" role="status">{exportMessage}</p>}
    <div className="stats-metrics">
      <article><span><Icon name="calendar" size={18}/>{t('Jours d’entraînement')}</span><strong>{stats.trainingDates.length}<small>{t('jours')}</small></strong><p>{t('Séances et force, sans doublons')}</p></article>
      <article><span><Icon name="strength" size={18}/>{t('Séries de force')}</span><strong>{stats.logs.length}<small>{t('réalisées')}</small></strong><p>{t('Les charges prévues ne comptent pas')}</p></article>
      <article><span><Icon name="statistics" size={18}/>{t('Semaines actives')}</span><strong>{stats.activeWeeks}<small>/ {stats.weeks.length}</small></strong><p>{t('Au moins un jour d’entraînement')}</p></article>
      <article className="stats-weight-metric"><span><Icon name="weight" size={18}/>{t('Dernier poids connu')}</span><strong>{stats.latestWeight===undefined?'—':format(toDisplayWeight(stats.latestWeight,unit))}<small>{unit}</small></strong><p>{t('Depuis ton journal Nutrition')}</p></article>
    </div>
    <div className="stats-chart-grid">
      <section className="stats-panel stats-force-panel"><div className="stats-panel-heading"><div><p className="eyebrow">{t('PROGRESSION EN FORCE')}</p><h2>{t('Des charges qui évoluent.')}</h2></div><span className="stats-real-badge"><span/>{t('Réalisé')}</span></div>
        <div className="stats-chart-controls"><label><span className="sr-only">{t('Exercice de force')}</span><select aria-label={t('Exercice de force')} value={exercise?.id ?? ''} disabled={!stats.exercises.length} onChange={event=>setExerciseId(event.target.value)}>{!stats.exercises.length && <option value="">{t('Aucun exercice')}</option>}{stats.exercises.map(item=><option key={item.id} value={item.id}>{t(item.name)}</option>)}</select></label><label><span className="sr-only">{t('Répétitions comparées')}</span><select aria-label={t('Répétitions comparées')} value={reps} onChange={event=>setReps(event.target.value==='all'?'all':Number(event.target.value))}>{repOptions.map(value=><option key={value} value={value}>{value} {t('répétitions')}</option>)}<option value="all">{t('Toutes les répétitions')}</option></select></label></div>
        <div className="stats-lift-summary"><div><span>{t('Dernière charge')}</span><strong>{points.length?format(toDisplayWeight(points.at(-1)!.weight,unit)):'—'}<small>{unit}</small></strong></div><div><span>{t('Évolution sur la période')}</span><strong className={change!==undefined && change>0?'stats-positive':''}>{change===undefined?'—':signed(toDisplayWeight(change,unit))}<small>{unit}</small></strong></div><div><span>{t('Meilleure charge')}</span><strong>{best===undefined?'—':format(toDisplayWeight(best,unit))}<small>{unit}</small></strong></div></div>
        {loads.length ? <div className="stats-plot" role="img" aria-label={`${t('Évolution des charges réalisées')} · ${t(exercise?.name ?? '')}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={loads} margin={{top:15,right:16,bottom:4,left:-12}}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5"/><XAxis dataKey="time" type="number" domain={['dataMin','dataMax']} tickFormatter={dateTick} tick={ticks} axisLine={false} tickLine={false} minTickGap={35}/><YAxis tickFormatter={value=>format(value)} domain={[(min:number)=>Math.max(0,min-5),(max:number)=>max+5]} tick={ticks} axisLine={false} tickLine={false} width={52}/><Tooltip content={<PlotTooltip/>}/><Line type="linear" dataKey="value" stroke="var(--stats-line)" strokeWidth={3} dot={{r:4,strokeWidth:2,fill:'var(--surface)'}} activeDot={{r:6}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:<ChartEmpty title="Aucune performance sur cette sélection" description="Enregistre tes séries dans Force ou essaie une autre période et un autre nombre de répétitions."/>}
        <div className="stats-chart-footnote"><span><i/>{t(exercise?.weighted?'Lest ajouté uniquement, hors poids du corps':'Charge réalisée')} ({unit})</span><small>{t('Meilleure série de chaque jour')}</small></div>
        {reps==='all' && <p className="stats-hint">{t('Les répétitions varient : une charge plus lourde ne signifie pas toujours une meilleure performance.')}</p>}
        <details className="stats-data-details"><summary>{t('Voir les valeurs du graphique')}</summary><div className="stats-table-wrap"><table><thead><tr><th>{t('Date')}</th><th>{t('Charge')} ({unit})</th><th>{t('Répétitions')}</th></tr></thead><tbody>{points.map(point=><tr key={point.date}><td>{dateLabel(point.date)} {point.date.slice(0,4)}</td><td>{format(toDisplayWeight(point.weight,unit))}</td><td>{point.reps}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className="stats-panel stats-body-panel"><div className="stats-panel-heading"><div><p className="eyebrow">{t('POIDS DU CORPS')}</p><h2>{t('Ton évolution, simplement.')}</h2></div><Icon name="weight" size={23}/></div><div className="stats-body-summary"><strong>{stats.latestWeight===undefined?'—':format(toDisplayWeight(stats.latestWeight,unit))}<small>{unit}</small></strong><span>{weightChange===undefined?t('Enregistre tes premières pesées'):`${signed(toDisplayWeight(weightChange,unit))} ${unit} ${t('sur la période')}`}</span></div>
        {weights.length ? <div className="stats-plot" role="img" aria-label={t('Évolution du poids du corps')}><ResponsiveContainer width="100%" height="100%"><LineChart data={weights} margin={{top:15,right:14,bottom:4,left:-14}}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5"/><XAxis dataKey="time" type="number" domain={['dataMin','dataMax']} tickFormatter={dateTick} tick={ticks} axisLine={false} tickLine={false} minTickGap={40}/><YAxis tickFormatter={value=>format(value)} domain={['dataMin - 1','dataMax + 1']} tick={ticks} axisLine={false} tickLine={false} width={52}/><Tooltip content={<PlotTooltip/>}/><Line type="linear" dataKey="value" stroke="var(--stats-weight-line)" strokeWidth={2.5} dot={{r:3,strokeWidth:2,fill:'var(--surface)'}} activeDot={{r:6}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:<ChartEmpty title="Ton historique commence ici" description="Ajoute une pesée dans Nutrition. Les anciennes valeurs du profil n’ont pas de date : elles ne sont pas inventées sur le graphique."/>}
        <div className="stats-weight-footer"><span>{source.profile?`${t('Poids visé')} : ${format(toDisplayWeight(source.profile.targetKg,unit))} ${unit}`:t('Configure ton objectif dans Nutrition')}</span><button onClick={onNutrition}>{t('Ajouter une pesée')} <Icon name="arrow" size={16}/></button></div>
        {weights.length===1 && <p className="stats-hint">{t('Une première mesure. La courbe apparaîtra dès la deuxième pesée.')}</p>}
        <details className="stats-data-details"><summary>{t('Voir les pesées')}</summary><div className="stats-table-wrap"><table><thead><tr><th>{t('Date')}</th><th>{t('Poids')} ({unit})</th></tr></thead><tbody>{weights.map(point=><tr key={point.date}><td>{dateLabel(point.date)} {point.date.slice(0,4)}</td><td>{format(point.value)}</td></tr>)}</tbody></table></div></details>
      </section>
    </div>
    <div className="stats-secondary-grid">
      <section className="stats-panel"><div className="stats-panel-heading"><div><p className="eyebrow">{t('RÉGULARITÉ')}</p><h2>{t('Une semaine à la fois.')}</h2></div><span className="stats-count-pill">{stats.activeWeeks} / {stats.weeks.length} {t('actives')}</span></div><p className="stats-hint">{t('Jours d’entraînement par semaine. Une journée compte une seule fois, même avec plusieurs exercices.')}</p><div className="stats-week-plot" role="img" aria-label={t('Jours d’entraînement par semaine')}><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.weeks} margin={{top:16,right:0,bottom:0,left:-25}}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5"/><XAxis dataKey="date" tickFormatter={dateLabel} tick={ticks} axisLine={false} tickLine={false} minTickGap={25}/><YAxis allowDecimals={false} domain={[0,7]} tick={ticks} axisLine={false} tickLine={false}/><Tooltip cursor={{fill:'var(--surface-hover)'}} content={({active,payload})=>active && payload?.[0]?<div className="stats-tooltip"><span>{t('Semaine du')} {dateLabel(payload[0].payload.date)}</span><strong>{payload[0].payload.days} {t('jours d’entraînement')}</strong></div>:null}/><Bar dataKey="days" fill="var(--stats-bar)" radius={[5,5,0,0]} maxBarSize={26} isAnimationActive={false}/></BarChart></ResponsiveContainer></div><p className="stats-hint">{t('Les semaines aux extrémités peuvent être partielles.')}</p></section>
      <section className="stats-panel"><div className="stats-panel-heading"><div><p className="eyebrow">{t('REPÈRES DE FORCE')}</p><h2>{t('Tes meilleurs lifts.')}</h2></div><button className="stats-text-button" onClick={onStrength}>{t('Ouvrir Force')} <Icon name="arrow" size={16}/></button></div><p className="stats-hint">{t('Meilleure charge réalisée sur la période, avec le nombre de répétitions associé.')}</p>{stats.records.length?<div className="stats-records">{stats.records.map(record=><div key={record.id}><span><strong>{t(record.name)}</strong><small>{record.best?`${record.best.reps} ${t('répétitions')} · ${dateLabel(record.best.date)}`:t('Pas encore de performance')}</small></span><strong>{record.best?format(toDisplayWeight(record.best.weight,unit)):'—'} <small>{unit}{record.weighted?` ${t('de lest')}`:''}</small></strong></div>)}</div>:<ChartEmpty title="Tes records viendront ici" description="Crée ton premier bloc et enregistre tes séries dans Force."/>}<div className="stats-volume-note"><Icon name="strength" size={18}/><div><strong>{format(toDisplayWeight(stats.volume,unit),0)} {unit}·reps</strong><span>{t('Volume de force réalisé : charge × répétitions, hors poids du corps.')}</span></div></div></section>
    </div>
    {points.length>0 && <p className="stats-method">{t(exercise?.name ?? '')} · {t('Volume réalisé')} : {format(toDisplayWeight(selectedVolume,unit),0)} {unit}·reps. {t('L’export contient toute la période et tous les exercices, indépendamment du filtre du graphique.')}</p>}
  </section>;
}

export function Statistics({ userId, onNutrition, onStrength }: { userId: string; onNutrition: () => void; onStrength: () => void }) {
  useLanguage();
  const [source,setSource]=useState<StatsSource>();
  const [error,setError]=useState('');
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let active=true;setSource(undefined);setError('');
    void loadStatistics(userId).then(data=>{if(active)setSource(data);}).catch(()=>{if(active)setError(t('Impossible de charger tes statistiques. Réessaie.'));});
    return()=>{active=false;};
  },[userId,reload]);
  if(error)return <div className="stats-panel" role="alert">{error}<button className="btn btn-secondary" onClick={()=>setReload(value=>value+1)}>{t('Réessayer')}</button></div>;
  if(!source)return <div className="loading-panel" role="status"><span className="loading-spinner"/>{t('Chargement des statistiques…')}</div>;
  return <StatisticsDashboard source={source} onNutrition={onNutrition} onStrength={onStrength} onRefresh={()=>setReload(value=>value+1)}/>;
}
