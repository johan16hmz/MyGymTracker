# MyGymTracker 🏋️

[![Vercel](https://img.shields.io/badge/d%C3%A9mo-vercel-%23000000)](https://mygymtracker-five.vercel.app/)

Application web de suivi d'entraînement en salle de sport. Créez, gérez et analysez vos séances de sport directement depuis votre navigateur.

## Fonctionnalités

- **Authentification** — inscription et connexion par email/mot de passe via Supabase Auth
- **Création de séances** — ajoutez des exercices, séries, poids et répétitions
- **Templates prédéfinis** — sélectionnez parmi des templates Push / Pull / Legs avec choix des exercices par groupe musculaire
- **Liste des séances** — vue carte avec stats, édition en ligne et expansion
- **Détail d'une séance** — statistiques complètes, grille d'exercices, édition et suppression
- **Force** — blocs de 4 semaines pour tractions, bench, dips et squat, charges calculées depuis le tableau RPE et historique des performances
- **Nutrition** — journal responsive des quatre repas, recherche par nom ou marque, portions indicatives, calories/macronutriments/fibres, hydratation et scanner de codes-barres
- **Interface responsive** — adaptée mobile et desktop
- **Thème sombre** — design dark mode

## Utiliser l’espace Force

Ouvrir **Force**, saisir les 1RM visés et le poids du corps, puis générer un bloc. Les semaines suivent les RPE 7, 8, 8,5 et 9, avec un objectif en 5 reps et en 3 reps pour chaque exercice. Les charges utilisent le tableau fourni, arrondies au plus proche à 2,5 kg pour bench/squat et 1,25 kg pour dips/tractions. Pour les mouvements lestés, le pourcentage s’applique au poids du corps et au lest réunis ; seul le lest externe est affiché.

Les charges prévues peuvent être ajustées. Ajouter les séries réalisées (charge, reps, RPE ressenti et note), puis cliquer sur **Enregistrer le bloc**. La date est automatique. Créer un nouveau bloc conserve les précédents.

Le **nombre de séries** se choisit par exercice à la création, séparément pour le **×3** et le **×5** (3 séries par défaut pour chacun). Ces valeurs initialisent les objectifs correspondants de toutes les semaines et restent modifiables par objectif hebdomadaire dans le bloc. Le récapitulatif indique le format séries × répétitions et chaque objectif affiche les séries réalisées / prévues. Modifier le nombre de séries recalcule sa charge sans effacer les performances ni les autres charges manuelles. Recalculer les charges conserve les nombres de séries choisis.

La correction du volume est une estimation réglable, avec une base de 3 séries : chaque série supplémentaire retire par défaut 1 % de la charge théorique avant arrondi (5 séries : −2 %). Avec 1 ou 2 séries, aucune hausse automatique. Pour les mouvements lestés, la correction s'applique à la charge totale, puis le poids du corps est soustrait. Le réglage **Réduction par série au-delà de 3 (%)** accepte de 0 à 5 % par exercice, via **Recalculer les charges**. Ce coefficient est un choix de programmation, pas une formule garantissant le RPE ; il est à ajuster selon les performances et le ressenti. Les anciens blocs utilisent 3 séries et gardent leurs charges jusqu'à modification ou recalcul. Au-delà de 3 séries, l'arrondi peut donner la même charge sur plusieurs semaines afin de préserver la réduction.

À **0 % de réduction**, les charges et les ajustements d'arrondi suivent exactement le calcul d'origine, quel que soit le nombre de séries choisi, y compris s'il varie entre semaines. Seule une réduction de charge effectivement active suspend l'ajustement des doublons. Pour rétablir les charges d'un bloc déjà calculé, régler la réduction à 0 puis cliquer sur **Recalculer les charges** ; les nombres de séries restent conservés.

Les blocs sont stockés dans la table Supabase `workouts`, dans le JSON `exercises[].strengthBlock`. Ils utilisent les permissions du compte existant et sont exclus de la liste des séances ordinaires. Aucune migration SQL n’est nécessaire.

Les séances ordinaires s'affichent par dernière modification enregistrée, y compris après rechargement et lors d'une édition rapide des séries. La date de modification est conservée dans `exercises[].workoutUpdatedAt`, dans le JSON existant, sans migration SQL. Les séances sans cette information utilisent leur date de création, puis leur date d'entraînement.

Vérification locale : `node --test tests/strength.test.mjs`, puis `npm.cmd run build`.

## Utiliser l’espace Nutrition

Ouvrir **Nutrition**, renseigner l’objectif (perte, maintien ou gain), le poids actuel et visé, l’âge, la taille, la formule homme ou femme et l’activité. L’objectif calorique est une **estimation pour adultes** basée sur l’[équation de Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/) et des facteurs approximatifs. Sans échéance, l’application garde un écart modéré d’environ 10 %, limité à 300 kcal. Une date cible facultative peut adapter cet ajustement de départ au rythme demandé (voir ci-dessous), sans prédire le poids atteint. Pour la perte, le calcul conserve un plancher de 1 200 kcal/jour ou le métabolisme de base estimé si supérieur, et demande un avis professionnel si le maintien est déjà trop bas. Ces limites ne garantissent pas des apports adaptés à chaque personne. L’objectif peut être ajusté manuellement.

Le journal permet d’ajouter des aliments au petit-déjeuner, déjeuner, en-cas et dîner pour chaque date. La recherche automatique par nom ou marque combine les aliments courants [ANSES-CIQUAL 2025](https://doi.org/10.57745/RDMHWY) et les produits [Open Food Facts](https://world.openfoodfacts.org/) (ODbL). La pertinence et le type du produit priment sur la complétude de sa fiche : un nectar de banane est distingué du fruit frais. Les marques sont affichées et les valeurs absentes doivent être complétées avec l’étiquette, jamais inventées.

Les portions usuelles ou celles de l’étiquette sont proposées, sans prescription. Saisir une quantité en g ou ml recalcule les calories, protéines, glucides, lipides et fibres. Les fibres inconnues restent signalées comme manquantes. On peut modifier ou retirer une ligne et suivre l’hydratation. La caméra, après autorisation de l’utilisateur, lit les codes-barres EAN/UPC et les QR codes contenant un lien produit Open Food Facts ; les images restent sur l’appareil. La saisie manuelle du code et des valeurs reste disponible.

Profil et journées sont stockés dans la table Supabase `workouts` avec des marqueurs dédiés dans `exercises`, et exclus de la liste des séances. Ils utilisent les permissions du compte existant ; aucune migration SQL n’est nécessaire pour les repas. Le proxy `/api/food` ajoute un User-Agent identifiable pour Open Food Facts. En local, Vite fournit le même backend.

### Repas enregistrés

Dans chaque repas du journal, **Enregistrer ce repas** crée un modèle nommé à partir des aliments affichés, avec leurs marques et quantités. L’enregistrement du modèle ne rajoute pas ces aliments au journal. **Repas enregistrés** permet ensuite de chercher un modèle et d’ajouter tous ses aliments en une fois au repas et à la date sélectionnés, sans remplacer les entrées existantes. Chaque réutilisation reçoit de nouveaux identifiants ; une reprise après erreur réutilise les mêmes identifiants pour éviter les doublons.

Les modèles sont modifiables (nom, quantités, retrait d’aliments) et archivables, avec restauration possible. Ils conservent une copie indépendante des aliments et n’altèrent jamais les journées déjà consommées. Chaque modèle utilise une ligne propriétaire de `workouts` nommée `__nutrition_meal__`, dans `exercises[].nutritionMeal`, distincte du profil et des journées. Les lectures paginées et mises à jour sont filtrées par compte ; ces lignes ne figurent ni dans les séances ni dans les statistiques sportives. Aucune migration ou nouvelle permission n’est nécessaire.

Les fenêtres Nutrition sont rendues directement dans le corps de la page. Pendant leur ouverture, la page est immobilisée avec sa position conservée ; le défilement reste dans la fenêtre, y compris à ses limites. La fermeture restaure la position et le focus. Aperçu sans accès au compte : `http://127.0.0.1:5173/tests/nutrition-history-preview.html`.

La réception automatique des pas Apple Santé **reste désactivée** à la demande de Johan. Son activation ultérieure nécessite une migration Supabase approuvée et un Raccourci autorisé sur son iPhone ; un site web ne lit pas directement HealthKit. Voir `supabase/NUTRITION_HEALTH.md`. L’ajustement calorique optionnel ne compte que les pas au-delà du seuil d’activité habituel et reste une estimation.

Vérification locale : `node --test tests/nutrition.test.mjs`, puis `npm.cmd run build`.

## Utiliser les Statistiques

- Les courbes Force utilisent uniquement les séries réalisées, par exercice et nombre de répétitions. Les charges prévues n’y sont pas comptées ; les exercices lestés affichent le lest externe.
- Les périodes disponibles sont 4 semaines, 12 semaines, 6 mois et tout l’historique.
- Dans Nutrition, « Ma pesée » enregistre le poids de la journée. Les sauvegardes du profil conservent aussi leur poids daté. Les anciens poids sans date ne sont pas inventés sur une courbe. Une pesée ne modifie pas l’objectif calorique.
- Les séances enregistrées sont des modèles réutilisables. « Séance réalisée » valide un entraînement du jour ou passé sans modifier ni dupliquer le modèle. Sa création seule ne compte plus comme un entraînement.
- Dans Force, « Saisir mes performances Force » enregistre immédiatement les séries sélectionnées avec leur date, leurs charges, leurs répétitions et un RPE facultatif. Les validations sont indépendantes des blocs : recalculer ou modifier un programme ne réécrit pas les performances. Les anciennes séries déjà enregistrées restent incluses.
- La régularité compte les jours d’entraînement uniques des validations et des performances Force, avec les semaines partielles indiquées. Seule Force alimente les courbes de charges, records et volumes.
- La courbe de 1RM estimé utilise la meilleure estimation Epley de chaque date sur les séries Force de 1 à 10 répétitions. Une répétition conserve la charge réalisée ; le RPE n’est pas utilisé. Pour un exercice lesté, la formule utilise poids du corps + lest puis retire le poids du corps. Sans poids du corps enregistré pour cette date (performance ou Nutrition), la série est exclue de l’estimation, pas de l’historique des charges. C’est un repère indicatif, pas un maximum testé. Référence de formule : [étude de comparaison des estimations 1RM](https://sportrxiv.org/index.php/server/preprint/download/768/1661).
- « Exporter en Excel » télécharge localement un `.xlsx` avec Synthèse, Force, Pesées, Semaines et Séances, sur la période choisie et pour tous les exercices. Les dates et les nombres restent typés ; aucun fichier n’est envoyé à un serveur.
- Aperçu de développement, données fictives : `http://127.0.0.1:5173/tests/statistics-preview.html` après `npm run dev`. Aucun accès Santé n’est activé.
- Aperçu interactif des validations, de Force et du 1RM : `http://127.0.0.1:5173/tests/training-preview.html`. Les ajouts et suppressions y restent en mémoire, sans connexion à Supabase.
- Force : la saisie d’une charge prévue conserve le focus et accepte point/virgule. Elle est enregistrée en quittant le champ ou avec Entrée. Les changements du 1RM visé / poids du corps sont enregistrés avec « Recalculer et enregistrer » ; les échecs conservent les modifications à réessayer.
- Nutrition : « Historique alimentaire » retrouve tous les journaux enregistrés du compte, avec recherche nom/marque, dernière quantité et fréquence. La réutilisation crée une nouvelle entrée après confirmation, sans modifier l’ancien repas. Aperçu isolé : `http://127.0.0.1:5173/tests/nutrition-history-preview.html`.
- Les ajouts d’aliments reviennent à la sélection du même repas, sur « Récents » (premier filtre et sélection par défaut). « Terminer l’ajout » ferme cette sélection ; modifier une entrée conserve le comportement d’édition. Chaque nouveau brouillon reçoit un ID, conservé lors d’une reprise après erreur et renouvelé uniquement après succès.
- Les macros affichent consommé / cible (g), avec progression par rapport à la cible. Elles sont estimées depuis l’objectif, le poids et le volume d’entraînement, sans saisie de macros. Les protéines utilisent des coefficients applicatifs de 1,2 à 2 g/kg, plafonnés à 35 % de l’énergie ; lipides 30 % avec entraînement régulier, 35 % avec 0–1 séance ; glucides sur l’énergie restante. Il s’agit d’heuristiques explicites, pas d’une formule clinique validée ni d’une garantie de prise de muscle. [ISSN : protéines](https://link.springer.com/article/10.1186/s12970-017-0177-8), [ISSN : nutrition sportive](https://link.springer.com/article/10.1186/s12970-018-0242-y).
- Le profil enrichi sépare l’activité hors sport (facteurs applicatifs 1,2 / 1,35 / 1,5 / 1,7) du nombre exact, de la durée et du type des séances. Maintien estimé = Mifflin–St Jeor × facteur quotidien + dépense nette moyenne hebdomadaire `(MET − 1) × kg × heures × séances / 7` ; MET de départ : musculation classique 3,5, vigoureuse 6, cardio modéré 5, mixte 5. Les valeurs sont approximatives et à confronter à l’évolution réelle. Les anciens profils non complétés gardent leur ancien calcul calorique ; aucun mode de vie n’est déduit automatiquement. [Compendium 2024](https://pacompendium.com/conditioning-exercise/).
- Date souhaitée : raccourcis de 1 / 2 / 4 / 6 / 8 / 12 mois calendaires ou date libre, jusqu’à 36 mois. Les fins de mois sont ajustées au dernier jour valide (31 janvier + 1 mois = fin février). Le temps restant et le rythme demandé sont affichés en mois et kg/mois ; les mois incomplets utilisent la fraction de l’intervalle calendaire restant. La date absolue est sauvegardée : réouvrir le profil ou changer le poids ne redémarre pas le délai. Le calcul interne conserve le rythme hebdomadaire `abs(poids visé − actuel) × 7 / jours restants`, puis l’heuristique de départ `maintien × (rythme hebdomadaire / poids actuel) × 20`, plafonnée à 10 % du maintien en gain, 20 % en perte, 500 kcal/jour, au plancher de perte et à l’ajustement correspondant au rythme maximal. Ce coefficient **applicatif non validé cliniquement** ne convertit pas des calories en kilos ni ne reproduit le modèle dynamique du [NIDDK](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner). Les macros suivent l’objectif calorique résultant. Alerte si le rythme dépasse 0,5 % du poids/semaine en gain, 1 % ou 0,9 kg/semaine en perte, ou si l’ajustement doit être plafonné : ces seuils conservateurs ne valident pas la faisabilité du délai. Une date dépassée ramène la proposition au maintien estimé et invite à modifier le profil ; aucun rattrapage automatique. Un objectif calorique manuel reste prioritaire. La date est une préférence, jamais une promesse de gain musculaire ou de perte de poids. [Étude sur les surplus](https://link.springer.com/article/10.1186/s40798-023-00651-y), [CDC : progression graduelle](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html).

## Stack technique

| Technologie | Rôle |
|---|---|
| [Vite 8](https://vitejs.dev/) | Build tool |
| [React 19](https://react.dev/) | UI |
| [TypeScript 6](https://www.typescriptlang.org/) | Typage |
| [Supabase](https://supabase.com/) | Backend (auth + base de données) |
| [Recharts](https://recharts.org/) | Graphiques |
| [Vercel](https://vercel.com/) | Déploiement |

👉 **App en ligne :** [mygymtracker-five.vercel.app](https://mygymtracker-five.vercel.app/)

## Utiliser MyGymTracker avec une IA (MCP)

Le dossier `mcp-server` contient un serveur MCP local. Il permet à une IA compatible MCP de se connecter avec un compte MyGymTracker, lire les séances et statistiques, créer/modifier/supprimer des séances et gérer les blocs Force.

```bash
cd mcp-server
npm install
npm run build
```

Ajoute ensuite ce serveur dans la configuration MCP de ton client IA :

```json
{
  "mcpServers": {
    "mygymtracker": {
      "command": "node",
      "args": ["C:/Users/johan/Documents/projets_perso/MyGymTracker/mcp-server/dist/index.js"]
    }
  }
}
```

Une fois le serveur chargé, utilise l’outil `auth_login` avec l’e-mail et le mot de passe de ton compte. Consulte `mcp-server/README.md` pour la liste complète des outils.

### Connexion MCP distante sur Vercel

Le même serveur est également disponible en HTTP à l’adresse `https://mygymtracker-five.vercel.app/api/mcp`.
Pour obtenir un jeton Supabase, envoie ton e-mail et ton mot de passe à `https://mygymtracker-five.vercel.app/api/mcp-login`, puis configure ce jeton dans ton client MCP :

```json
{
  "mcpServers": {
    "mygymtracker": {
      "url": "https://mygymtracker-five.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer TON_JETON_SUPABASE"
      }
    }
  }
}
```

Le jeton est temporaire et doit être renouvelé lorsqu’il expire. Ne mets jamais ton mot de passe dans le fichier de configuration MCP.
