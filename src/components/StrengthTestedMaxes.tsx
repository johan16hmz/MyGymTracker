import { useEffect, useState } from 'react';
import { loadTestedMaxes, saveTestedMax, removeTestedMax } from '../testedMaxService';
import type { TestedMax } from '../testedMaxes';
import { t, locale, useLanguage, useWeightUnit } from '../i18n';
import { toDisplayWeight } from '../weightUnits';
import { TestedMaxForm } from './TestedMaxForm';
import { Icon } from './Icon';
import '../strengthMaxes.css';

export function StrengthTestedMaxes({ userId, exercises, tests, onSave, onRemove }: {
  userId: string; exercises: {id:string;name:string;weighted:boolean}[]; tests?: TestedMax[];
  onSave?: (value:TestedMax) => Promise<void>; onRemove?: (id:string) => Promise<void>;
}) {
  useLanguage();
  const unit=useWeightUnit();
  const [loaded,setLoaded]=useState<TestedMax[]>([]);
  const [loading,setLoading]=useState(tests === undefined);
  const [error,setError]=useState('');
  const [reload,setReload]=useState(0);
  const [form,setForm]=useState<TestedMax | 'new'>();
  const provided=tests !== undefined;
  useEffect(()=>{
    if(provided)return;
    let active=true;setLoading(true);setError('');setLoaded([]);setForm(undefined);
    void loadTestedMaxes(userId).then(values=>{if(active)setLoaded(values);}).catch(error=>{if(active)setError(t(error instanceof Error?error.message:'Impossible de charger tes tests 1RM. Réessaie.'));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[userId,provided,reload]);
  const values=[...(tests ?? loaded)].sort((a,b)=>b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));
  const options=[...new Map([...exercises,...values.map(value=>({id:value.exerciseId,name:value.exercise,weighted:value.weighted}))].map(item=>[item.id,item])).values()];
  return <section className="force-panel strength-max-panel" aria-label={t('Mes 1RM testés')}>
    <div className="strength-max-heading"><div><p className="force-eyebrow">{t('LE JOUR DU TEST')}</p><h3>{t('Mes 1RM testés')}</h3><p>{t('Enregistre ici tes maximums réussis. Les courbes et les records se retrouvent dans Statistiques, sans modifier les objectifs de ton bloc.')}</p></div><button className="btn btn-primary" disabled={loading || !!error} onClick={()=>setForm('new')}><Icon name="plus" size={18}/>{t('Ajouter un 1RM testé')}</button></div>
    {loading && <p role="status">{t('Chargement des tests 1RM…')}</p>}
    {error && <div className="force-error" role="alert">{error}<button className="btn btn-secondary btn-small" onClick={()=>setReload(value=>value+1)}>{t('Réessayer')}</button></div>}
    {!loading && !error && (values.length ? <details className="strength-max-history"><summary>{t('Historique des tests 1RM')} · {values.length}</summary><div className="force-table-scroll"><table><thead><tr><th>{t('Date')}</th><th>{t('Exercice')}</th><th>1RM ({unit})</th><th>{t('Note')}</th><th>{t('Modifier')}</th></tr></thead><tbody>{values.map(value=><tr key={value.id}><td>{new Date(`${value.date}T12:00:00`).toLocaleDateString(locale())}</td><td>{t(value.exercise)}</td><td><strong>{toDisplayWeight(value.weight,unit).toLocaleString(locale())} {unit}</strong>{value.weighted && <small> {t('de lest')}</small>}</td><td>{value.note || '—'}</td><td><button className="btn btn-secondary btn-small" aria-label={`${t('Modifier le 1RM testé')} · ${value.exercise} · ${value.date}`} onClick={()=>setForm(value)}><Icon name="edit" size={16}/></button></td></tr>)}</tbody></table></div></details> : <p className="force-help">{t('Pas encore de test enregistré. Tu peux en ajouter même sans bloc de force.')}</p>)}
    {form && <TestedMaxForm initial={form==='new'?undefined:form} exercises={options} onClose={()=>setForm(undefined)} onSave={async value=>{
      if(onSave)await onSave(value);else await saveTestedMax(userId,value);
      setLoaded(previous=>[...previous.filter(item=>item.id!==value.id),value]);
    }} onRemove={async id=>{
      if(onRemove)await onRemove(id);else await removeTestedMax(userId,id);
      setLoaded(previous=>previous.filter(item=>item.id!==id));
    }}/>}
  </section>;
}
