import { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: (username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Veuillez entrer un nom d\'utilisateur');
      return;
    }

    if (username.trim().length < 3) {
      setError('Le nom d\'utilisateur doit avoir au moins 3 caractères');
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      onLogin(username.trim());
      setLoading(false);
    }, 300);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🏋️ MyGymTracker</h1>
          <button 
        type="button" 
        onClick={() => alert(JSON.stringify(localStorage))}
        style={{ background: 'red', color: 'white', padding: '10px', marginTop: '10px' }}
        >
        Bouton de secours : Voir la mémoire
        </button>
          <p className="login-subtitle">Suivi d'entraînement intelligent</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Nom d'utilisateur</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Entrez votre pseudo"
              disabled={loading}
              autoFocus
              autoComplete="username"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary btn-large"
            disabled={loading}
          >
            {loading ? 'Connexion...' : (isSignUp ? 'Créer compte' : 'Se connecter')}
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
          <p>💾 Vos données sont stockées localement sur votre appareil</p>
        </div>
      </div>
    </div>
  );
}
