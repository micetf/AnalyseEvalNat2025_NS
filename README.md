# Stratégie IEN - Outil d'Analyse Stratégique

## Description

Outil d'aide à la décision pour les Inspecteurs de l'Éducation Nationale (IEN).
Génère 5 niveaux de lecture complémentaires des résultats d'évaluations nationales en croisant les données ORACE avec l'Indice de Position Sociale (IPS).

## Logique métier

### Principe de calcul du % groupe satisfaisant

Pour chaque école et chaque matière (Maths ou Français), le pourcentage d'élèves satisfaisants est calculé selon la formule :

```
% satisfaisant = 100 × S / (B + F + S)
```

Où :

-   **S** = Cumul des effectifs "Satisfaisant" sur toutes les compétences de la matière
-   **F** = Cumul des effectifs "Fragile" sur toutes les compétences de la matière
-   **B** = Cumul des effectifs "À besoins" sur toutes les compétences de la matière

**Exemple concret :**
Une école avec 50 élèves évalués en Maths sur 5 compétences :

-   Total effectifs : 250 évaluations (50 élèves × 5 compétences)
-   Effectifs cumulés : B=60, F=80, S=110
-   % satisfaisant = 100 × 110 / (60 + 80 + 110) = **44%**

Cette approche **respecte les effectifs réels** : une compétence évaluée sur 100 élèves pèse plus qu'une compétence évaluée sur 10 élèves.

### Régression linéaire IPS

Pour chaque discipline, une régression linéaire est calculée entre :

-   **Variable X** : IPS de l'école (Indice de Position Sociale)
-   **Variable Y** : % groupe satisfaisant de l'école

Cette droite représente le **résultat attendu** en fonction du contexte socio-économique.

### Catégorisation des écoles

#### Catégorisation par compétence

Chaque compétence est catégorisée selon l'**écart** entre le résultat réel et le résultat attendu par la régression :

```
Écart = % satisfaisant réel - % satisfaisant attendu (régression)
```

| Catégorie     | Condition         | Couleur  | Signification                  |
| ------------- | ----------------- | -------- | ------------------------------ |
| **LEVIER**    | Écart > +7 points | 🟢 Vert  | Surperformance significative   |
| **CONFORME**  | -7 ≤ Écart ≤ +7   | 🟡 Jaune | Performance conforme à l'IPS   |
| **VIGILANCE** | Écart < -7 points | 🔴 Rouge | Sous-performance significative |

#### Profil global par école

**⚠️ Important** : Le profil global d'une école est déterminé par le **croisement des profils par matière** (Maths et Français), et non par le pourcentage de compétences en vigilance.

**Calcul du profil global** :

1. Calculer le **% satisfaisant moyen** pour Maths et Français (cumul effectifs B+F+S)
2. Déterminer le **profil de chaque matière** selon l'écart vs attendu IPS :

    - Écart > +7 → LEVIER
    - -7 ≤ Écart ≤ +7 → CONFORME
    - Écart < -7 → VIGILANCE

3. Croiser les deux profils pour obtenir le **profil global** :

| Maths \ Français | VIGILANCE                     | CONFORME             | LEVIER            |
| ---------------- | ----------------------------- | -------------------- | ----------------- |
| **VIGILANCE**    | 🔴 ACCOMPAGNEMENT PRIORITAIRE | 🟠 VIGILANCE MODÉRÉE | 🟡 SUIVI RENFORCÉ |
| **CONFORME**     | 🟠 VIGILANCE MODÉRÉE          | 🟡 SUIVI STANDARD    | 🟡 SUIVI RENFORCÉ |
| **LEVIER**       | 🟡 SUIVI RENFORCÉ             | 🟡 SUIVI RENFORCÉ    | 🟢 ÉCOLE LEVIER   |

**Avantages de cette approche** :

✅ **Cohérence totale** : Le profil global correspond exactement aux graphiques PDF  
✅ **Pertinence pédagogique** : Une école n'est en "ACCOMPAGNEMENT PRIORITAIRE" que si elle est en difficulté sur **les deux matières** principales  
✅ **Nuances préservées** : Les profils intermédiaires permettent de distinguer les situations mixtes

**Exemple** :

-   École avec % satisfaisant Maths = 52% (attendu 50%, écart +2) → CONFORME
-   École avec % satisfaisant Français = 48% (attendu 50%, écart -2) → CONFORME
-   Profil global = CONFORME × CONFORME → **🟡 SUIVI STANDARD**

Même si cette école a 20 compétences individuelles en vigilance (33%), son profil global est "SUIVI STANDARD" car sa performance moyenne par matière est conforme à l'attendu IPS.

### Matrice de priorisation 3×3

Chaque école est positionnée dans une matrice croisant Maths (M) et Français (F), avec 9 profils possibles :

| Profil | Description                        | Priorité |
| ------ | ---------------------------------- | -------- |
| (V,V)  | ACCOMPAGNEMENT GLOBAL URGENT       | P0       |
| (V,C)  | ACCOMP. MATHS + SUIVI FRANÇAIS     | P1       |
| (C,V)  | ACCOMP. FRANÇAIS + SUIVI MATHS     | P1       |
| (V,L)  | ACCOMP. MATHS + VALORISER FRANÇAIS | P2       |
| (L,V)  | ACCOMP. FRANÇAIS + VALORISER MATHS | P2       |
| (C,C)  | SUIVI STANDARD                     | P3       |
| (C,L)  | SUIVI RENFORCÉ + OBSERVATION       | P4       |
| (L,C)  | SUIVI RENFORCÉ + OBSERVATION       | P4       |
| (L,L)  | EXCELLENCE À VALORISER             | P5       |

## Installation

```bash
npm install
# ou
pnpm install
```

## Configuration

### 1. Fichiers sources

Placer les fichiers dans l'arborescence suivante :

```
data/
├── orace/
│   └── csv/
│       ├── CIRCO_ecoles_CPFR.csv
│       ├── CIRCO_ecoles_CPMA.csv
│       ├── CIRCO_ecoles_CE1FR.csv
│       ├── CIRCO_ecoles_CE1MA.csv
│       ├── CIRCO_ecoles_CE2FR.csv
│       ├── CIRCO_ecoles_CE2MA.csv
│       ├── CIRCO_ecoles_CM1FR.csv
│       ├── CIRCO_ecoles_CM1MA.csv
│       ├── CIRCO_ecoles_CM2FR.csv
│       └── CIRCO_ecoles_CM2MA.csv
└── references_nationales/
    ├── cp-francais-2025.xlsx
    ├── cp-mathematiques-2025.xlsx
    ├── ce1-francais-2025.xlsx
    ├── ce1-mathematiques-2025.xlsx
    ├── ce2-francais-2025.xlsx
    ├── ce2-mathematiques-2025.xlsx
    ├── cm1-francais-2025.xlsx
    ├── cm1-mathematiques-2025.xlsx
    ├── cm2-francais-2025.xlsx
    └── cm2-mathematiques-2025.xlsx
```

### 2. Paramètres de l'outil

Éditer `src/index.js` pour configurer :

```javascript
const CONFIG = {
    DEPARTEMENT: "07", // Code département
    ACADEMIE: "GRENOBLE", // Nom académie (en MAJUSCULES)
    CIRCONSCRIPTION: "Annonay", // Nom circonscription
    DATA_PATH: path.join(__dirname, "../data"),
    OUTPUT_PATH: path.join(__dirname, "../output"),
};
```

## Structure des fichiers CSV ORACE

Les fichiers CSV doivent contenir pour chaque compétence :

-   Une colonne **effectif** pour chaque groupe (À besoins, Fragile, Satisfaisant)
-   Les colonnes de pourcentages sont ignorées

**Exemple de structure attendue :**

| UAI      | Nom établissement | Compétence 1 - À besoins (effectif) | Compétence 1 - Fragile (effectif) | Compétence 1 - Satisfaisant (effectif) | ... |
| -------- | ----------------- | ----------------------------------- | --------------------------------- | -------------------------------------- | --- |
| 0070001A | École A           | 5                                   | 10                                | 35                                     | ... |
| 0070002B | École B           | 8                                   | 12                                | 30                                     | ... |

## Utilisation

```bash
npm start
# ou
pnpm start
```

## Sorties générées

### 1. Fichier Excel stratégique

**Nom :** `strategie_ien_dept{XX}_{timestamp}.xlsx`

**Contenu :**

#### Onglet 1 : 📊 Dashboard IEN

-   Indicateurs clés (nb écoles, taux vigilance/leviers)
-   Vue d'ensemble Maths/Français
-   Plan d'actions synthétique

#### Onglet 2 : 🎯 Matrice

-   Matrice de priorisation 3×3
-   Liste des écoles par profil croisé
-   Priorités d'intervention (P0 à P5)

#### Onglet 3 : 📋 Plan Actions

-   Visites d'accompagnement prioritaires
-   Animations pédagogiques recommandées
-   Actions de valorisation des leviers

#### Onglet 4 : ⭐ Leviers

-   Écoles leviers identifiées (≥30% compétences en surperformance)
-   Taux de leviers par école
-   Données IPS et profil global
-   **Nouvelles colonnes (v1.1.0)** :
-   `profil_maths` : Profil Maths (LEVIER / CONFORME / VIGILANCE)
-   `profil_francais` : Profil Français (LEVIER / CONFORME / VIGILANCE)
-   `pct_satisfaisant_maths` : % satisfaisant moyen en Maths
-   `pct_satisfaisant_francais` : % satisfaisant moyen en Français

#### Onglet 5 : 🏫 Écoles

-   Liste complète des écoles
-   Profils Maths, Français et croisé
-   Priorité d'intervention
-   Détail leviers/vigilance par matière

### 2. Graphiques PDF

Deux fichiers PDF générés :

-   `graphique_maths_dept{XX}_{timestamp}.pdf`
-   `graphique_francais_dept{XX}_{timestamp}.pdf`

**Contenu de chaque graphique :**

-   Nuage de points : IPS (axe X) × % satisfaisant (axe Y)
-   Droite de régression linéaire
-   Zones colorées (vert = leviers, rouge = vigilance)
-   Liste numérotée de toutes les écoles
-   Légende et interprétation

**Note** : Les profils affichés dans les graphiques PDF sont **cohérents** avec les profils de l'onglet Leviers depuis la version 1.1.0.

## Architecture du code

```
src/
├── index.js                    # Point d'entrée
├── services/
│   ├── oraceService.js         # Chargement CSV + extraction effectifs
│   ├── ipsService.js           # Récupération IPS via API data.gouv
│   ├── referencesService.js    # Chargement références DEPP
│   ├── analyseService.js       # Régressions + catégorisation + profil global
│   ├── strategieService.js     # 5 niveaux de lecture
│   ├── exportService.js        # Génération Excel
│   └── graphiqueService.js     # Génération PDF
└── utils/
    └── categorisation.js       # Fonctions de classification
```

## Dépendances principales

-   **xlsx** : Lecture/écriture fichiers Excel
-   **pdfkit** : Génération de PDF
-   **simple-statistics** : Calculs de régression linéaire
-   **axios** : Appels API data.gouv
-   **csv-parse** : Parsing des fichiers CSV

## Cache IPS

Les données IPS sont automatiquement mises en cache dans `data/cache/` pour :

-   Éviter les appels répétés à l'API
-   Améliorer les performances
-   Cache valide 30 jours

Pour forcer le rafraîchissement, supprimer le fichier de cache correspondant.

## Limites et précautions

1. **Effectifs requis** : Chaque compétence doit avoir des effectifs B, F, S dans les CSV
2. **Minimum 4 écoles** : Nécessaire pour calculer une régression significative
3. **IPS obligatoire** : Seules les écoles publiques avec IPS sont analysées
4. **Références DEPP** : Fichiers Excel au format attendu par la DEPP
5. **Seuils fixes** : Les seuils ±7 points sont constants (non paramétrables actuellement)

## Interprétation pédagogique

### Coefficient R² de la régression

Le R² mesure la part de variance expliquée par l'IPS :

| R²      | Interprétation                                               |
| ------- | ------------------------------------------------------------ |
| > 0.7   | IPS très déterminant → Marge de manœuvre limitée             |
| 0.5-0.7 | IPS déterminant → Pratiques pédagogiques influentes          |
| 0.3-0.5 | IPS modérément déterminant → Leviers pédagogiques importants |
| < 0.3   | Faible influence IPS → Forte marge de manœuvre ✨            |

### Utilisation des graphiques PDF

Les graphiques permettent de :

1. **Identifier visuellement** les écoles surperformantes (au-dessus de la droite)
2. **Prioriser les accompagnements** (écoles en zone rouge)
3. **Valoriser les pratiques** (écoles leviers en zone verte)
4. **Mesurer l'équité** (dispersion autour de la droite)

### Cohérence Excel / PDF

Depuis la version 1.1.0, le profil global affiché dans l'onglet Leviers est **strictement cohérent** avec la position des écoles sur les graphiques PDF :

-   Une école en zone verte (LEVIER) sur Maths et Français aura le profil **🟢 ÉCOLE LEVIER**
-   Une école en zone rouge (VIGILANCE) sur les deux matières aura le profil **🔴 ACCOMPAGNEMENT PRIORITAIRE**
-   Une école en zone jaune (CONFORME) sur les deux matières aura le profil **🟡 SUIVI STANDARD**

Cette cohérence permet une lecture stratégique unifiée entre les différentes vues.

## Changelog

### Version 1.1.0 (Janvier 2025)

**🔧 Correction majeure : Cohérence profil global / graphiques PDF**

-   **Problème corrigé** : Certaines écoles apparaissaient avec le profil "ACCOMPAGNEMENT PRIORITAIRE" dans l'onglet Leviers alors qu'elles étaient en zone CONFORME sur les deux graphiques PDF.

-   **Cause** : Deux logiques de catégorisation coexistaient :

    -   Onglet Leviers : Basé sur le % de compétences en vigilance (≥30% → prioritaire)
    -   Graphiques PDF : Basé sur le % satisfaisant moyen par matière vs attendu IPS

-   **Solution implémentée** : Harmonisation des logiques

    -   Le profil global est maintenant calculé **par matière** comme dans les graphiques
    -   Croisement des profils Maths × Français pour obtenir le profil global
    -   Cohérence totale entre Excel et PDF

-   **Nouvelles colonnes** ajoutées dans l'onglet Leviers :

    -   `profil_maths` : LEVIER / CONFORME / VIGILANCE
    -   `profil_francais` : LEVIER / CONFORME / VIGILANCE
    -   `pct_satisfaisant_maths` : % satisfaisant moyen en Maths
    -   `pct_satisfaisant_francais` : % satisfaisant moyen en Français

-   **Impact** : Certaines écoles peuvent changer de profil global (normal et souhaitable)
    -   Exemple : École avec 30% compétences en vigilance mais performance moyenne correcte → passe de "PRIORITAIRE" à "SUIVI STANDARD"
    -   Plus pertinent pédagogiquement car basé sur la performance globale par matière

### Version 1.0.0 (Janvier 2025)

-   Version initiale avec 5 niveaux de lecture
-   Export Excel stratégique
-   Graphiques PDF par discipline
-   Matrice de priorisation 3×3
-   Portefeuille des leviers

## Support et contribution

Pour toute question ou amélioration, contacter le CPC Numérique.

## Licence

MIT

---

**Auteur :** CPC Numérique  
**Version :** 1.1.0  
**Dernière mise à jour :** Janvier 2025
