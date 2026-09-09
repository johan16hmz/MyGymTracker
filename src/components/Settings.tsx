import { setLanguage, t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Icon } from './Icon';

export function Settings() {
  const language = useLanguage();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  return <details className="language-settings">
    <summary><Icon name="settings" />{t('Réglages')}</summary>
    <div className="language-settings-panel">
      <label htmlFor="app-language">{t('Langue de l’application')}</label>
      <select id="app-language" value={language} onChange={event => setLanguage(event.target.value === 'en' ? 'en' : 'fr')}>
        <option value="fr" lang="fr">Français</option>
        <option value="en" lang="en">English</option>
      </select>
      <p>{t('La langue est mémorisée sur cet appareil.')}</p>
      <label htmlFor="app-theme">{t('Apparence')}</label>
      <select id="app-theme" value={theme} onChange={event => {
        const next = event.target.value;
        setTheme(next); document.documentElement.dataset.theme = next;
        try { localStorage.setItem('mygymtracker-theme', next); } catch { /* Optional persistence. */ }
      }}><option value="light">{t('Clair')}</option><option value="dark">{t('Sombre')}</option></select>
    </div>
  </details>;
}
