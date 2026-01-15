/**
 * Programme principal - Analyse Stratégique IEN
 * Génère les 5 niveaux de lecture des résultats d'évaluations
 *
 * @module index
 * @author CPC Numérique
 */

import { OraceService } from "./services/oraceService.js";
import { IPSService } from "./services/ipsService.js";
import { ReferencesService } from "./services/referencesService.js";
import { AnalyseService } from "./services/analyseService.js";
import { StrategieService } from "./services/strategieService.js";
import { ExportService } from "./services/exportService.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration
 * À ADAPTER selon votre contexte
 */
const CONFIG = {
    DEPARTEMENT: "07", // Code département (ex: "07" pour Ardèche)
    ACADEMIE: "GRENOBLE", // Nom de l'académie
    CIRCONSCRIPTION: "Annonay", // Nom de la circonscription
    DATA_PATH: path.join(__dirname, "../data"),
    OUTPUT_PATH: path.join(__dirname, "../output"),
};

/**
 * Programme principal
 */
async function main() {
    console.log(
        "\n╔════════════════════════════════════════════════════════════╗"
    );
    console.log("║   ANALYSE STRATÉGIQUE IEN - 5 NIVEAUX DE LECTURE         ║");
    console.log("║   Outil d'aide à la décision pour pilotage circo         ║");
    console.log(
        "╚════════════════════════════════════════════════════════════╝\n"
    );

    const startTime = Date.now();

    try {
        // ═══════════════════════════════════════════════════════════
        // ÉTAPE 1 : Chargement ORACE
        // ═══════════════════════════════════════════════════════════
        console.log("📂 ÉTAPE 1/6 : Chargement ORACE");
        console.log("─".repeat(60));

        const oraceService = new OraceService(CONFIG.DATA_PATH);
        const ecoles = oraceService.loadEcoles();

        if (ecoles.length === 0) {
            throw new Error("❌ Aucune école trouvée dans ORACE");
        }

        console.log("");

        // ═══════════════════════════════════════════════════════════
        // ÉTAPE 2 : Récupération IPS
        // ═══════════════════════════════════════════════════════════
        console.log("🌐 ÉTAPE 2/6 : Récupération IPS");
        console.log("─".repeat(60));

        const ipsService = new IPSService();
        const ipsData = await ipsService.loadDepartementIPS(CONFIG.DEPARTEMENT);

        if (ipsData.length === 0) {
            throw new Error("❌ Aucun IPS récupéré");
        }

        console.log("");

        // ═══════════════════════════════════════════════════════════
        // ÉTAPE 3 : Fusion données + Filtrage écoles publiques
        // ═══════════════════════════════════════════════════════════
        console.log("🔗 ÉTAPE 3/6 : Fusion IPS + Résultats");
        console.log("─".repeat(60));

        const uais = ecoles.map((e) => e.uai);
        const ipsFound = await ipsService.getIPSBatch(uais);

        const ecolesWithIPSAll = ecoles
            .map((ecole) => {
                const ips = ipsFound.find((i) => i.uai === ecole.uai);
                return {
                    ...ecole,
                    ips: ips?.ips,
                    secteur: ips?.secteur,
                    academie: ips?.academie,
                    departement: ips?.departement,
                    nom_commune: ips?.nom_commune,
                };
            })
            .filter((e) => e.ips && !isNaN(e.ips));

        // Filtrer écoles publiques
        const ecolesWithIPS = ecolesWithIPSAll.filter((e) => {
            const secteur = (e.secteur || "").toLowerCase();
            return secteur === "public" || secteur.includes("public");
        });

        console.log(`   ✓ ${ecolesWithIPS.length} écoles publiques avec IPS`);
        console.log("");

        // ═══════════════════════════════════════════════════════════
        // ÉTAPE 4 : Références DEPP
        // ═══════════════════════════════════════════════════════════
        console.log("📚 ÉTAPE 4/6 : Chargement références DEPP");
        console.log("─".repeat(60));

        const referencesService = new ReferencesService(CONFIG.DATA_PATH);
        referencesService.loadAllReferences(CONFIG.ACADEMIE);
        console.log("");

        // ═══════════════════════════════════════════════════════════
        // ÉTAPE 5 : Analyse IPS
        // ═══════════════════════════════════════════════════════════
        console.log("🔬 ÉTAPE 5/6 : Analyse IPS et catégorisation");
        console.log("─".repeat(60));

        const analyseService = new AnalyseService(referencesService);
        analyseService.calculateRegressions(ecolesWithIPS);
        const analyses = analyseService.analyserTout(ecolesWithIPS);
        const syntheseEcoles = analyseService.genererSyntheseParEcole(analyses);

        if (analyses.length === 0) {
            throw new Error("❌ Aucune analyse générée");
        }

        console.log("");

        // ═══════════════════════════════════════════════════════════
        // ÉTAPE 6 : ANALYSE STRATÉGIQUE
        // ═══════════════════════════════════════════════════════════
        console.log("🎯 ÉTAPE 6/6 : Analyse stratégique IEN");
        console.log("─".repeat(60));

        const strategieService = new StrategieService(
            analyses,
            syntheseEcoles,
            analyseService.regressions
        );

        // NIVEAU 1 : Vue d'ensemble
        const vueEnsemble = strategieService.genererVueEnsemble();

        // NIVEAU 2 : Matrice de priorisation
        const { matrice, ecolesClassees } =
            strategieService.genererMatricePriorisation();

        // NIVEAU 3 : Portefeuille leviers
        const leviers = strategieService.genererPortefeuilleLeviers();

        // NIVEAU 4 : Plan d'actions
        const plan = strategieService.genererPlanActions(matrice);

        // NIVEAU 5 : Dashboard
        const dashboard = strategieService.genererDashboardPilotage(
            matrice,
            plan
        );

        // ═══════════════════════════════════════════════════════════
        // EXPORT EXCEL ET GRAPHIQUES
        // ═══════════════════════════════════════════════════════════
        const exportService = new ExportService(CONFIG.OUTPUT_PATH);

        // Génération du fichier Excel
        const filepath = exportService.genererFichierStrategique(
            {
                vueEnsemble,
                matrice,
                plan,
                leviers,
                dashboard,
                ecolesClassees,
            },
            CONFIG.ACADEMIE,
            CONFIG.DEPARTEMENT
        );

        // Génération des graphiques PDF
        const graphiquesPDF = await exportService.genererGraphiquesPDF(
            analyses,
            ecolesWithIPS,
            CONFIG.ACADEMIE,
            CONFIG.DEPARTEMENT,
            CONFIG.CIRCONSCRIPTION
        );

        // ═══════════════════════════════════════════════════════════
        // RÉSUMÉ FINAL
        // ═══════════════════════════════════════════════════════════
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log("\n" + "═".repeat(80));
        console.log("✅ ANALYSE STRATÉGIQUE TERMINÉE");
        console.log("═".repeat(80));
        console.log("");
        console.log(`⏱️  Durée : ${duration}s`);
        console.log(`📊 Fichier Excel : ${path.basename(filepath)}`);
        console.log(`📈 Graphiques PDF : ${graphiquesPDF.length} fichier(s)`);
        graphiquesPDF.forEach((f) => {
            console.log(`   • ${path.basename(f)}`);
        });
        console.log("");
        console.log("📋 PROCHAINES ACTIONS IEN :");
        console.log("   1. Consulter le Dashboard IEN (onglet 1)");
        console.log(
            "   2. Analyser les graphiques PDF (vision globale Maths/Français)"
        );
        console.log("   3. Prioriser visites selon Matrice (onglet 2)");
        console.log("   4. Planifier actions (onglet 3)");
        console.log("   5. Identifier leviers (onglet 4)");
        console.log("   6. Analyser profils écoles (onglet 5)");
        console.log("");
        console.log("═".repeat(80));
    } catch (error) {
        console.error(
            "\n╔════════════════════════════════════════════════════════════╗"
        );
        console.error(
            "║ ❌ ERREUR                                                  ║"
        );
        console.error(
            "╚════════════════════════════════════════════════════════════╝\n"
        );
        console.error("Message:", error.message);
        console.error("\nStack trace:");
        console.error(error.stack);
        console.error("");
        process.exit(1);
    }
}

// Lancement
main();
