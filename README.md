# MyGymTracker 🏋️

[![Vercel](https://img.shields.io/badge/d%C3%A9mo-vercel-%23000000)](https://mygymtracker-five.vercel.app/)

Application web de suivi d'entraînement en salle de sport. Créez, gérez et analysez vos séances de sport directement depuis votre navigateur.

## Fonctionnalités

- **Authentification** — inscription et connexion par email/mot de passe via Supabase Auth
- **Création de séances** — ajoutez des exercices, séries, poids et répétitions
- **Templates prédéfinis** — sélectionnez parmi des templates Push / Pull / Legs avec choix des exercices par groupe musculaire
- **Liste des séances** — vue carte avec stats, édition en ligne et expansion
- **Détail d'une séance** — statistiques complètes, grille d'exercices, édition et suppression
- **Suivi du développé couché** — graphique d'évolution (Recharts), estimation du 1RM, records personnels, suggestion de poids suivant
- **Interface responsive** — adaptée mobile et desktop
- **Thème sombre** — design dark mode

## Stack technique

| Technologie | Rôle |
|---|---|
| [Vite 8](https://vitejs.dev/) | Build tool |
| [React 19](https://react.dev/) | UI |
| [TypeScript 6](https://www.typescriptlang.org/) | Typage |
| [Supabase](https://supabase.com/) | Backend (auth + base de données) |
| [Recharts](https://recharts.org/) | Graphiques |
| [Vercel](https://vercel.com/) | Déploiement |

## Prise en main

```bash
# Cloner le projet
git clone https://github.com/johan16hmz/MyGymTracker.git
cd MyGymTracker

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

### Variables d'environnement

Créez un fichier `.env.local` à la racine :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
```

Ces clés se trouvent dans les **Project Settings > API** de votre projet Supabase.

### Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Compilation TypeScript + build Vite |
| `npm run preview` | Prévisualisation du build |

## Déploiement

Le projet est prêt pour un déploiement sur [Vercel](https://vercel.com/). Importez le dépôt GitHub et renseignez les deux variables d'environnement (`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`) dans les paramètres du projet Vercel.

👉 **App en ligne :** [mygymtracker-five.vercel.app](https://mygymtracker-five.vercel.app/)
