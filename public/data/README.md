# ANSES-CIQUAL 2025

`ciqual-2025.json` est une extraction des 3 484 aliments de la table officielle ANSES-CIQUAL 2025, téléchargée le 7 octobre 2026.

Source : https://doi.org/10.57745/RDMHWY — Licence Ouverte / Open Licence 2.0.

Colonnes : code aliment, nom français, nom anglais, énergie (règlement UE 1169/2011, kcal), protéines (N × facteurs de Jones), glucides, lipides, fibres. Valeurs pour **100 g de partie comestible**, même pour les boissons. Constituants XML : 328, 25000, 31000, 40000, 34100.

Les données manquantes restent `null`. Les valeurs `< x` sont représentées par leur limite supérieure x : il s'agit de valeurs approximatives, non de mesures exactes. Les noms conservent l'état cru/cuit. Aucune valeur n'est inventée.

Reproduction : télécharger les XML ALIM et COMPO depuis le dépôt officiel, les nommer `foods.xml` et `composition.xml`, puis utiliser `scripts/import-ciqual.ps1 -SourceDirectory <dossier>`.

Cette extraction ne contient **aucune donnée Open Food Facts**. Les produits de marque sont interrogés séparément via leur API (ODbL / Database Contents Licence). Les résultats en mémoire ne constituent pas une base redistribuée.
