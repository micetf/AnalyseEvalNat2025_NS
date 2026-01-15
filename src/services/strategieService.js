/**
 * Service de stratégie de lecture IEN
 * Implémente les 5 niveaux de lecture complémentaires
 *
 * @module services/strategieService
 * @author CPC Numérique
 */

import {
    determinerProfilMatiere,
    calculerPriorite,
    getEmojiProfil,
    getDescriptionProfil,
    interpreterR2,
} from "../utils/categorisation.js";

export class StrategieService {
    /**
     * Initialise le service de stratégie
     * @param {Array} analyses - Toutes les analyses
     * @param {Array} syntheseEcoles - Synthèse par école
     * @param {Object} regressions - Régressions par compétence
     */
    constructor(analyses, syntheseEcoles, regressions) {
        this.analyses = analyses;
        this.syntheseEcoles = syntheseEcoles;
        this.regressions = regressions;
    }

    /**
     * NIVEAU 1 : Vue d'ensemble circonscription
     * @returns {Object} Statistiques globales par matière
     */
    genererVueEnsemble() {
        console.log("\n📊 NIVEAU 1 : Vue d'ensemble circonscription");
        console.log("─".repeat(80));

        const parMatiere = {
            Maths: {
                leviers: 0,
                conformes: 0,
                vigilance: 0,
                total: 0,
                r2_moyen: 0,
            },
            Français: {
                leviers: 0,
                conformes: 0,
                vigilance: 0,
                total: 0,
                r2_moyen: 0,
            },
        };

        // Agréger par matière
        this.analyses.forEach((a) => {
            const matiere = a.matiere === "Français" ? "Français" : "Maths";
            parMatiere[matiere].total++;

            if (a.categorie_code === "LEVIER") parMatiere[matiere].leviers++;
            else if (a.categorie_code === "VIGILANCE")
                parMatiere[matiere].vigilance++;
            else parMatiere[matiere].conformes++;
        });

        // Calculer R² moyen
        const r2ParMatiere = { Maths: [], Français: [] };
        Object.keys(this.regressions).forEach((comp) => {
            const parts = comp.split("_");
            const matiere = parts[1] === "francais" ? "Français" : "Maths";
            if (this.regressions[comp].r2) {
                r2ParMatiere[matiere].push(this.regressions[comp].r2);
            }
        });

        parMatiere.Maths.r2_moyen =
            r2ParMatiere.Maths.length > 0
                ? r2ParMatiere.Maths.reduce((a, b) => a + b, 0) /
                  r2ParMatiere.Maths.length
                : 0;

        parMatiere.Français.r2_moyen =
            r2ParMatiere.Français.length > 0
                ? r2ParMatiere.Français.reduce((a, b) => a + b, 0) /
                  r2ParMatiere.Français.length
                : 0;

        // Calculs de taux
        Object.keys(parMatiere).forEach((matiere) => {
            const data = parMatiere[matiere];
            data.taux_vigilance =
                data.total > 0
                    ? ((data.vigilance / data.total) * 100).toFixed(1)
                    : "0";
            data.taux_leviers =
                data.total > 0
                    ? ((data.leviers / data.total) * 100).toFixed(1)
                    : "0";
            data.r2_moyen = data.r2_moyen.toFixed(3);
        });

        // Affichage
        console.log("\n📈 MATHS");
        console.log(
            `   Vigilance : ${parMatiere.Maths.vigilance} analyses (${parMatiere.Maths.taux_vigilance}%)`
        );
        console.log(
            `   Leviers   : ${parMatiere.Maths.leviers} analyses (${parMatiere.Maths.taux_leviers}%)`
        );
        console.log(
            `   R² moyen  : ${parMatiere.Maths.r2_moyen} → ${interpreterR2(
                parseFloat(parMatiere.Maths.r2_moyen)
            )}`
        );

        console.log("\n📚 FRANÇAIS");
        console.log(
            `   Vigilance : ${parMatiere.Français.vigilance} analyses (${parMatiere.Français.taux_vigilance}%)`
        );
        console.log(
            `   Leviers   : ${parMatiere.Français.leviers} analyses (${parMatiere.Français.taux_leviers}%)`
        );
        console.log(
            `   R² moyen  : ${parMatiere.Français.r2_moyen} → ${interpreterR2(
                parseFloat(parMatiere.Français.r2_moyen)
            )}`
        );

        // Recommandations
        console.log("\n💡 RECOMMANDATIONS STRATÉGIQUES :");

        const tauxVigMaths = parseFloat(parMatiere.Maths.taux_vigilance);
        const tauxVigFR = parseFloat(parMatiere.Français.taux_vigilance);

        if (tauxVigMaths > tauxVigFR + 10) {
            console.log("   ⚠️  Priorité MATHS");
        } else if (tauxVigFR > tauxVigMaths + 10) {
            console.log("   ⚠️  Priorité FRANÇAIS");
        } else {
            console.log("   ✓ Accompagnement équilibré recommandé");
        }

        return parMatiere;
    }

    /**
     * NIVEAU 2 : Matrice de priorisation 3×3
     * @returns {Object} Matrice et écoles classées
     */
    genererMatricePriorisation() {
        console.log("\n\n🔍 NIVEAU 2 : Matrice de priorisation");
        console.log("─".repeat(80));

        // Créer profils par école
        const profilsEcoles = new Map();

        this.analyses.forEach((a) => {
            if (!profilsEcoles.has(a.uai)) {
                profilsEcoles.set(a.uai, {
                    uai: a.uai,
                    ecole: a.ecole,
                    ips: a.ips,
                    categorie_ips: a.categorie_ips,
                    secteur: a.secteur,
                    maths: { leviers: 0, conformes: 0, vigilance: 0 },
                    francais: { leviers: 0, conformes: 0, vigilance: 0 },
                });
            }

            const profil = profilsEcoles.get(a.uai);
            const matiere = a.matiere === "Français" ? "francais" : "maths";

            if (a.categorie_code === "LEVIER") profil[matiere].leviers++;
            else if (a.categorie_code === "VIGILANCE")
                profil[matiere].vigilance++;
            else profil[matiere].conformes++;
        });

        // Déterminer profils dominants
        const ecolesClassees = Array.from(profilsEcoles.values()).map((e) => {
            const profilMaths = determinerProfilMatiere(e.maths);
            const profilFrancais = determinerProfilMatiere(e.francais);

            return {
                ...e,
                profil_maths: profilMaths,
                profil_francais: profilFrancais,
                profil_croise: `(${profilMaths},${profilFrancais})`,
                priorite: calculerPriorite(profilMaths, profilFrancais),
            };
        });

        // Construire matrice
        const matrice = {
            "V,V": [],
            "V,C": [],
            "V,L": [],
            "C,V": [],
            "C,C": [],
            "C,L": [],
            "L,V": [],
            "L,C": [],
            "L,L": [],
        };

        ecolesClassees.forEach((e) => {
            const cle = `${e.profil_maths},${e.profil_francais}`;
            if (matrice[cle]) {
                matrice[cle].push(e);
            }
        });

        // Affichage
        console.log("\n📊 MATRICE DE PRIORISATION (Maths × Français)\n");

        const afficherCellule = (cle, priorite) => {
            const ecoles = matrice[cle];
            const emoji = getEmojiProfil(`(${cle})`);
            const desc = getDescriptionProfil(`(${cle})`);

            console.log(
                `${emoji} ${cle.padEnd(6)} │ ${desc.padEnd(
                    35
                )} │ ${ecoles.length
                    .toString()
                    .padStart(2)} écoles │ P${priorite}`
            );

            if (ecoles.length > 0) {
                ecoles.slice(0, 2).forEach((e) => {
                    console.log(
                        `           │ → ${e.ecole.substring(0, 45)} (IPS ${
                            e.ips
                        })`
                    );
                });
                if (ecoles.length > 2) {
                    console.log(
                        `           │   ... et ${ecoles.length - 2} autre(s)`
                    );
                }
            }
            console.log("");
        };

        afficherCellule("V,V", 0);
        afficherCellule("V,C", 1);
        afficherCellule("C,V", 1);
        afficherCellule("V,L", 2);
        afficherCellule("L,V", 2);
        afficherCellule("C,C", 3);
        afficherCellule("C,L", 4);
        afficherCellule("L,C", 4);
        afficherCellule("L,L", 5);

        return { matrice, ecolesClassees };
    }

    /**
     * NIVEAU 3 : Portefeuille des leviers
     * @returns {Array} Écoles leviers
     */
    genererPortefeuilleLeviers() {
        console.log("\n\n🎯 NIVEAU 3 : Portefeuille des leviers");
        console.log("─".repeat(80));

        const ecolesLeviers = this.syntheseEcoles
            .filter((e) => parseFloat(e.taux_leviers) >= 30)
            .sort(
                (a, b) =>
                    parseFloat(b.taux_leviers) - parseFloat(a.taux_leviers)
            )
            .slice(0, 10);

        console.log(
            `\n✨ ${ecolesLeviers.length} ÉCOLE(S) LEVIER IDENTIFIÉE(S)\n`
        );

        ecolesLeviers.forEach((e, idx) => {
            console.log(`┌─ ${idx + 1}. ${e.ecole.toUpperCase()}`);
            console.log(`│  IPS : ${e.ips} (${e.categorie_ips})`);
            console.log(
                `│  Leviers : ${e.nb_leviers}/${e.nb_total} (${e.taux_leviers})`
            );
            console.log(`│`);
            console.log(`│  📋 ACTIONS RECOMMANDÉES :`);
            console.log(`│     1. Visite d'observation`);
            console.log(`│     2. Interview équipe pédagogique`);
            console.log(`│     3. Organisation visite croisée`);
            console.log(`└${"─".repeat(78)}`);
            console.log("");
        });

        return ecolesLeviers;
    }

    /**
     * NIVEAU 4 : Plan d'actions
     * @param {Object} matrice - Matrice de priorisation
     * @returns {Object} Plan structuré
     */
    genererPlanActions(matrice) {
        console.log("\n\n📋 NIVEAU 4 : Plan d'actions IEN");
        console.log("─".repeat(80));

        const plan = {
            visites_accompagnement: [],
            animations_pedagogiques: [],
            valorisation_leviers: [],
        };

        // Visites P0
        console.log("\n🏫 VISITES D'ACCOMPAGNEMENT\n");
        console.log("   PRIORITÉ 0 - Accompagnement global urgent");
        console.log("   " + "─".repeat(70));

        matrice["V,V"].forEach((e, idx) => {
            console.log(`   ${idx + 1}. ${e.ecole}`);
            console.log(`      → Visite + diagnostic + suivi mensuel`);

            plan.visites_accompagnement.push({
                priorite: 0,
                ecole: e.ecole,
                uai: e.uai,
                type: "Accompagnement global",
                frequence: "Mensuel",
            });
        });

        // Visites P1
        const ecolesP1 = [...matrice["V,C"], ...matrice["C,V"]];
        if (ecolesP1.length > 0) {
            console.log("\n   PRIORITÉ 1 - Accompagnement ciblé");
            console.log("   " + "─".repeat(70));

            ecolesP1.forEach((e, idx) => {
                const matiereProbleme =
                    e.profil_maths === "V" ? "Maths" : "Français";
                console.log(
                    `   ${idx + 1}. ${e.ecole} - Focus ${matiereProbleme}`
                );

                plan.visites_accompagnement.push({
                    priorite: 1,
                    ecole: e.ecole,
                    uai: e.uai,
                    type: `Accompagnement ${matiereProbleme}`,
                    frequence: "Trimestriel",
                });
            });
        }

        // Formations
        console.log("\n\n📚 ANIMATIONS PÉDAGOGIQUES\n");
        const besoins = this.analyserBesoinsFormation();

        besoins.forEach((b) => {
            console.log(`   ${b.emoji} ${b.titre}`);
            console.log(`      Public : ${b.public}`);
            console.log(`      Format : ${b.format}`);
            plan.animations_pedagogiques.push(b);
        });

        // Valorisations
        console.log("\n\n⭐ VALORISATION LEVIERS\n");
        const leviers = [
            ...matrice["L,L"],
            ...matrice["L,C"],
            ...matrice["C,L"],
        ];

        leviers.slice(0, 5).forEach((e, idx) => {
            console.log(`   ${idx + 1}. ${e.ecole}`);
            plan.valorisation_leviers.push({ ecole: e.ecole, uai: e.uai });
        });

        return plan;
    }

    /**
     * Analyse les besoins de formation
     * @returns {Array}
     */
    analyserBesoinsFormation() {
        const besoins = [];

        const vigilanceMaths = this.analyses.filter(
            (a) => a.matiere === "Maths" && a.categorie_code === "VIGILANCE"
        ).length;

        const vigilanceFrancais = this.analyses.filter(
            (a) => a.matiere === "Français" && a.categorie_code === "VIGILANCE"
        ).length;

        const totalMaths = this.analyses.filter(
            (a) => a.matiere === "Maths"
        ).length;
        const totalFrancais = this.analyses.filter(
            (a) => a.matiere === "Français"
        ).length;

        const tauxVigMaths =
            totalMaths > 0 ? (vigilanceMaths / totalMaths) * 100 : 0;
        const tauxVigFrancais =
            totalFrancais > 0 ? (vigilanceFrancais / totalFrancais) * 100 : 0;

        if (tauxVigMaths > 30) {
            besoins.push({
                emoji: "🔢",
                titre: "Différenciation en mathématiques",
                public: "Tous cycles",
                format: "3h × 2 sessions",
            });
        }

        if (tauxVigFrancais > 30) {
            besoins.push({
                emoji: "📖",
                titre: "Enseignement explicite de la compréhension",
                public: "Tous cycles",
                format: "3h × 2 sessions",
            });
        }

        if (besoins.length === 0) {
            besoins.push({
                emoji: "💡",
                titre: "Échanges de pratiques inter-écoles",
                public: "Tous cycles",
                format: "3h",
            });
        }

        return besoins;
    }

    /**
     * NIVEAU 5 : Dashboard de pilotage
     * @param {Object} matrice - Matrice
     * @param {Object} plan - Plan d'actions
     * @returns {Object}
     */
    genererDashboardPilotage(matrice, plan) {
        console.log("\n\n📊 NIVEAU 5 : Dashboard de pilotage");
        console.log("─".repeat(80));

        const nbEcolesP0 = matrice["V,V"].length;
        const nbEcolesP1 = matrice["V,C"].length + matrice["C,V"].length;
        const nbEcolesLeviers = matrice["L,L"].length;
        const nbEcolesTotal = this.syntheseEcoles.length;

        const dashboard = {
            nb_ecoles_total: nbEcolesTotal,
            nb_ecoles_P0: nbEcolesP0,
            nb_ecoles_P1: nbEcolesP1,
            nb_ecoles_leviers: nbEcolesLeviers,
            taux_vigilance_global: (
                ((nbEcolesP0 + nbEcolesP1) / nbEcolesTotal) *
                100
            ).toFixed(1),
            taux_leviers_global: (
                (nbEcolesLeviers / nbEcolesTotal) *
                100
            ).toFixed(1),
            visites_a_programmer: plan.visites_accompagnement.length,
            formations_a_organiser: plan.animations_pedagogiques.length,
            valorisations_prevues: plan.valorisation_leviers.length,
        };

        console.log("\n📈 INDICATEURS CLÉS\n");
        console.log(`   Écoles P0 (urgence)      : ${dashboard.nb_ecoles_P0}`);
        console.log(`   Écoles P1 (prioritaire)  : ${dashboard.nb_ecoles_P1}`);
        console.log(
            `   Écoles leviers           : ${dashboard.nb_ecoles_leviers}`
        );
        console.log(
            `   Taux vigilance global    : ${dashboard.taux_vigilance_global}%`
        );
        console.log(
            `   Taux leviers global      : ${dashboard.taux_leviers_global}%`
        );

        console.log("\n📋 PLAN D'ACTIONS\n");
        console.log(
            `   Visites à programmer     : ${dashboard.visites_a_programmer}`
        );
        console.log(
            `   Formations à organiser   : ${dashboard.formations_a_organiser}`
        );
        console.log(
            `   Valorisations prévues    : ${dashboard.valorisations_prevues}`
        );

        return dashboard;
    }
}
