# Sécurité et préparation du domaine

## Mise à jour du 6 octobre 2026

- Correctifs de dépendances appliqués à l'application et au serveur MCP local :
  `@modelcontextprotocol/sdk` 1.32.1, `proxy-addr` 2.0.8 et `source-map-js` 1.2.2
  (ce dernier concerne l'application). Aucun changement majeur forcé.
- `npm audit` : zéro vulnérabilité connue dans les deux projets après mise à jour.
  Cela ne constitue pas une garantie d'absence de faille.
- Le Security Advisor Supabase affiche zéro erreur et conserve l'avertissement
  « Leaked Password Protection Disabled ». Aucun abonnement Pro activé.
- Le domaine principal est désormais `https://www.my-gym-tracker.app`.
  La configuration Site URL et les retours de confirmation/récupération ont été
  renseignés par Johan ; l'ancien domaine Vercel reste autorisé pendant la transition.
- L'adresse de secours du code utilise aussi ce domaine, notamment depuis
  localhost lorsque `VITE_APP_URL` n'est pas définie. La variable reste prioritaire.
- SMTP personnalisé toujours désactivé lors du contrôle : aucune livraison réelle
  ni parcours complet avec confirmation email n'est encore validé. Les modèles
  approuvés restent dans `supabase/email-templates/`, en attente du fournisseur.

Les constats ci-dessous sont ceux du contrôle initial du 30 septembre ; les URL
et résultats d'audit de cette section historique ne décrivent pas l'état actuel.

## Contrôle initial

Vérification du 30 septembre 2026. Il s'agit d'un contrôle du code, des dépendances,
de la configuration Supabase et du déploiement, pas d'une certification ni d'un
test d'intrusion exhaustif. Un résultat d'audit sans alerte ne garantit pas
l'absence de toute vulnérabilité.

## Protections vérifiées et correctifs

- RLS activée sur les deux tables publiques `workouts` et `users`.
- `workouts` : lecture, création, modification et suppression réservées au
  propriétaire authentifié ; modification du propriétaire interdite par RLS.
- Test exécuté en base sous les rôles `authenticated` et `anon` : opérations du
  propriétaire autorisées, accès et écritures d'un autre compte refusés, accès
  anonyme refusé. Une seule ligne synthétique est utilisée, avec `ROLLBACK` final.
  Script reproductible : `supabase/verify-workout-isolation.sql`.
- Permissions superflues retirées de `users`, dont `TRUNCATE`, qui n'est pas
  couvert par RLS. Correctif : `supabase/secure-users-grants.sql`.
- Aucun bucket de stockage, vue publique ou fonction dans le schéma `public`
  trouvé lors du contrôle des métadonnées.
- Confirmation email et confirmation sur les deux adresses lors d'un changement
  d'email activées. Connexions anonymes désactivées.
- Limitation des inscriptions/connexions configurée à 30 requêtes par 5 minutes
  et par IP dans Supabase. Le proxy MCP reste soumis aux limites de Supabase.
- Minimum des nouveaux mots de passe porté de 6 à 8 caractères côté Supabase ;
  réauthentification requise lors d'un changement de mot de passe après 24 h.
- Site URL Supabase correcte : `https://mygymtracker-five.vercel.app`.
  La redirection autorisée reste limitée aux chemins de ce même domaine.
- Aucun fichier `.env`, clé privée ou motif de secret privilégié trouvé dans les
  recherches effectuées sur les fichiers suivis et l'historique Git. Ce contrôle
  par motifs n'est pas un détecteur universel de secrets.
- Seules l'URL Supabase et la clé publique `anon` sont configurées dans les
  variables Vercel vérifiées. La clé publique est prévue pour le navigateur ;
  ne jamais y mettre une clé `service_role` / `sb_secret_`.
- Dépendance Firebase inutilisée retirée ; correctifs de dépendances appliqués
  sans mise à jour forcée. `npm audit` : zéro vulnérabilité connue pour
  l'application et pour le serveur MCP local à la date du contrôle.
- En-têtes navigateur configurés dans `vercel.json` : CSP, protection contre
  l'intégration en iframe, `nosniff`, politique de référent et permissions.
  La caméra reste autorisée sur le site pour le scanner alimentaire.
- Réponses MCP privées et jetons de connexion marqués `no-store` côté fonctions
  et CDN. Erreurs de connexion génériques et statut de limitation 429 préservé.
- Les fonctions API sont désormais incluses dans la vérification TypeScript
  du build. Tests de non-régression dans `tests/mcp-login.test.mjs`.

## Points restant à préparer

- Le Security Advisor conserve l'avertissement « Leaked Password Protection
  Disabled ». Cette option est réservée au forfait Pro ou supérieur ; aucun
  abonnement n'a été souscrit.
- `users` n'a aucune politique RLS et reste donc fermée aux clients. Cela protège
  ses lignes mais les outils MCP de lecture/modification du profil ne peuvent pas
  fonctionner normalement. Les séances, blocs et données nutrition sont dans
  `workouts`. Ajouter ultérieurement des politiques de profil strictement
  limitées au propriétaire si cette fonctionnalité doit être utilisée.
- CAPTCHA désactivé : son activation nécessite un fournisseur et une intégration
  dans les formulaires et le flux MCP. Ne pas l'activer seul dans le dashboard,
  sous peine de bloquer les connexions. Les limites Supabase ne remplacent pas
  une protection complète contre les attaques distribuées.
- Prévoir une sauvegarde régulière de la base et un essai de restauration.
  Ni une restauration ni la récupération après sinistre n'ont été testées.
- Vérifier la double authentification des comptes administrateurs GitHub,
  Supabase, Vercel et du futur registrar. Leur configuration complète n'a pas
  été auditée ici.
- Aucun SMTP personnalisé n'est configuré (constaté dans le dashboard Emails).
  Préparer un fournisseur SMTP de production pour les confirmations et la
  récupération des comptes, puis tester la réception sur plusieurs messageries.
- Les brouillons sont locaux au navigateur et au compte. Ils ne migrent pas
  automatiquement lors d'un changement de domaine : enregistrer les brouillons
  avant le basculement. Les données enregistrées restent dans Supabase.
- Aucun test de connexion complet avec le mot de passe d'un véritable compte,
  de livraison d'email ou de caméra sur téléphone n'a été effectué dans cet audit.

## Quand le domaine sera choisi

1. Ajouter le domaine au même projet Vercel, puis copier les enregistrements DNS
   affichés par Vercel chez le registrar. Vérifier le certificat HTTPS avant de
   communiquer la nouvelle adresse. Choisir une adresse principale avec ou sans
   `www` et rediriger l'autre vers celle-ci.
2. Dans Supabase > Authentication > URL Configuration, mettre l'URL HTTPS du
   domaine principal dans **Site URL** et ajouter son URL de retour exacte dans
   **Redirect URLs**. Éviter les autorisations globales telles que `https://**`.
   Conserver temporairement l'ancienne adresse pour les liens déjà envoyés.
3. Définir `VITE_APP_URL=https://votre-domaine` dans Vercel et dans l'environnement
   local si utilisé, puis redéployer. Cette valeur fournit aussi la bonne URL de
   confirmation lors des inscriptions depuis localhost. Les inscriptions depuis
   le site utilisent son origine courante, validée par la liste Supabase.
4. Les règles CSP utilisent `self` pour le site : elles suivent automatiquement
   le nouveau domaine. Si le projet Supabase change, actualiser `connect-src`.
5. Mettre à jour l'adresse MCP et le script de connexion lorsque nécessaire.
   Garder l'ancien endpoint pendant la transition des clients existants.
6. Tester inscription, confirmation email, connexion, déconnexion, isolation
   des comptes, sauvegarde d'une séance et scanner sur le nouveau domaine.
7. Pour l'envoi d'emails depuis ce domaine, appliquer les DNS SPF/DKIM fournis par
   le fournisseur SMTP et préparer DMARC. Cela est distinct du DNS du site web.
8. Protéger le compte registrar, activer le renouvellement et conserver une
   adresse de récupération accessible.

Références : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
[préparation production](https://supabase.com/docs/guides/deployment/going-into-prod),
[sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security),
[URL de redirection](https://supabase.com/docs/guides/auth/redirect-urls),
[domaine Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain).
