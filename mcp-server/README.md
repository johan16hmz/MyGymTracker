# MyGymTracker MCP

Ce serveur MCP permet à une IA compatible MCP de consulter et modifier le compte MyGymTracker : connexion, profil, séances, exercices, séries, statistiques et blocs Force.

## Installation

Depuis le dossier `mcp-server` :

```bash
npm install
npm run build
```

Le serveur lit automatiquement `../.env.local`. Il utilise uniquement la clé publique Supabase (`VITE_SUPABASE_ANON_KEY`), jamais la clé service.

## Configuration d’un client MCP

Exemple de configuration JSON (adapte le chemin Windows) :

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

Après avoir ajouté le serveur dans ton client IA, appelle `auth_login` avec l’e-mail et le mot de passe du compte MyGymTracker. La session reste en mémoire du processus MCP et peut être fermée avec `auth_logout`.

## Outils disponibles

- `auth_login`, `auth_status`, `auth_logout`
- `profile_get`, `profile_update`
- `workouts_list`, `workout_get`, `workout_create`, `workout_update`, `workout_delete`
- `workout_stats`
- `strength_list_blocks`, `strength_create_block`, `strength_update_block`, `strength_add_performance`
- `templates_list`, `exercise_suggestions`

Les requêtes sont toujours limitées à l’utilisateur connecté. Les règles RLS Supabase restent donc actives.
