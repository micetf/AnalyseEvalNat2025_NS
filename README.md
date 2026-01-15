# Stratégie IEN - Outil d'Analyse Stratégique

## Description

Outil d'aide à la décision pour les Inspecteurs de l'Éducation Nationale (IEN).
Génère 5 niveaux de lecture complémentaires des résultats d'évaluations nationales.

## Installation

```bash
npm install
# ou
pnpm install
```

## Configuration

1. Placer les fichiers CSV ORACE dans `data/orace/csv/`
2. Placer les références DEPP dans `data/references_nationales/`
3. Adapter les paramètres dans `src/index.js` :
    - Code département
    - Nom académie

## Utilisation

```bash
npm start
# ou
pnpm start
```

## Sorties

Le fichier Excel généré contient :

1. Dashboard IEN (indicateurs clés)
2. Matrice de priorisation 3×3
3. Plan d'actions détaillé
4. Portefeuille des leviers
5. Liste complète des écoles avec profils

## Structure des données

-   **data/orace/csv/** : Exports CSV depuis ORACE (CIRCO*ecoles*\*.csv)
-   **data/references_nationales/** : Fichiers Excel DEPP (niveau-matiere-2025.xlsx)
-   **data/cache/** : Cache IPS (automatique)
-   **output/** : Fichiers Excel générés
