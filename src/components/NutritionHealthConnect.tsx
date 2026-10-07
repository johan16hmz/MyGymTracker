import { useEffect, useState } from 'react';
import { enableHealthSync, healthSyncStatus, revokeHealthSync } from '../nutritionService';
import { t, useLanguage } from '../i18n';
import { NutritionModal } from './NutritionModal';

export function NutritionHealthConnect({onClose}:{onClose:()=>void}) {
  useLanguage();
  const [expiry,setExpiry]=useState<string|null>();
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [token,setToken]=useState('');
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  useEffect(()=>{let active=true;void healthSyncStatus().then(value=>{if(active){setExpiry(value);setReady(true);}}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[]);
  const generate=async()=>{
    if(expiry && !confirm(t('Remplacer la clé ? L’ancien Raccourci devra être mis à jour.')))return;
    setBusy(true);setError('');
    try{const bytes=crypto.getRandomValues(new Uint8Array(32));const next=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');const until=await enableHealthSync(next);setToken(next);setExpiry(until);setCopied(false);}
    catch(error){setError(error instanceof Error?error.message:t('Activation impossible.'));}finally{setBusy(false);}
  };
  return <NutritionModal title={t('Santé, sans saisie quotidienne.')} subtitle={t('CONNEXION IPHONE')} onClose={onClose} busy={busy}>
    <div className="nutri-health-intro"><span className="nutri-detail-badge">Apple Santé → Raccourcis → MyGymTracker</span><p>{t('Une automatisation iOS envoie uniquement la date et le total de pas. Le site ne lit pas directement Santé et ne demande pas ton mot de passe.')}</p></div>
    {expiry && <p className="nutri-success">{t('Clé autorisée jusqu’au')} {new Date(expiry).toLocaleDateString()} · {t('Configurer le Raccourci reste nécessaire.')}</p>}
    <ol className="nutri-health-guide">
      <li><strong>{t('Autoriser l’envoi des pas')}</strong><p>{t('La clé est privée, révocable et limitée à tes pas. Elle ne permet ni de lire ton compte ni de modifier tes repas.')}</p><button className="btn btn-primary" disabled={!ready || busy} onClick={()=>void generate()}>{t(expiry?'Créer une nouvelle clé':'Créer ma clé de connexion')}</button>
      {token && <div className="nutri-key-box"><p>{t('Copie-la maintenant dans Raccourcis. Elle ne sera plus affichée après fermeture. Ne la partage pas.')}</p><button className="btn btn-secondary" onClick={()=>void navigator.clipboard.writeText(`Bearer ${token}`).then(()=>setCopied(true)).catch(()=>setError(t('Copie indisponible. Sélectionne la clé.')))}>{t(copied?'Copié':'Copier l’en-tête Authorization')}</button><input aria-label={t('Clé privée de synchronisation')} readOnly value={`Bearer ${token}`} onFocus={event=>event.target.select()}/></div>}</li>
      <li><strong>{t('Créer le Raccourci « MyGymTracker Pas »')}</strong><p>{t('Dans Raccourcis, ajoute « Rechercher des échantillons de Santé » : type Pas, aujourd’hui, sans limite. Filtre sur une seule source (ton iPhone OU ta montre), pour ne pas additionner leurs doublons.')}</p><p>{t('Récupère la Valeur des échantillons, puis calcule leur Somme. Formate la date actuelle en yyyy-MM-dd.')}</p><p>{t('Ajoute « Obtenir le contenu de l’URL » avec ces paramètres :')}</p><div className="nutri-code-box"><code>https://www.my-gym-tracker.app/api/health-sync</code><span>POST · Content-Type: application/json</span><span>Authorization: Bearer {t('TA_CLÉ_PRIVÉE')}</span><code>{'{"date":"[Date formatée]","steps":[Somme]}'}</code></div><p>{t('Choisis un corps JSON : date = Date formatée (Texte), steps = Somme (Nombre). Lance-le une première fois et autorise l’accès à Santé et au site. Vérifie que le nombre de pas est cohérent avec Santé.')}</p></li>
      <li><strong>{t('Programmer l’envoi automatique')}</strong><p>{t('Raccourcis → Automatisation → Heure de la journée → Tous les jours → Exécuter immédiatement → MyGymTracker Pas. Par exemple à 21 h ; ajoute d’autres horaires si tu veux plus de mises à jour.')}</p><p>{t('iOS peut bloquer la lecture de Santé lorsque l’iPhone est verrouillé. Une connexion réseau et l’accès aux données Santé sont nécessaires : teste l’automatisation sur ton téléphone. Ce n’est pas une synchronisation temps réel garantie.')}</p></li>
    </ol>
    {expiry && <button disabled={busy} className="btn btn-danger" onClick={()=>{if(!confirm(t('Déconnecter Santé ? Le Raccourci ne pourra plus envoyer de pas.')))return;setBusy(true);void revokeHealthSync().then(()=>{setExpiry(null);setToken('');}).catch(error=>setError(error.message)).finally(()=>setBusy(false));}}>{t('Révoquer la connexion')}</button>}
    {error && <p className="nutrition-error" role="alert">{error}</p>}
    <p className="nutri-source-note"><a href="https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios" target="_blank" rel="noreferrer">{t('Guide Apple des automatisations')}</a> · {t('Seuls les pas sont transmis. Aucun export complet de Santé.')}</p>
  </NutritionModal>;
}
