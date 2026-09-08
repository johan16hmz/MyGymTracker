import { useEffect, useState } from 'react';
import type { Workout } from '../types';
import { calculateWeight, createStrengthBlock, formatNumber as n, RPE_TABLE, STRENGTH_EXERCISES, WEEK_RPES } from '../strength';
import type { StrengthBlock, StrengthPrescription, StrengthPerformance } from '../strength';
import { getStrengthBlock, saveStrengthBlock } from '../strengthService';
import './Strength.css';

interface Props {
  userId: string;
  workouts: Workout[];
  onSaved: (workout: Workout) => void;
  onPendingChange: (pending: boolean) => void;
}

function PerformanceForm({ prescription, step, onAdd }: {
  prescription: StrengthPrescription;
  step: number;
  onAdd: (performance: StrengthPerformance) => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpen(!open)}>
      {open ? 'Annuler la saisie' : '+ Enregistrer une série'}
    </button>
    {open && <form className="force-performance" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      onAdd({ weight: Number(values.get('weight')), reps: Number(values.get('reps')), rpe: Number(values.get('rpe')), note: String(values.get('note')), date: new Date().toISOString() });
      setOpen(false);
    }}>
      <label>Poids réalisé (kg)<input name="weight" type="number" min="0" step={step} defaultValue={prescription.weight} required /></label>
      <label>Reps réalisées<input name="reps" type="number" min="1" step="1" defaultValue={prescription.reps} required /></label>
      <label>RPE ressenti<input name="rpe" type="number" min="1" max="10" step="0.5" defaultValue={prescription.rpe} required /></label>
      <label className="force-note">Note<input name="note" placeholder="Ex. : dur, propre, marge…" maxLength={500} /></label>
      <button className="btn btn-primary" type="submit">Ajouter au bloc</button>
    </form>}
  </>;
}

export function Strength({ userId, workouts, onSaved, onPendingChange }: Props) {
  const records = workouts.filter(workout => getStrengthBlock(workout));
  const [selected, setSelected] = useState<Workout | undefined>(records[0]);
  const [block, setBlock] = useState<StrengthBlock | undefined>(() => records[0] && getStrengthBlock(records[0]));
  const [creating, setCreating] = useState(!records.length);
  const [exerciseId, setExerciseId] = useState('pullup');
  const [targets, setTargets] = useState<Record<string, string>>(Object.fromEntries(STRENGTH_EXERCISES.map(ex => [ex.id, String(ex.target)])));
  const [name, setName] = useState(`Bloc force ${records.length + 1}`);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    onPendingChange(dirty || saving);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || saving) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); onPendingChange(false); };
  }, [dirty, saving, onPendingChange]);

  const persist = async (next: StrengthBlock, title: string, existing?: Workout) => {
    setSaving(true); setError(''); setMessage('');
    try {
      const saved = await saveStrengthBlock(userId, title, next, existing);
      onSaved(saved); setSelected(saved); setBlock(next); setCreating(false); setDirty(false);
      setMessage('Bloc enregistré dans ton compte.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible. Réessaie.');
    } finally { setSaving(false); }
  };

  const updatePrescription = (id: string, update: Partial<StrengthPrescription>) => {
    setBlock(previous => previous && ({ ...previous, exercises: previous.exercises.map(ex => ({
      ...ex, prescriptions: ex.prescriptions.map(row => row.id === id ? { ...row, ...update } : row),
    })) }));
    setDirty(true); setMessage('');
  };
  const exercise = block?.exercises.find(ex => ex.id === exerciseId) ?? block?.exercises[0];
  const completed = block?.exercises.reduce((sum, ex) => sum + ex.prescriptions.filter(row => row.performances.length > 0).length, 0) ?? 0;

  return <section className="force-page">
    <div className="force-heading">
      <div><p className="force-eyebrow">POWERLIFTING & STREETLIFTING</p><h2>Force</h2><p>Un objectif. Quatre semaines. Tes performances.</p></div>
      {!creating && <button className="btn btn-primary" disabled={dirty || saving} onClick={() => {
        setName(`Bloc force ${records.length + 1}`); setCreating(true); setMessage(''); setError('');
      }}>+ Nouveau bloc</button>}
    </div>
    {error && <p className="force-error" role="alert">{error}</p>}
    {message && <p className="force-success" role="status">{message}</p>}

    {creating ? <form className="force-panel" onSubmit={event => {
      event.preventDefault();
      void persist(createStrengthBlock(Object.fromEntries(Object.entries(targets).map(([key, value]) => [key, Number(value)]))), name.trim());
    }}>
      <h3>Préparer mon bloc de 4 semaines</h3>
      <p>RPE 7 → 8 → 8,5 → 9. Chaque semaine propose un travail en 5 reps et en 3 reps pour chaque exercice.</p>
      <label>Nom du bloc<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
      <div className="force-targets">{STRENGTH_EXERCISES.map(ex => <label key={ex.id}>
        <strong>{ex.name}</strong><span>1RM visé · {ex.weighted ? 'lest ajouté' : 'charge totale'} (kg)</span>
        <input type="number" min={ex.step} step="any" required value={targets[ex.id]} onChange={event => setTargets({ ...targets, [ex.id]: event.target.value })} />
        <small>Arrondi au plus proche : {n(ex.step)} kg</small>
        {Number(targets[ex.id]) > 0 && Number.isFinite(Number(targets[ex.id])) && <small>Sem. 1 · 5 reps : {n(calculateWeight(Number(targets[ex.id]), 5, 7, ex.step))} kg</small>}
      </label>)}</div>
      <p className="force-help">Calcul : 1RM visé × pourcentage du tableau, puis arrondi. Pour les dips et tractions, le calcul porte uniquement sur le lest ; le poids de corps n’est pas inclus. Les charges restent ajustables.</p>
      <div className="force-buttons"><button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>{saving ? 'Enregistrement…' : 'Générer et enregistrer le bloc'}</button>
        {selected && <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setCreating(false)}>Annuler</button>}</div>
    </form> : block && exercise && <>
      <div className="force-toolbar">
        <label>Mes blocs<select value={selected?.id ?? ''} disabled={dirty || saving} onChange={event => {
          const record = records.find(item => item.id === event.target.value);
          setSelected(record); setBlock(record && getStrengthBlock(record)); setMessage(''); setError('');
        }}>{records.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}</select></label>
        <span>{completed} / {block.exercises.reduce((sum, ex) => sum + ex.prescriptions.length, 0)} objectifs renseignés</span>
      </div>
      <div className="force-exercise-tabs" aria-label="Exercices de force">{block.exercises.map(ex => <button key={ex.id} className={exercise.id === ex.id ? 'active' : ''} onClick={() => setExerciseId(ex.id)} aria-pressed={exercise.id === ex.id}>
        {ex.name}<small>1RM visé {n(ex.target)} kg</small>
      </button>)}</div>
      <div className="force-exercise-heading"><h3>{exercise.name}</h3><span>{exercise.weighted ? 'Lest ajouté' : 'Charge totale'} · pas de {n(exercise.step)} kg</span></div>
      <fieldset className="force-editor" disabled={saving}>
        <div className="force-weeks">{WEEK_RPES.map((rpe, index) => <section className="force-week" key={rpe}>
          <header><h4>Semaine {index + 1}</h4><span>RPE {n(rpe)}</span></header>
          {exercise.prescriptions.filter(row => row.week === index + 1).map(row => <div className="force-prescription" key={row.id}>
            <div className="force-prescription-heading"><strong>× {row.reps} reps</strong><small>{n(RPE_TABLE.find(r => r.rpe === row.rpe)!.percentages[row.reps - 1])} % du 1RM</small></div>
            <label>Charge prévue (kg)<input key={row.weight} aria-label={`Charge prévue ${exercise.name} semaine ${row.week}, ${row.reps} reps`} type="number" min="0" step={exercise.step} defaultValue={row.weight} onBlur={event => {
              if (event.target.value !== '' && event.target.validity.valid) {
                if (Number(event.target.value) !== row.weight) updatePrescription(row.id, { weight: Number(event.target.value) });
              } else {
                event.target.value = String(row.weight);
              }
            }} /></label>
            {row.weight !== calculateWeight(exercise.target, row.reps, row.rpe, exercise.step) && <button className="force-link" onClick={() => updatePrescription(row.id, { weight: calculateWeight(exercise.target, row.reps, row.rpe, exercise.step) })}>Rétablir le calcul RPE</button>}
            {row.performances.map((perf, perfIndex) => <div className="force-result" key={perfIndex}>
              <strong>{n(perf.weight)} kg × {perf.reps} · RPE {n(perf.rpe)}</strong>
              <small>{new Date(perf.date).toLocaleDateString('fr-FR')}{perf.note && ` · ${perf.note}`}</small>
              <button className="force-link" onClick={() => {
                if (confirm('Retirer cette performance du bloc ?')) updatePrescription(row.id, { performances: row.performances.filter((_, i) => i !== perfIndex) });
              }}>Retirer</button>
            </div>)}
            <PerformanceForm prescription={row} step={exercise.step} onAdd={performance => updatePrescription(row.id, { performances: [...row.performances, performance] })} />
          </div>)}
        </section>)}</div>
      </fieldset>
      <div className="force-save"><span>{dirty ? 'Modifications à enregistrer' : 'Bloc enregistré'}<small>La date des performances est ajoutée automatiquement.</small></span><button className="btn btn-primary" disabled={!dirty || saving} onClick={() => void persist(block, selected!.name, selected)}>{saving ? 'Enregistrement…' : 'Enregistrer le bloc'}</button></div>
      {dirty && <p className="force-help">Enregistre le bloc avant de quitter cette page ou de changer de bloc.</p>}
    </>}

    <details className="force-panel force-rpe" open>
      <summary>Tableau RPE · % du 1RM</summary>
      <p>Référence fournie pour les calculs. Les colonnes correspondent au nombre de répétitions.</p>
      <div className="force-table-scroll"><table><caption>Pourcentage du 1RM selon le RPE et les répétitions</caption><thead><tr><th scope="col">RPE / Reps</th>{Array.from({ length: 12 }, (_, i) => <th scope="col" key={i}>{i + 1}</th>)}</tr></thead>
        <tbody>{RPE_TABLE.map(row => <tr key={row.rpe}><th scope="row">{n(row.rpe)}</th>{row.percentages.map((percentage, i) => <td key={i} style={{ backgroundColor: `hsl(${(100 - percentage) * 2.7} 65% 78%)` }}>{n(percentage)} %</td>)}</tr>)}</tbody>
      </table></div>
    </details>
  </section>;
}
