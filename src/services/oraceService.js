/**
 * Service de chargement des données ORACE depuis CSV
 * Lit les fichiers CSV exportés depuis ORACE et structure les données
 *
 * @module services/oraceService
 * @requires csv-parse
 * @author CPC Numérique
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

export class OraceService {
    /**
     * Initialise le service ORACE
     * @param {string} dataPath - Chemin vers le dossier data/
     */
    constructor(dataPath) {
        this.dataPath = dataPath;
        this.ecoles = [];
    }

    /**
     * Charge toutes les écoles depuis les fichiers CSV
     * @returns {Array} Tableau d'écoles avec leurs résultats
     */
    loadEcoles() {
        console.log("   📂 Chargement depuis fichiers CSV...\n");

        const configs = [
            { niveau: "CP", matiere: "francais", prefix: "cpfr" },
            { niveau: "CP", matiere: "maths", prefix: "cpma" },
            { niveau: "CE1", matiere: "francais", prefix: "ce1fr" },
            { niveau: "CE1", matiere: "maths", prefix: "ce1ma" },
            { niveau: "CE2", matiere: "francais", prefix: "ce2fr" },
            { niveau: "CE2", matiere: "maths", prefix: "ce2ma" },
            { niveau: "CM1", matiere: "francais", prefix: "cm1fr" },
            { niveau: "CM1", matiere: "maths", prefix: "cm1ma" },
            { niveau: "CM2", matiere: "francais", prefix: "cm2fr" },
            { niveau: "CM2", matiere: "maths", prefix: "cm2ma" },
        ];

        const ecolesMap = new Map();

        configs.forEach((config) => {
            const fichier = `CIRCO_ecoles_${config.prefix.toUpperCase()}.csv`;
            const resultats = this.chargerFichierCSV(
                fichier,
                config.niveau,
                config.matiere
            );

            resultats.forEach((ecole) => {
                if (!ecolesMap.has(ecole.uai)) {
                    ecolesMap.set(ecole.uai, {
                        uai: ecole.uai,
                        nom: ecole.nom,
                        resultats: {},
                    });
                }

                const ecoleExistante = ecolesMap.get(ecole.uai);
                Object.assign(ecoleExistante.resultats, ecole.resultats);
            });
        });

        this.ecoles = Array.from(ecolesMap.values());

        console.log(
            `\n   ✅ ${this.ecoles.length} écoles uniques chargées depuis CSV`
        );

        if (this.ecoles.length > 0) {
            const nbCompetences = Object.keys(this.ecoles[0].resultats).length;
            console.log(`   ✅ ~${nbCompetences} résultats par école`);
        }

        return this.ecoles;
    }

    /**
     * Charge un fichier CSV spécifique
     * @param {string} nomFichier - Nom du fichier CSV
     * @param {string} niveau - Niveau scolaire
     * @param {string} matiere - Matière
     * @returns {Array} Tableau d'écoles
     */
    chargerFichierCSV(nomFichier, niveau, matiere) {
        const cheminComplet = path.join(
            this.dataPath,
            "orace",
            "csv",
            nomFichier
        );

        console.log(`   📊 Traitement: ${nomFichier}`);

        try {
            if (!fs.existsSync(cheminComplet)) {
                console.warn(`      ⚠️  Fichier non trouvé - ignoré`);
                return [];
            }

            const contenu = fs.readFileSync(cheminComplet, "utf-8");
            const lignes = parse(contenu, {
                delimiter: ";",
                skip_empty_lines: false,
                relax_column_count: true,
                trim: true,
            });

            if (!this.validerIdentification(lignes[0], niveau, matiere)) {
                console.warn(`      ❌ Identification invalide`);
                return [];
            }

            const ligneGroupes = this.trouverLigneGroupes(lignes);
            if (ligneGroupes === null) {
                console.warn(`      ⚠️  Ligne groupes non trouvée`);
                return [];
            }

            const lignePourcentages = this.trouverLignePourcentages(
                lignes,
                ligneGroupes
            );
            if (lignePourcentages === null) {
                console.warn(`      ⚠️  Ligne pourcentages non trouvée`);
                return [];
            }

            const competences = this.extraireCompetences(
                lignes[2],
                lignes[ligneGroupes],
                lignes[lignePourcentages]
            );

            if (competences.length === 0) {
                console.warn(`      ⚠️  Aucune compétence trouvée`);
                return [];
            }

            const premiereLigneEcole = this.trouverPremiereEcole(
                lignes,
                lignePourcentages
            );
            const ecoles = this.extraireEcoles(
                lignes.slice(premiereLigneEcole),
                competences,
                niveau,
                matiere
            );

            console.log(`      ✓ ${ecoles.length} écoles extraites`);
            return ecoles;
        } catch (error) {
            console.error(`      ❌ Erreur: ${error.message}`);
            return [];
        }
    }

    /**
     * Valide l'identification du fichier
     * @param {Array} ligne1 - Première ligne du CSV
     * @param {string} niveau - Niveau attendu
     * @param {string} matiere - Matière attendue
     * @returns {boolean}
     */
    validerIdentification(ligne1, niveau, matiere) {
        if (!ligne1 || ligne1.length === 0) return false;

        const matiereCode = matiere === "francais" ? "fr" : "ma";
        const patternAttendu = `evaluation ${niveau.toLowerCase()}${matiereCode}`;

        return ligne1.some(
            (cellule) =>
                cellule && cellule.toLowerCase().includes(patternAttendu)
        );
    }

    /**
     * Trouve la ligne contenant "Groupe satisfaisant"
     * @param {Array} lignes - Toutes les lignes du CSV
     * @returns {number|null} Index de la ligne
     */
    trouverLigneGroupes(lignes) {
        for (let i = 2; i < Math.min(10, lignes.length); i++) {
            const contientGroupe = lignes[i].some(
                (cellule) =>
                    cellule && cellule.toLowerCase().includes("satisfaisant")
            );
            if (contientGroupe) return i;
        }
        return null;
    }

    /**
     * Trouve la ligne contenant les pourcentages
     * @param {Array} lignes - Toutes les lignes
     * @param {number} ligneGroupes - Index ligne groupes
     * @returns {number|null}
     */
    trouverLignePourcentages(lignes, ligneGroupes) {
        for (
            let i = ligneGroupes + 1;
            i < Math.min(ligneGroupes + 4, lignes.length);
            i++
        ) {
            const contientPourcentage = lignes[i].some(
                (cellule) =>
                    cellule &&
                    (cellule.toLowerCase().includes("%") ||
                        cellule.toLowerCase().includes("répondants"))
            );
            if (contientPourcentage) return i;
        }
        return null;
    }

    /**
     * Trouve la première ligne de données d'écoles
     * @param {Array} lignes - Toutes les lignes
     * @param {number} lignePourcentages - Index ligne pourcentages
     * @returns {number}
     */
    trouverPremiereEcole(lignes, lignePourcentages) {
        for (let i = lignePourcentages + 1; i < lignes.length; i++) {
            const ligne = lignes[i];
            const uai = (ligne[0] || "").trim();
            const nom = (ligne[1] || "").trim();

            if (
                uai &&
                nom &&
                !uai.toLowerCase().includes("uai") &&
                !uai.toLowerCase().includes("total") &&
                uai.length >= 7
            ) {
                return i;
            }
        }
        return 10;
    }

    /**
     * Extrait les compétences depuis la ligne 3
     * @param {Array} ligne3 - Ligne des compétences
     * @param {Array} ligneGroupes - Ligne des groupes
     * @param {Array} lignePourcentages - Ligne des pourcentages
     * @returns {Array} Compétences avec colonnes
     */
    extraireCompetences(ligne3, ligneGroupes, lignePourcentages) {
        const competences = [];
        let competenceEnCours = null;
        let colonneDebutCompetence = null;

        ligne3.forEach((cellule, index) => {
            const texte = (cellule || "").trim();

            if (texte.length > 0) {
                const estCompetence =
                    texte.length >= 10 &&
                    !texte.toLowerCase().includes("compétence") &&
                    !texte.toLowerCase().includes("exercice");

                if (estCompetence) {
                    if (competenceEnCours) {
                        this.finaliserCompetence(
                            competences,
                            competenceEnCours,
                            colonneDebutCompetence,
                            index - 1,
                            ligneGroupes,
                            lignePourcentages
                        );
                    }

                    competenceEnCours = texte;
                    colonneDebutCompetence = index;
                }
            }
        });

        if (competenceEnCours) {
            this.finaliserCompetence(
                competences,
                competenceEnCours,
                colonneDebutCompetence,
                ligne3.length - 1,
                ligneGroupes,
                lignePourcentages
            );
        }

        return competences;
    }

    /**
     * Finalise une compétence en trouvant sa colonne de pourcentage
     * @param {Array} competences - Tableau des compétences
     * @param {string} nomCompetence - Nom de la compétence
     * @param {number} colDebut - Colonne de début
     * @param {number} colFin - Colonne de fin
     * @param {Array} ligneGroupes - Ligne des groupes
     * @param {Array} lignePourcentages - Ligne des pourcentages
     */
    finaliserCompetence(
        competences,
        nomCompetence,
        colDebut,
        colFin,
        ligneGroupes,
        lignePourcentages
    ) {
        let colonneSatisfaisantGroupe = null;

        for (let col = colDebut; col <= colFin; col++) {
            const texte = (ligneGroupes[col] || "").toLowerCase().trim();
            if (texte.includes("satisfaisant")) {
                colonneSatisfaisantGroupe = col;
                break;
            }
        }

        if (colonneSatisfaisantGroupe === null) return;

        let colonnePourcentage = null;

        for (
            let col = colonneSatisfaisantGroupe;
            col <= Math.min(colonneSatisfaisantGroupe + 3, colFin);
            col++
        ) {
            const texte = (lignePourcentages[col] || "").toLowerCase().trim();
            if (texte.includes("%") || texte.includes("répondants")) {
                colonnePourcentage = col;
                break;
            }
        }

        if (colonnePourcentage !== null) {
            competences.push({
                nom: nomCompetence,
                colonne: colonnePourcentage,
            });
        } else {
            competences.push({
                nom: nomCompetence,
                colonne: colonneSatisfaisantGroupe + 1,
            });
        }
    }

    /**
     * Extrait les données des écoles
     * @param {Array} lignesEcoles - Lignes contenant les écoles
     * @param {Array} competences - Compétences identifiées
     * @param {string} niveau - Niveau
     * @param {string} matiere - Matière
     * @returns {Array} Écoles avec résultats
     */
    extraireEcoles(lignesEcoles, competences, niveau, matiere) {
        const ecoles = [];

        lignesEcoles.forEach((ligne) => {
            const uai = (ligne[0] || "").trim();
            const nom = (ligne[1] || "").trim();

            if (!uai || uai.toLowerCase().includes("total")) return;

            const resultats = {};

            competences.forEach((comp) => {
                const valeurCellule = ligne[comp.colonne];
                const pctSatisfaisant = this.parsePourcentage(valeurCellule);

                if (pctSatisfaisant !== null) {
                    const nomNormalise = this.normaliserNomCompetence(comp.nom);
                    const cleCompetence = `${niveau}_${matiere}_${nomNormalise}`;
                    resultats[cleCompetence] = pctSatisfaisant;
                }
            });

            if (Object.keys(resultats).length > 0) {
                ecoles.push({ uai, nom, resultats });
            }
        });

        return ecoles;
    }

    /**
     * Parse un pourcentage
     * @param {string} valeur - Valeur à parser
     * @returns {number|null}
     */
    parsePourcentage(valeur) {
        if (valeur === null || valeur === undefined || valeur === "")
            return null;

        let valeurStr = valeur.toString().trim();
        valeurStr = valeurStr.replace("%", "").replace(",", ".");

        const valeurNum = parseFloat(valeurStr);
        if (isNaN(valeurNum)) return null;

        if (valeurNum > 0 && valeurNum < 1) return valeurNum * 100;
        return valeurNum;
    }

    /**
     * Normalise un nom de compétence
     * @param {string} nom - Nom à normaliser
     * @returns {string}
     */
    normaliserNomCompetence(nom) {
        return nom
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[()]/g, "")
            .replace(/[éèê]/g, "e")
            .replace(/[àâ]/g, "a")
            .replace(/[îï]/g, "i")
            .replace(/[ôö]/g, "o")
            .replace(/[ùû]/g, "u")
            .replace(/ç/g, "c")
            .replace(/'/g, "")
            .substring(0, 100);
    }

    /**
     * Retourne les écoles chargées
     * @returns {Array}
     */
    getEcoles() {
        return this.ecoles;
    }
}
