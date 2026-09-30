import type { ReactNode } from 'react';
import { t } from '../i18n';
import { Icon } from './Icon';
import { Settings } from './Settings';

export function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="login-container">
    <aside className="login-story">
      <div className="brand"><span className="brand-mark"><img src="/brand-icon.svg?v=3" alt="" /></span><span>MyGymTracker<small>TRAINING JOURNAL</small></span></div>
      <div className="login-manifesto"><p className="eyebrow">{t('CONSTRUIS TA PROGRESSION')}</p><h2>{t('Chaque séance.')}<br /><em>{t('Un pas de plus.')}</em></h2><p>{t('Tes entraînements, tes objectifs, ton évolution. Tout commence ici.')}</p></div>
      <div className="track-art" aria-hidden="true"><i /><i /><i /><i /><span>01 — 02 — 03 — 04</span></div>
      <div className="login-story-footer"><span>{t('La régularité fait la différence.')}</span><Icon name="arrow" /></div>
    </aside>
    <div className="login-card">
      <Settings />{children}
      <div className="login-info"><p>{t('☁️ Vos données sont stockées de manière sécurisée sur Supabase')}</p><p className="login-copyright">© {new Date().getFullYear()} MyGymTracker · {t('Tous droits réservés.')}</p></div>
    </div>
  </div>;
}
