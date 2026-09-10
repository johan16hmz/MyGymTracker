import { setLanguage, t, useLanguage, setWeightUnit, useWeightUnit } from '../i18n';
import { useState } from 'react';
import { Icon } from './Icon';

export function Settings() {
  const language = useLanguage();
  const weightUnit = useWeightUnit();
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
      <label htmlFor="weight-unit">{t('Unité de poids')}</label>
      <select id="weight-unit" value={weightUnit} onChange={event => setWeightUnit(event.target.value === 'lb' ? 'lb' : 'kg')}>
        <option value="kg">{t('Kilogrammes (kg)')}</option>
        <option value="lb">{t('Livres (lb)')}</option>
      </select>
      <p>{t('Choisis l’unité utilisée pour afficher les charges.')}</p>
      <label htmlFor="app-theme">{t('Apparence')}</label>
      <select id="app-theme" value={theme} onChange={event => {
        const next = event.target.value;
        setTheme(next); document.documentElement.dataset.theme = next;
        try { localStorage.setItem('mygymtracker-theme', next); } catch { /* Optional persistence. */ }
      }}><option value="light">{t('Clair')}</option><option value="dark">{t('Sombre')}</option></select>
    </div>
  </details>;
}
