import { useState } from 'react';
import { t, useLanguage } from '../i18n';
import { signOut, updatePassword } from '../authService';
import { AuthLayout } from './AuthLayout';

export function ResetPassword({ ready, hasSession, invalidLink, onDone }: { ready: boolean; hasSession: boolean; invalidLink: boolean; onDone: () => void }) {
  useLanguage();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (saving || !hasSession || invalidLink || saved) return;
    if (password.length < 8) { setError(t('Utilise au moins 8 caractères.')); return; }
    if (password !== confirmation) { setError(t('Les mots de passe ne correspondent pas.')); return; }
    setSaving(true);
    try {
      const result = await updatePassword(password);
      if (!result.success) { setError(t(result.error || 'Modification impossible. Réessaie ou demande un nouveau lien.')); return; }
      setSaved(true); setPassword(''); setConfirmation(''); await signOut();
    } finally { setSaving(false); }
  };
  return <AuthLayout>
    <div className="login-header"><p className="eyebrow">{t('TON ESPACE PERSONNEL')}</p><h1>{t(saved ? 'Accès retrouvé.' : 'Un nouveau départ.')}</h1><p className="login-subtitle">{t(saved ? 'Ton mot de passe a été mis à jour. Tu peux te reconnecter.' : 'Choisis un nouveau mot de passe pour ton compte MyGymTracker.')}</p></div>
    {!ready ? <p role="status">{t('Vérification du lien…')}</p> : saved ? <div className="auth-success" role="status">{t('Mot de passe modifié.')}</div> : !hasSession || invalidLink ? <div className="error-message" role="alert">{t('Ce lien est invalide ou expiré. Retourne à la connexion pour demander un nouveau lien.')}</div> : <form onSubmit={handleSubmit} className="login-form">
      <div className="form-group"><label htmlFor="new-password">{t('Nouveau mot de passe')}</label><input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required disabled={saving} placeholder={t('Au moins 8 caractères')} /></div>
      <div className="form-group"><label htmlFor="confirm-password">{t('Confirmer le mot de passe')}</label><input id="confirm-password" type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={8} autoComplete="new-password" required disabled={saving} /></div>
      {error && <div className="error-message" role="alert">{error}</div>}
      <button className="btn btn-primary btn-large" disabled={saving}>{t(saving ? 'Enregistrement…' : 'Enregistrer le mot de passe')}</button>
    </form>}
    <div className="login-footer"><button className="toggle-auth" type="button" disabled={saving || !ready} onClick={onDone}>{t('Retour à la connexion')}</button></div>
  </AuthLayout>;
}
