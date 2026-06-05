import { useState } from 'react';
import { signIn, signUp } from '../authService';
import './Login.css';

interface LoginProps {
  onLogin: (username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Veuillez entrer un email');
      return;
    }

    if (!password.trim()) {
      setError('Veuillez entrer un mot de passe');
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
        setError(result.error || 'Erreur lors de l\'authentification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🏋️ MyGymTracker</h1>
          <p className="login-subtitle">Suivi d'entraînement intelligent</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              disabled={loading}
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 6 caractères"
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
            {loading ? 'Chargement...' : (isSignUp ? 'Créer compte' : 'Se connecter')}
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
                ? 'Vous avez déjà un compte ? Connectez-vous' 
                : 'Pas de compte ? Créez-en un'}
            </button>
          </div>
        </form>

        <div className="login-info">
          <p>☁️ Vos données sont stockées de manière sécurisée sur Supabase</p>
        </div>
      </div>
    </div>
  );
}
