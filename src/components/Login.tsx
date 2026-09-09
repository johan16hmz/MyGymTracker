import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { signIn, signUp } from '../authService';
import { Icon } from './Icon';
import { Settings } from './Settings';

interface LoginProps {
  onLogin: (username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t("Veuillez entrer un email"));
      return;
    }

    if (!password.trim()) {
      setError(t("Veuillez entrer un mot de passe"));
      return;
    }

    setLoading(true);

    try {
      let result;
      
      if (isSignUp) {
        result = await signUp(email.trim(), password.trim());
      } else {
        result = await signIn(email.trim(), password.trim());
      }

      if (result.success && result.user) {
        onLogin(result.user.email || email);
      } else {
        setError(result.error || t("Erreur lors de l'authentification"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erreur inconnue"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <aside className="login-story">
        <div className="brand"><span className="brand-mark"><Icon name="logo" /></span><span>MyGymTracker<small>TRAINING JOURNAL</small></span></div>
        <div className="login-manifesto"><p className="eyebrow">{t('CONSTRUIS TA PROGRESSION')}</p><h2>{t('Chaque séance.')}<br /><em>{t('Un pas de plus.')}</em></h2><p>{t('Tes entraînements, tes objectifs, ton évolution. Tout commence ici.')}</p></div>
        <div className="track-art" aria-hidden="true"><i /><i /><i /><i /><span>01 — 02 — 03 — 04</span></div>
        <div className="login-story-footer"><span>{t('La régularité fait la différence.')}</span><Icon name="arrow" /></div>
      </aside>
      <div className="login-card">
        <Settings />
        <div className="login-header">
          <p className="eyebrow">{t('TON ESPACE PERSONNEL')}</p>
          <h1>{t(isSignUp ? 'Commence ton parcours.' : 'Prêt pour la suite ?')}</h1>
          <p className="login-subtitle">{t(isSignUp ? 'Crée ton compte et prépare ta première séance.' : 'Connecte-toi pour retrouver tes entraînements.')}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("votre@email.com")}
              disabled={loading}
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t("Mot de passe")}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("Au moins 6 caractères")}
              disabled={loading}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary btn-large"
            disabled={loading}
          >
            {loading ? t("Chargement...") : (isSignUp ? t("Créer compte") : t("Se connecter"))}
          </button>

          <div className="login-footer">
            <button
              type="button"
              className="toggle-auth"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              disabled={loading}
            >
              {isSignUp 
                ? t("Vous avez déjà un compte ? Connectez-vous")
                : t("Pas de compte ? Créez-en un")}
            </button>
          </div>
        </form>

        <div className="login-info">
          <p>{t("☁️ Vos données sont stockées de manière sécurisée sur Supabase")}</p>
        </div>
      </div>
    </div>
  );
}
