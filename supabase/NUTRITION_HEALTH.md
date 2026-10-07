# Connexion Santé iPhone — non activée

Le 7 octobre 2026, Johan a approuvé la publication de la refonte nutrition, **sans activer Santé pour l’instant**. `nutrition-health-sync.sql` **n’a pas été exécuté sur Supabase**. Aucun compte, jeton ou pas réel n’a été créé pendant les tests. Le guide de connexion reste disponible, mais la génération de clé est désactivée tant que le serveur n’est pas configuré.

## Architecture

- Un site/PWA n'a pas accès à HealthKit. Une automatisation personnelle Raccourcis lit les pas avec l'autorisation du propriétaire de l'iPhone, puis transmet `{date, steps}` en HTTPS à `/api/health-sync`.
- Le compte connecté génère une capacité aléatoire de 256 bits et l'enregistre via `health_sync_enable`. Seule son empreinte SHA-256 est conservée dans un schéma privé. L'utilisateur copie la clé une fois dans l'en-tête Authorization du Raccourci ; elle ne figure jamais dans une URL, un journal applicatif ou le stockage du navigateur.
- La capacité expire après un an, peut être remplacée ou révoquée, et ne donne accès qu'à la mise à jour du total de pas de ce compte. L'identité ne vient jamais du corps envoyé par le téléphone.
- La fonction d'import est volontairement accessible au rôle anon, mais refuse toute clé invalide/expirée. Elle n'offre aucun accès aux comptes, aux séances ou aux aliments. `search_path` est vide et les noms des tables sont qualifiés.
- Les totaux Santé sont stockés séparément des repas. RLS et les privilèges autorisent uniquement la lecture par le propriétaire ; aucun accès direct anonyme ni aucune écriture directe depuis le navigateur.
- Répéter le même envoi n'additionne pas les pas. Les changements sont limités à un par minute et par jour ; l'historique importable est limité aux sept derniers jours et à demain pour les décalages de fuseau.
- Le journal reprend les derniers pas à son ouverture/retour au premier plan et chaque minute lorsqu'il est visible. Une correction manuelle est facultative ; le prochain import Santé plus récent peut la remplacer.

## Limites iOS et calcul calorique

L'utilisateur doit configurer et autoriser son Raccourci, puis programmer « Exécuter immédiatement » à une ou plusieurs heures. Ce n'est pas un accès natif ni une synchronisation temps réel. Le réseau doit être disponible ; Santé peut être inaccessible lorsque l'iPhone est verrouillé. Vérifier ces contraintes sur un vrai iPhone avant d'annoncer le parcours comme fonctionnel.

Le guide filtre **une seule source** (iPhone OU montre) pour éviter les doublons : le total peut différer du total fusionné par Santé. Il doit être comparé à Santé lors de la configuration. Ne pas promettre qu'une somme brute de toutes les sources reproduit le total Apple.

L'ajustement calorique est désactivé par défaut. S'il est activé, seule la marche au-delà du seuil de pas habituels est ajoutée : marche approximative à 3,8 MET moins 1 MET de repos, longueur de pas approximative = taille × 0,414, vitesse 4,8 km/h, plafond 600 kcal. C'est une estimation, pas une mesure Apple ni un avis médical. Les calories de l'entraînement ne sont pas ajoutées une seconde fois.

Sources : [HealthKit](https://developer.apple.com/documentation/healthkit), [automatisations Apple](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios), [2024 Adult Compendium](https://pacompendium.com/walking/).

## Activation ultérieure, après validation

1. Tester/approuver la refonte. Examiner la migration et obtenir confirmation de l'ajout de cet accès limité aux pas.
2. Exécuter le SQL sur le bon projet, vérifier RLS/privilèges et les conseillers sécurité. La migration est idempotente et ne touche pas aux repas ou aux comptes existants.
3. Publier l'app et l'endpoint sur le domaine HTTPS. Les variables Supabase publiques déjà utilisées suffisent : **aucune clé service-role** et aucun nouvel abonnement.
4. Depuis le compte de Johan, créer la clé dans « Connecter Santé ». La clé doit être copiée par l'utilisateur, ne pas la capturer dans un screenshot ou la faire apparaître dans une réponse.
5. Configurer le Raccourci sur son iPhone, vérifier un envoi, les autorisations, le comportement verrouillé et les reprises réseau. Vérifier la révocation sans supprimer ses données existantes.

Les tests PostgreSQL utilisent un PGlite éphémère **local** ; ils vérifient l'isolation entre deux comptes, les dates/quantités invalides, la rotation, l'expiration, la révocation, le remplacement idempotent et la limitation d'écriture. Ils ne constituent pas un test de Santé sur iPhone.
