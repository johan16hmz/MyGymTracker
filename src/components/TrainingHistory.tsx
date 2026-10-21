import { useState } from 'react';
import type { TrainingSession } from '../types';
import { t, locale, useLanguage, useWeightUnit } from '../i18n';
import { toDisplayWeight } from '../weightUnits';
import { Icon } from './Icon';
import { NutritionModal } from './NutritionModal';
import '../nutrition.css';
import '../training.css';

export function TrainingHistory({sessions,onRemove}: {sessions:TrainingSession[];onRemove?:(id:string)=>Promise<void>}) {
  useLanguage();const unit=useWeightUnit();const [error,setError]=useState('');const [removing,setRemoving]=useState<string>();
  const [selected,setSelected]=useState<TrainingSession>();const [limit,setLimit]=useState(20);
  const weight=(value:number)=>toDisplayWeight(value,unit).toLocaleString(locale(),{maximumFractionDigits:2});
  const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString(locale(),{day:'numeric',month:'long',year:'numeric'});
  const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));
  return <section className="training-history"><header><div><p className="eyebrow">{t('ENTRAÎNEMENTS RÉALISÉS')}</p><h2>{t('Ton historique')}</h2></div><span className="count-pill">{sessions.length}</span></header>
    <p className="training-hint">{t('Les modèles sont réutilisables. Seules les validations et les performances Force comptent comme entraînements.')}</p>
    {error && <p className="training-error" role="alert">{error}</p>}
    {sorted.length?<div>{sorted.slice(0,limit).map(session=><article key={session.id}><div className="training-history-copy"><strong>{session.name}</strong><small>{date(session.date)} · {t(session.source==='strength'?'Force':'Séances')}{session.source==='strength' && ` · ${session.exercises.reduce((sum,ex)=>sum+ex.sets.length,0)} ${t('séries réalisées')}`}</small>{session.note && <small>{session.note}</small>}</div><div className="training-history-actions"><button className="btn btn-secondary btn-small" aria-label={`${t('Consulter la séance')} · ${session.name} · ${session.date}`} onClick={()=>setSelected(session)}>{t('Consulter')}<Icon name="arrow" size={16}/></button>{onRemove && <button className="btn btn-secondary btn-small" disabled={!!removing} aria-label={`${t('Retirer cet entraînement')} · ${session.name} · ${session.date}`} onClick={()=>{
      if(!confirm(t('Retirer cet entraînement de l’historique ? Le modèle reste conservé.')))return;
      setRemoving(session.id);setError('');void onRemove(session.id).catch(error=>setError(error instanceof Error?t(error.message):t('Suppression impossible. Réessaie.'))).finally(()=>setRemoving(undefined));
    }}><Icon name="trash" size={16}/></button>}</div></article>)}</div>:<p className="training-empty">{t('Valide ta première séance ou enregistre tes performances dans Force.')}</p>}
    {sorted.length>limit && <button className="btn btn-secondary training-history-more" onClick={()=>setLimit(value=>value+20)}>{t('Voir les entraînements précédents')}<Icon name="chevron-down" size={16}/></button>}
    {selected && <NutritionModal title={selected.name} subtitle={`${t(selected.source==='strength'?'Force':'Séances')} · ${date(selected.date)}`} onClose={()=>setSelected(undefined)}>
      <div className="training-session-detail">
        <div className="training-detail-meta"><span><Icon name="calendar" size={17}/>{date(selected.date)}</span>{selected.week!==undefined && <span>{t('Semaine')} {selected.week}</span>}{selected.bodyWeightKg!==undefined && <span>{t('Poids du corps')} : {weight(selected.bodyWeightKg)} {unit}</span>}</div>
        {(selected.source==='strength' || !!selected.workoutSnapshot?.length) && <p className="training-hint">{t(selected.source==='strength'?'Performances réellement enregistrées ce jour-là. Le programme actuel n’est pas utilisé.':'Contenu du modèle conservé lors de la validation. Ces charges ne sont pas des performances Force.')}</p>}
        {(selected.source==='strength'?selected.exercises:selected.workoutSnapshot ?? []).map((exercise,index)=><section className="training-detail-exercise" key={`${exercise.id}-${index}`}><header><h3>{t(exercise.name)}</h3>{'weighted' in exercise && exercise.weighted && <span>{t('Lest ajouté')}</span>}</header>
          {exercise.sets.length ? <div className="training-detail-table-wrap"><table><thead><tr><th>{t('Série')}</th><th>{t('Charge')} ({unit})</th><th>{t('Répétitions')}</th>{selected.source==='strength' && <th>RPE</th>}</tr></thead><tbody>{exercise.sets.map((set,i)=><tr key={i}><td>{i+1}</td><td>{weight(set.weight)}</td><td>{'repsMin' in set && set.repsMin!==undefined && 'repsMax' in set && set.repsMax!==undefined?`${set.repsMin}–${set.repsMax}`:set.reps}</td>{selected.source==='strength' && <td>{'rpe' in set && set.rpe!==undefined?String(set.rpe).replace('.',locale()==='fr-FR'?',':'.'):'—'}</td>}</tr>)}</tbody></table></div>:<p className="training-hint">{t('Aucune série renseignée.')}</p>}
        </section>)}
        {selected.source==='workout' && !selected.workoutSnapshot?.length && <div className="training-detail-empty"><Icon name="workout" size={26}/><strong>{t('Détail non enregistré pour cette validation')}</strong><p>{t('Les anciennes validations conservaient uniquement la date et la note. Les nouvelles conservent aussi les exercices, sans modifier tes anciennes données.')}</p></div>}
        {selected.note && <div className="training-detail-note"><h3>{t('Note')}</h3><p>{selected.note}</p></div>}
        <button className="btn btn-secondary" onClick={()=>setSelected(undefined)}>{t('Fermer')}</button>
      </div>
    </NutritionModal>}
  </section>;
}
