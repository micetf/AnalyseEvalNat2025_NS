/**
 * Service d'analyse et catégorisation IPS
 * Calcule les régressions linéaires et catégorise les écoles
 *
 * @module services/analyseService
 * @requires simple-statistics
 * @author CPC Numérique
 */

import * as ss from "simple-statistics";
import { categoriserIPS } from "../utils/categorisation.js";

export class AnalyseService {
    /**
     * Initialise le service d'analyse
     * @param {Object} referencesService - Service des références DEPP
     */
    constructor(referencesService) {
        this.references = referencesService;
        this.regressions = {};
    }

    /**
     * Calcule les régressions linéaires IPS pour chaque compétence
     * @param {Array} ecolesWithIPS - Écoles avec IPS
     */
    calculateRegressions(ecolesWithIPS) {
        console.log("   🧮 Calcul des régressions IPS...");

        const competencesData = {};

        // Regrouper par compétence
        ecolesWithIPS.forEach((ecole) => {
            if (!ecole.ips) return;

            Object.keys(ecole.resultats).forEach((competence) => {
                const effectifs = ecole.resultats[competence];
                const total =
                    effectifs.besoins +
                    effectifs.fragiles +
                    effectifs.satisfaisant;

                if (total > 0) {
                    const pctSatisfaisant =
                        (effectifs.satisfaisant / total) * 100;

                    if (!competencesData[competence]) {
                        competencesData[competence] = [];
                    }
                    competencesData[competence].push([
                        ecole.ips,
                        pctSatisfaisant,
                    ]);
                }
            });
        });

        // Calculer les régressions
        let regressionsCalculees = 0;

        Object.keys(competencesData).forEach((competence) => {
            const data = competencesData[competence].filter(
                ([ips, resultat]) =>
                    ips && resultat && !isNaN(ips) && !isNaN(resultat)
            );

            if (data.length >= 4) {
                try {
                    const regression = ss.linearRegression(data);
                    const regressionLine = ss.linearRegressionLine(regression);

                    this.regressions[competence] = {
                        a: regression.m,
                        b: regression.b,
                        r2: ss.rSquared(data, regressionLine),
                        n: data.length,
                    };
                    regressionsCalculees++;
                } catch (error) {
                    // Ignorer les erreurs de régression
                }
            }
        });

        console.log(`   ✓ ${regressionsCalculees} régressions calculées`);
    }

    /**
     * Prédit le résultat attendu selon l'IPS
     * @param {string} competence - Clé de compétence
     * @param {number} ips - IPS de l'école
     * @returns {number|null}
     */
    predictFromIPS(competence, ips) {
        const reg = this.regressions[competence];
        if (!reg) return null;
        return reg.a * ips + reg.b;
    }

    /**
     * Catégorise une école sur une compétence
     * @param {Object} ecole - École avec IPS et résultats
     * @param {string} competence - Clé de compétence
     * @param {number} seuilLevier - Seuil LEVIER (défaut: 7)
     * @param {number} seuilVigilance - Seuil VIGILANCE (défaut: -7)
     * @returns {Object|null}
     */
    categoriser(ecole, competence, seuilLevier = 7, seuilVigilance = -7) {
        const effectifs = ecole.resultats[competence];
        if (!effectifs || !ecole.ips) return null;

        const total =
            effectifs.besoins + effectifs.fragiles + effectifs.satisfaisant;
        if (total === 0) return null;

        const resultatReel = (effectifs.satisfaisant / total) * 100;
        const attendu = this.predictFromIPS(competence, ecole.ips);
        if (!attendu) return null;

        const ecart = resultatReel - attendu;

        // Extraire niveau, matière et nom compétence
        const parts = competence.split("_");
        const niveau = parts[0] || "";
        const matiere = parts[1] || "";
        const nomCompetence = parts.slice(2).join("_") || competence;

        const matiereLabel =
            matiere === "francais"
                ? "Français"
                : matiere === "maths"
                ? "Maths"
                : matiere;

        // Catégorisation
        let categorie, categorieCode;
        if (ecart > seuilLevier) {
            categorie = "🟢 LEVIER";
            categorieCode = "LEVIER";
        } else if (ecart < seuilVigilance) {
            categorie = "🔴 VIGILANCE";
            categorieCode = "VIGILANCE";
        } else {
            categorie = "🟡 CONFORME";
            categorieCode = "CONFORME";
        }

        // Références nationales
        const ref = this.references.getReference(
            niveau,
            matiere,
            nomCompetence
        );

        return {
            ecole: ecole.nom,
            uai: ecole.uai,
            ips: Math.round(ecole.ips * 10) / 10,
            categorie_ips: categoriserIPS(ecole.ips),
            secteur: ecole.secteur || "",
            niveau: niveau,
            matiere: matiereLabel,
            competence: nomCompetence,
            competence_complete: competence,
            resultat_reel: Math.round(resultatReel * 10) / 10,
            resultat_attendu_ips: Math.round(attendu * 10) / 10,
            ecart_vs_ips: Math.round(ecart * 10) / 10,
            categorie: categorie,
            categorie_code: categorieCode,
            effectifs: effectifs, // Ajout des effectifs pour le graphique
            ref_france: ref?.france ? Math.round(ref.france * 10) / 10 : null,
            ref_academie: ref?.academie
                ? Math.round(ref.academie * 10) / 10
                : null,
            ecart_vs_france: ref?.france
                ? Math.round((resultatReel - ref.france) * 10) / 10
                : null,
            ecart_vs_academie: ref?.academie
                ? Math.round((resultatReel - ref.academie) * 10) / 10
                : null,
        };
    }

    /**
     * Analyse toutes les écoles sur toutes les compétences
     * @param {Array} ecolesWithIPS - Écoles avec IPS
     * @returns {Array}
     */
    analyserTout(ecolesWithIPS) {
        console.log("   📊 Analyse de toutes les compétences...");

        const resultats = [];
        let analysesReussies = 0;

        ecolesWithIPS.forEach((ecole) => {
            const competences = Object.keys(ecole.resultats);

            competences.forEach((competence) => {
                const analyse = this.categoriser(ecole, competence);
                if (analyse) {
                    resultats.push(analyse);
                    analysesReussies++;
                }
            });
        });

        console.log(`   ✓ ${analysesReussies} analyses réussies`);
        return resultats;
    }

    /**
     * Génère une synthèse par école avec profil global cohérent avec les graphiques
     * @param {Array} analyses - Toutes les analyses
     * @returns {Array}
     */
    genererSyntheseParEcole(analyses) {
        const parEcole = {};
        const parEcoleMatiere = {}; // Pour calculer % satisfaisant par matière

        analyses.forEach((a) => {
            if (!parEcole[a.uai]) {
                parEcole[a.uai] = {
                    ecole: a.ecole,
                    uai: a.uai,
                    ips: a.ips,
                    categorie_ips: a.categorie_ips,
                    secteur: a.secteur,
                    nb_leviers: 0,
                    nb_vigilance: 0,
                    nb_conformes: 0,
                    nb_total: 0,
                };

                parEcoleMatiere[a.uai] = {
                    maths: { besoins: 0, fragiles: 0, satisfaisant: 0 },
                    francais: { besoins: 0, fragiles: 0, satisfaisant: 0 },
                };
            }

            const ecole = parEcole[a.uai];
            ecole.nb_total++;

            if (a.categorie_code === "LEVIER") ecole.nb_leviers++;
            else if (a.categorie_code === "VIGILANCE") ecole.nb_vigilance++;
            else ecole.nb_conformes++;

            // Cumuler effectifs par matière pour calcul % satisfaisant
            const matiereCle = a.matiere === "Français" ? "francais" : "maths";
            if (a.effectifs) {
                parEcoleMatiere[a.uai][matiereCle].besoins +=
                    a.effectifs.besoins;
                parEcoleMatiere[a.uai][matiereCle].fragiles +=
                    a.effectifs.fragiles;
                parEcoleMatiere[a.uai][matiereCle].satisfaisant +=
                    a.effectifs.satisfaisant;
            }
        });

        return Object.values(parEcole)
            .map((e) => {
                // Calculer % satisfaisant par matière
                const maths = parEcoleMatiere[e.uai].maths;
                const francais = parEcoleMatiere[e.uai].francais;

                const totalMaths =
                    maths.besoins + maths.fragiles + maths.satisfaisant;
                const totalFrancais =
                    francais.besoins +
                    francais.fragiles +
                    francais.satisfaisant;

                const pctMaths =
                    totalMaths > 0
                        ? (maths.satisfaisant / totalMaths) * 100
                        : null;
                const pctFrancais =
                    totalFrancais > 0
                        ? (francais.satisfaisant / totalFrancais) * 100
                        : null;

                // Calculer écart vs attendu IPS pour déterminer le profil
                let profilMaths = null;
                let profilFrancais = null;

                if (pctMaths !== null) {
                    // Utiliser une régression Maths représentative
                    const competencesMaths = Object.keys(
                        this.regressions
                    ).filter((c) => c.includes("_maths_"));
                    if (competencesMaths.length > 0) {
                        // Moyenne des régressions Maths pour plus de stabilité
                        let sommeAttendu = 0;
                        let nbReg = 0;
                        competencesMaths.forEach((comp) => {
                            const reg = this.regressions[comp];
                            if (reg) {
                                sommeAttendu += reg.a * e.ips + reg.b;
                                nbReg++;
                            }
                        });
                        if (nbReg > 0) {
                            const attenduMaths = sommeAttendu / nbReg;
                            const ecartMaths = pctMaths - attenduMaths;

                            if (ecartMaths > 7) profilMaths = "LEVIER";
                            else if (ecartMaths < -7) profilMaths = "VIGILANCE";
                            else profilMaths = "CONFORME";
                        }
                    }
                }

                if (pctFrancais !== null) {
                    // Utiliser une régression Français représentative
                    const competencesFrancais = Object.keys(
                        this.regressions
                    ).filter((c) => c.includes("_francais_"));
                    if (competencesFrancais.length > 0) {
                        // Moyenne des régressions Français pour plus de stabilité
                        let sommeAttendu = 0;
                        let nbReg = 0;
                        competencesFrancais.forEach((comp) => {
                            const reg = this.regressions[comp];
                            if (reg) {
                                sommeAttendu += reg.a * e.ips + reg.b;
                                nbReg++;
                            }
                        });
                        if (nbReg > 0) {
                            const attenduFrancais = sommeAttendu / nbReg;
                            const ecartFrancais = pctFrancais - attenduFrancais;

                            if (ecartFrancais > 7) profilFrancais = "LEVIER";
                            else if (ecartFrancais < -7)
                                profilFrancais = "VIGILANCE";
                            else profilFrancais = "CONFORME";
                        }
                    }
                }

                // Déterminer profil global basé sur les profils par matière (cohérent avec graphiques)
                let profilGlobal;

                const vigilanceMatieres = [
                    profilMaths === "VIGILANCE",
                    profilFrancais === "VIGILANCE",
                ].filter(Boolean).length;
                const levierMatieres = [
                    profilMaths === "LEVIER",
                    profilFrancais === "LEVIER",
                ].filter(Boolean).length;

                if (vigilanceMatieres === 2) {
                    profilGlobal = "🔴 ACCOMPAGNEMENT PRIORITAIRE";
                } else if (levierMatieres === 2) {
                    profilGlobal = "🟢 ÉCOLE LEVIER";
                } else if (vigilanceMatieres === 1) {
                    profilGlobal = "🟠 VIGILANCE MODÉRÉE";
                } else if (levierMatieres === 1) {
                    profilGlobal = "🟡 SUIVI RENFORCÉ";
                } else {
                    profilGlobal = "🟡 SUIVI STANDARD";
                }

                return {
                    ...e,
                    taux_leviers:
                        ((e.nb_leviers / e.nb_total) * 100).toFixed(1) + "%",
                    taux_vigilance:
                        ((e.nb_vigilance / e.nb_total) * 100).toFixed(1) + "%",
                    profil_global: profilGlobal,
                    profil_maths: profilMaths,
                    profil_francais: profilFrancais,
                    pct_satisfaisant_maths:
                        pctMaths !== null ? pctMaths.toFixed(1) : null,
                    pct_satisfaisant_francais:
                        pctFrancais !== null ? pctFrancais.toFixed(1) : null,
                };
            })
            .sort((a, b) => {
                // Tri par priorité : vigilance 2 matières > vigilance 1 matière > reste
                const prioriteA =
                    a.profil_global === "🔴 ACCOMPAGNEMENT PRIORITAIRE"
                        ? 0
                        : a.profil_global === "🟠 VIGILANCE MODÉRÉE"
                        ? 1
                        : 2;
                const prioriteB =
                    b.profil_global === "🔴 ACCOMPAGNEMENT PRIORITAIRE"
                        ? 0
                        : b.profil_global === "🟠 VIGILANCE MODÉRÉE"
                        ? 1
                        : 2;

                if (prioriteA !== prioriteB) {
                    return prioriteA - prioriteB;
                }

                // Si même priorité, trier par nb vigilance
                if (a.nb_vigilance !== b.nb_vigilance) {
                    return b.nb_vigilance - a.nb_vigilance;
                }
                return b.nb_leviers - a.nb_leviers;
            });
    }
}
