import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { requestPasswordReset, signIn, signUp } from '../authService';
import { AuthLayout } from './AuthLayout';

interface LoginProps { onLogin: (username: string) => void; }

export function Login({ onLogin }: LoginProps) {
  useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const changeMode = (next: typeof mode) => { setMode(next); setError(''); setMessage(''); setPassword(''); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!email.trim()) { setError(t('Veuillez entrer un email')); return; }
    if (mode !== 'forgot' && !password.trim()) { setError(t('Veuillez entrer un mot de passe')); return; }
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(email);
        if (result.success) setMessage(t('Si un compte correspond à cette adresse, tu recevras un lien pour choisir un nouveau mot de passe. Pense à vérifier tes spams.'));
        else setError(t(result.error || 'Envoi impossible pour le moment. Réessaie plus tard.'));
        return;
      }
      const result = mode === 'signup' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
      if (!result.success) { setError(t(result.error || "Erreur lors de l'authentification")); return; }
      if (mode === 'signup' && !result.session) {
        setMessage(t('Vérifie ta boîte mail pour confirmer ton inscription, puis connecte-toi. Pense à vérifier tes spams.')); setPassword('');
      } else if (result.user) onLogin(result.user.email || email);
    } catch { setError(t("Erreur lors de l'authentification")); }
    finally { setLoading(false); }
  };
  return <AuthLayout>
    <div className="login-header">
      <p className="eyebrow">{t('TON ESPACE PERSONNEL')}</p>
      <h1>{t(mode === 'forgot' ? 'Retrouve ton accès.' : mode === 'signup' ? 'Commence ton parcours.' : 'Prêt pour la suite ?')}</h1>
      <p className="login-subtitle">{t(mode === 'forgot' ? 'Renseigne ton email. On t’enverra un lien pour réinitialiser ton mot de passe.' : mode === 'signup' ? 'Crée ton compte et prépare ta première séance.' : 'Connecte-toi pour retrouver tes entraînements.')}</p>
    </div>
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-group"><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('votre@email.com')} required disabled={loading} autoFocus autoComplete="email" /></div>
      {mode !== 'forgot' && <div className="form-group"><label htmlFor="password">{t('Mot de passe')}</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t(mode === 'signup' ? 'Au moins 8 caractères' : 'Mot de passe')} minLength={mode === 'signup' ? 8 : undefined} required disabled={loading} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></div>}
      {mode === 'signin' && <div className="auth-forgot"><button type="button" className="toggle-auth" disabled={loading} onClick={() => changeMode('forgot')}>{t('Mot de passe oublié ?')}</button></div>}
      {error && <div className="error-message" role="alert">{error}</div>}
      {message && <div className="auth-success" role="status">{message}</div>}
      <button type="submit" className="btn btn-primary btn-large" disabled={loading || !!message}>{t(loading ? 'Chargement...' : mode === 'forgot' ? 'Envoyer le lien' : mode === 'signup' ? 'Créer compte' : 'Se connecter')}</button>
      <div className="login-footer"><button type="button" className="toggle-auth" onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')} disabled={loading}>{t(mode === 'signin' ? 'Pas de compte ? Créez-en un' : 'Retour à la connexion')}</button></div>
    </form>
  </AuthLayout>;
}
