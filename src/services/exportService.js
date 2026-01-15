/**
 * Service d'export Excel
 * Génère le fichier Excel stratégique avec tous les onglets
 *
 * @module services/exportService
 * @requires xlsx
 * @author CPC Numérique
 */

import { GraphiqueService } from "./graphiqueService.js";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";

export class ExportService {
    /**
     * Initialise le service d'export
     * @param {string} outputDir - Répertoire de sortie
     */
    constructor(outputDir) {
        this.outputDir = outputDir;

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }

    /**
     * Génère le fichier Excel complet
     * @param {Object} data - Toutes les données {vueEnsemble, matrice, plan, leviers, dashboard, ecolesClassees}
     * @param {string} academie - Nom académie
     * @param {string} departement - Code département
     * @returns {string} Chemin du fichier généré
     */
    genererFichierStrategique(data, academie, departement) {
        console.log("\n💾 GÉNÉRATION DU FICHIER STRATÉGIQUE");
        console.log("─".repeat(80));

        const wb = XLSX.utils.book_new();

        // Onglet 1 : Dashboard IEN
        console.log("   📄 Dashboard IEN");
        this.creerOngletDashboard(wb, data, academie, departement);

        // Onglet 2 : Matrice 3×3
        console.log("   📄 Matrice Priorisation");
        this.creerOngletMatrice(wb, data.matrice);

        // Onglet 3 : Plan d'actions
        console.log("   📄 Plan Actions");
        this.creerOngletPlan(wb, data.plan);

        // Onglet 4 : Portefeuille leviers
        console.log("   📄 Portefeuille Leviers");
        this.creerOngletLeviers(wb, data.leviers);

        // Onglet 5 : Écoles avec profils
        console.log("   📄 Écoles Profils");
        this.creerOngletEcoles(wb, data.ecolesClassees);

        // Sauvegarde
        const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/:/g, "-");

        const filename = `strategie_ien_dept${departement}_${timestamp}.xlsx`;
        const filepath = path.join(this.outputDir, filename);

        XLSX.writeFile(wb, filepath);
        console.log(`\n   ✓ Fichier généré: ${filename}`);

        return filepath;
    }

    /**
     * Crée l'onglet Dashboard IEN
     * @param {Object} wb - Workbook
     * @param {Object} data - Données
     * @param {string} academie - Académie
     * @param {string} departement - Département
     */
    creerOngletDashboard(wb, data, academie, departement) {
        const dashboardData = [
            ["DASHBOARD STRATÉGIQUE IEN"],
            ["Date:", new Date().toLocaleDateString("fr-FR")],
            ["Académie:", academie],
            ["Département:", departement],
            [""],
            ["INDICATEURS CLÉS"],
            ["Total écoles", data.dashboard.nb_ecoles_total],
            ["Écoles P0 (urgence)", data.dashboard.nb_ecoles_P0],
            ["Écoles P1 (prioritaire)", data.dashboard.nb_ecoles_P1],
            ["Écoles leviers", data.dashboard.nb_ecoles_leviers],
            [
                "Taux vigilance global",
                data.dashboard.taux_vigilance_global + "%",
            ],
            ["Taux leviers global", data.dashboard.taux_leviers_global + "%"],
            [""],
            ["PLAN D'ACTIONS"],
            ["Visites à programmer", data.dashboard.visites_a_programmer],
            ["Formations à organiser", data.dashboard.formations_a_organiser],
            ["Valorisations prévues", data.dashboard.valorisations_prevues],
            [""],
            ["VUE MATHS/FRANÇAIS"],
            [
                "",
                "Total",
                "Vigilance",
                "Taux vigil.",
                "Leviers",
                "Taux leviers",
                "R²",
            ],
            [
                "MATHS",
                data.vueEnsemble.Maths.total,
                data.vueEnsemble.Maths.vigilance,
                data.vueEnsemble.Maths.taux_vigilance + "%",
                data.vueEnsemble.Maths.leviers,
                data.vueEnsemble.Maths.taux_leviers + "%",
                data.vueEnsemble.Maths.r2_moyen,
            ],
            [
                "FRANÇAIS",
                data.vueEnsemble.Français.total,
                data.vueEnsemble.Français.vigilance,
                data.vueEnsemble.Français.taux_vigilance + "%",
                data.vueEnsemble.Français.leviers,
                data.vueEnsemble.Français.taux_leviers + "%",
                data.vueEnsemble.Français.r2_moyen,
            ],
        ];

        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.aoa_to_sheet(dashboardData),
            "📊 Dashboard IEN"
        );
    }

    /**
     * Crée l'onglet Matrice
     * @param {Object} wb - Workbook
     * @param {Object} matrice - Matrice 3×3
     */
    creerOngletMatrice(wb, matrice) {
        const matriceData = [
            ["MATRICE DE PRIORISATION (Maths × Français)"],
            [""],
            ["Profil", "Description", "Nb écoles", "Priorité", "Écoles"],
        ];

        const ordreProfiles = [
            { cle: "V,V", desc: "ACCOMPAGNEMENT GLOBAL URGENT", prio: "P0" },
            { cle: "V,C", desc: "ACCOMP. MATHS + SUIVI FR", prio: "P1" },
            { cle: "C,V", desc: "ACCOMP. FRANÇAIS + SUIVI MATHS", prio: "P1" },
            { cle: "V,L", desc: "ACCOMP. MATHS + VALORISER FR", prio: "P2" },
            {
                cle: "L,V",
                desc: "ACCOMP. FRANÇAIS + VALORISER MATHS",
                prio: "P2",
            },
            { cle: "C,C", desc: "SUIVI STANDARD", prio: "P3" },
            { cle: "C,L", desc: "SUIVI RENFORCÉ", prio: "P4" },
            { cle: "L,C", desc: "SUIVI RENFORCÉ", prio: "P4" },
            { cle: "L,L", desc: "EXCELLENCE À VALORISER", prio: "P5" },
        ];

        ordreProfiles.forEach((profil) => {
            const ecoles = matrice[profil.cle];
            const nomsEcoles = ecoles.map((e) => e.ecole).join(" | ");
            matriceData.push([
                profil.cle,
                profil.desc,
                ecoles.length,
                profil.prio,
                nomsEcoles,
            ]);
        });

        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.aoa_to_sheet(matriceData),
            "🎯 Matrice"
        );
    }

    /**
     * Crée l'onglet Plan d'actions
     * @param {Object} wb - Workbook
     * @param {Object} plan - Plan d'actions
     */
    creerOngletPlan(wb, plan) {
        const planData = [
            ["PLAN D'ACTIONS IEN"],
            [""],
            ["VISITES D'ACCOMPAGNEMENT"],
        ];

        plan.visites_accompagnement.forEach((v, idx) => {
            planData.push([
                `Visite ${idx + 1}`,
                v.ecole,
                v.type,
                `P${v.priorite}`,
                v.frequence,
            ]);
        });

        planData.push([""], ["ANIMATIONS PÉDAGOGIQUES"]);
        plan.animations_pedagogiques.forEach((anim, idx) => {
            planData.push([
                `Formation ${idx + 1}`,
                anim.titre,
                anim.public,
                anim.format,
            ]);
        });

        planData.push([""], ["VALORISATION LEVIERS"]);
        plan.valorisation_leviers.forEach((val, idx) => {
            planData.push([`Action ${idx + 1}`, val.ecole]);
        });

        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.aoa_to_sheet(planData),
            "📋 Plan Actions"
        );
    }

    /**
     * Crée l'onglet Portefeuille Leviers
     * @param {Object} wb - Workbook
     * @param {Array} leviers - Écoles leviers
     */
    creerOngletLeviers(wb, leviers) {
        const leviersExport = leviers.map((e) => ({
            Ecole: e.ecole,
            UAI: e.uai,
            IPS: e.ips,
            Categorie_IPS: e.categorie_ips,
            Nb_Leviers: e.nb_leviers,
            Nb_Total: e.nb_total,
            Taux_Leviers: e.taux_leviers,
            Profil: e.profil_global,
        }));

        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(leviersExport),
            "⭐ Leviers"
        );
    }

    /**
     * Crée l'onglet Écoles avec profils
     * @param {Object} wb - Workbook
     * @param {Array} ecolesClassees - Écoles avec profils
     */
    creerOngletEcoles(wb, ecolesClassees) {
        const ecolesExport = ecolesClassees.map((e) => ({
            Ecole: e.ecole,
            UAI: e.uai,
            IPS: e.ips,
            Categorie_IPS: e.categorie_ips,
            Profil_Maths: e.profil_maths,
            Profil_Francais: e.profil_francais,
            Profil_Croise: e.profil_croise,
            Priorite: `P${e.priorite}`,
            Leviers_Maths: e.maths.leviers,
            Vigil_Maths: e.maths.vigilance,
            Leviers_Francais: e.francais.leviers,
            Vigil_Francais: e.francais.vigilance,
        }));

        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(ecolesExport),
            "🏫 Écoles"
        );
    }

    /**
     * Génère les graphiques PDF par discipline
     * @param {Array} analyses - Toutes les analyses
     * @param {Array} ecolesWithIPS - Écoles avec IPS
     * @param {string} academie - Nom académie
     * @param {string} departement - Code département
     * @returns {Promise<Array>} Chemins des fichiers générés
     */
    async genererGraphiquesPDF(
        analyses,
        ecolesWithIPS,
        academie,
        departement,
        circonscription
    ) {
        const graphiqueService = new GraphiqueService(this.outputDir);
        return await graphiqueService.genererGraphiquesDisciplines(
            analyses,
            ecolesWithIPS,
            academie,
            departement,
            circonscription
        );
    }
}
