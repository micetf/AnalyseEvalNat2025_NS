/**
 * Service de chargement des références nationales DEPP
 * Charge les moyennes France et Académie depuis les fichiers Excel
 *
 * @module services/referencesService
 * @requires xlsx
 * @author CPC Numérique
 */

import XLSX from "xlsx";
import path from "path";
import fs from "fs";

export class ReferencesService {
    /**
     * Initialise le service de références
     * @param {string} dataPath - Chemin vers data/
     */
    constructor(dataPath) {
        this.dataPath = dataPath;
        this.references = {};
    }

    /**
     * Charge les références pour un niveau et une matière
     * @param {string} niveau - CP, CE1, CE2, CM1, CM2
     * @param {string} matiere - francais, mathematiques
     * @param {string} academie - Nom de l'académie
     * @returns {Object}
     */
    loadReferences(niveau, matiere, academie = "GRENOBLE") {
        const filepath = path.join(
            this.dataPath,
            "references_nationales",
            `${niveau.toLowerCase()}-${matiere}-2025.xlsx`
        );

        try {
            if (!fs.existsSync(filepath)) {
                console.warn(`   ⚠️  Fichier non trouvé: ${niveau}-${matiere}`);
                return {};
            }

            const workbook = XLSX.readFile(filepath);
            const references = {};

            workbook.SheetNames.forEach((competence) => {
                const sheet = XLSX.utils.sheet_to_json(
                    workbook.Sheets[competence]
                );

                const france = sheet.find((row) => row.Modalite === "FRANCE");
                const acad = sheet.find((row) => row.Modalite === academie);

                if (france && acad) {
                    references[competence] = {
                        france: parseFloat(
                            france["Groupe au-dessus du seuil 2"]
                        ),
                        academie: parseFloat(
                            acad["Groupe au-dessus du seuil 2"]
                        ),
                    };
                }
            });

            this.references[`${niveau}_${matiere}`] = references;

            return references;
        } catch (error) {
            console.error(
                `   ❌ Erreur ${niveau}-${matiere}: ${error.message}`
            );
            return {};
        }
    }

    /**
     * Charge toutes les références
     * @param {string} academie - Nom académie
     */
    loadAllReferences(academie = "GRENOBLE") {
        const niveaux = ["CP", "CE1", "CE2", "CM1", "CM2"];
        const matieres = ["francais", "mathematiques"];

        console.log(`   📚 Chargement références DEPP pour ${academie}...\n`);

        for (const niveau of niveaux) {
            for (const matiere of matieres) {
                this.loadReferences(niveau, matiere, academie);
            }
        }
    }

    /**
     * Récupère une référence spécifique
     * @param {string} niveau - Niveau
     * @param {string} matiere - Matière
     * @param {string} competence - Nom compétence
     * @returns {Object|null}
     */
    getReference(niveau, matiere, competence) {
        const key = `${niveau}_${matiere}`;
        return this.references[key]?.[competence] || null;
    }
}
