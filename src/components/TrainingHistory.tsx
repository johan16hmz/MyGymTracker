import { useState } from 'react';
import type { TrainingSession } from '../types';
import { t, locale, useLanguage } from '../i18n';
import { Icon } from './Icon';
import '../training.css';

export function TrainingHistory({sessions,onRemove}: {sessions:TrainingSession[];onRemove?:(id:string)=>Promise<void>}) {
  useLanguage();const [error,setError]=useState('');const [removing,setRemoving]=useState<string>();
  const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));
  return <section className="training-history"><header><div><p className="eyebrow">{t('ENTRAÎNEMENTS RÉALISÉS')}</p><h2>{t('Ton historique')}</h2></div><span className="count-pill">{sessions.length}</span></header>
    <p className="training-hint">{t('Les modèles sont réutilisables. Seules les validations et les performances Force comptent comme entraînements.')}</p>
    {error && <p className="training-error" role="alert">{error}</p>}
    {sorted.length?<div>{sorted.slice(0,20).map(session=><article key={session.id}><div><strong>{session.name}</strong><small>{new Date(`${session.date}T12:00:00`).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'})} · {t(session.source==='strength'?'Force':'Séances')}{session.source==='strength' && ` · ${session.exercises.reduce((sum,ex)=>sum+ex.sets.length,0)} ${t('séries réalisées')}`}</small>{session.note && <small>{session.note}</small>}</div>{onRemove && <button className="btn btn-secondary btn-small" disabled={!!removing} aria-label={`${t('Retirer cet entraînement')} · ${session.name} · ${session.date}`} onClick={()=>{
      if(!confirm(t('Retirer cet entraînement de l’historique ? Le modèle reste conservé.')))return;
      setRemoving(session.id);setError('');void onRemove(session.id).catch(error=>setError(error instanceof Error?t(error.message):t('Suppression impossible. Réessaie.'))).finally(()=>setRemoving(undefined));
    }}><Icon name="trash" size={16}/></button>}</article>)}</div>:<p className="training-empty">{t('Valide ta première séance ou enregistre tes performances dans Force.')}</p>}
    {sorted.length>20 && <p className="training-hint">{t('Les 20 derniers entraînements sont affichés. L’export contient toute la période.')}</p>}
  </section>;
}
