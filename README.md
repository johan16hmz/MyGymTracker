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
- **Nutrition** — objectif calorique estimé, journal des quatre repas, calories et macronutriments, lecture des codes-barres via Open Food Facts
- **Interface responsive** — adaptée mobile et desktop
- **Thème sombre** — design dark mode

## Utiliser l’espace Force

Ouvrir **Force**, saisir les 1RM visés et le poids du corps, puis générer un bloc. Les semaines suivent les RPE 7, 8, 8,5 et 9, avec un objectif en 5 reps et en 3 reps pour chaque exercice. Les charges utilisent le tableau fourni, arrondies au plus proche à 2,5 kg pour bench/squat et 1,25 kg pour dips/tractions. Pour les mouvements lestés, le pourcentage s’applique au poids du corps et au lest réunis ; seul le lest externe est affiché.

Les charges prévues peuvent être ajustées. Ajouter les séries réalisées (charge, reps, RPE ressenti et note), puis cliquer sur **Enregistrer le bloc**. La date est automatique. Créer un nouveau bloc conserve les précédents.

Les blocs sont stockés dans la table Supabase `workouts`, dans le JSON `exercises[].strengthBlock`. Ils utilisent les permissions du compte existant et sont exclus de la liste des séances ordinaires. Aucune migration SQL n’est nécessaire.

Vérification locale : `node --test tests/strength.test.mjs`, puis `npm.cmd run build`.

## Utiliser l’espace Nutrition

Ouvrir **Nutrition**, renseigner l’objectif (perte, maintien ou gain), le poids actuel et visé, l’âge, la taille, la formule homme ou femme et la fréquence d’entraînement. L’objectif calorique est une **estimation pour adultes** basée sur l’[équation de Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/) et un facteur d’activité approximatif. Pour la perte ou la prise, l’application applique un écart modéré d’environ 10 %, limité à 300 kcal. Pour la perte, elle ne propose pas moins de 1 200 kcal/jour, conformément au [repère du CDC](https://stacks.cdc.gov/view/cdc/146517), et demande un avis professionnel si l’estimation de maintien est déjà trop basse. L’objectif peut être ajusté manuellement. Le poids visé fixe la direction de l’objectif ; aucun délai de progression n’est supposé.

Le journal permet d’ajouter des aliments au petit-déjeuner, déjeuner, en-cas et dîner pour chaque date. Saisir une quantité en g ou ml ; les calories, protéines, glucides et lipides sont recalculés. On peut modifier ou retirer une ligne. La caméra lit les codes-barres EAN/UPC et les QR codes contenant un lien produit Open Food Facts. La saisie manuelle du code et des macros reste disponible si la caméra ou le produit est indisponible. Les valeurs nutritionnelles sont fournies par [Open Food Facts](https://world.openfoodfacts.org/) (ODbL) et doivent être vérifiées sur l’emballage.

Profil et journées sont stockés dans la table Supabase `workouts` avec des marqueurs dédiés dans `exercises`, et exclus de la liste des séances. Ils utilisent les permissions du compte existant ; aucune migration SQL n’est nécessaire. Le proxy `/api/food` ajoute un User-Agent identifiable pour Open Food Facts. En local, Vite fournit le même proxy.

Vérification locale : `node --test tests/nutrition.test.mjs`, puis `npm.cmd run build`.

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
