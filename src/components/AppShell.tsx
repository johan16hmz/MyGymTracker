import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';
import { t, locale, useLanguage } from '../i18n';
import { Icon } from './Icon';
import { Settings } from './Settings';
import '../premium.css';

export type AppSection = 'workouts' | 'strength' | 'nutrition' | 'statistics';
const sections = [
  {id:'workouts',label:'Séances',description:'Tes programmes au quotidien',icon:'workout'},
  {id:'strength',label:'Force',description:'Charges, blocs et performances',icon:'strength'},
  {id:'nutrition',label:'Nutrition',description:'Repas, énergie et équilibre',icon:'nutrition'},
  {id:'statistics',label:'Statistiques',description:'Une vue sur ta progression',icon:'statistics'},
] as const;

export function AppShell({ section, onNavigate, email, onLogout, navigationDisabled=false, preview=false, children, overlay, pageKey }: {
  section:AppSection; onNavigate:(section:AppSection)=>void; email?:string; onLogout?:()=>void;
  navigationDisabled?:boolean; preview?:boolean; children:ReactNode; overlay?:ReactNode;
  pageKey?:string;
}) {
  useLanguage();
  useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});},[section,pageKey]);
  const name=preview?t('Aperçu local'):email?.split('@')[0] || t('Mon espace');
  const label=sections.find(item=>item.id===section)!.label;
  return <div className="app premium-app">
    <a className="skip-link" href="#main-content">{t('Aller au contenu')}</a>
    <header className="app-header shell-sidebar">
      <button className="brand shell-brand" onClick={()=>onNavigate('workouts')} disabled={navigationDisabled} aria-label={t('Accueil des séances')}><span className="brand-mark"><img src="/brand-icon.svg?v=3" alt=""/></span><span>MyGym<span className="brand-light">Tracker</span><small>TRAINING JOURNAL</small></span></button>
      <p className="nav-caption">{t('MON ESPACE')}</p>
      <nav className="app-sections shell-navigation" aria-label={t('Navigation principale')}>{sections.map(item=><button key={item.id} className={`nav-item ${section===item.id?'active':''}`} aria-current={section===item.id?'page':undefined} disabled={navigationDisabled} onClick={()=>onNavigate(item.id)}><Icon name={item.icon} size={21}/><span className="shell-nav-copy"><strong>{t(item.label)}</strong><small>{t(item.description)}</small></span><span className="nav-dot"/></button>)}</nav>
      <div className="shell-sidebar-bottom"><div className="shell-journal-signature"><span className="shell-mini-mark">M</span><div><strong>{t('Un peu mieux, chaque jour.')}</strong><span>{t('La progression se construit.')}</span></div></div><div className="shell-account"><span className="avatar">{name[0].toUpperCase()}</span><span className="shell-account-copy"><strong>{name}</strong><small>{preview?t('Données de démonstration'):t('Espace personnel')}</small></span>{onLogout && <button className="shell-logout" onClick={onLogout} disabled={navigationDisabled} aria-label={t('Déconnexion')} title={t('Déconnexion')}><Icon name="logout" size={18}/></button>}</div></div>
    </header>
    <main className="app-main shell-main" id="main-content">
      <div className="workspace-topbar shell-topbar"><div className="shell-breadcrumb"><span>{t('Mon espace')}</span><span aria-hidden="true">/</span><strong>{t(label)}</strong></div><div className="shell-topbar-right"><span className={`shell-status ${preview?'is-preview':''}`}><i/>{t(preview?'Aperçu local':'Espace personnel')}</span><Settings/>{onLogout && <button className="shell-mobile-logout" onClick={onLogout} disabled={navigationDisabled} aria-label={t('Déconnexion')}><Icon name="logout" size={19}/></button>}</div></div>
      {preview && <div className="shell-preview-notice"><span/>{t('Aperçu privé · données fictives · aucune modification de ton compte')}</div>}
      <div className="shell-page-content">{children}</div>
      <footer className="shell-footer"><span>MyGymTracker <i>·</i> {t('Un peu mieux, chaque jour.')}</span><span>{new Date().toLocaleDateString(locale(),{month:'long',year:'numeric'})}</span></footer>
    </main>
    {overlay}
  </div>;
}
