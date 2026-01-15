/**
 * Service de génération de graphiques PDF par discipline
 * Crée un graphique Maths et un graphique Français sur UNE SEULE PAGE
 * avec identification claire des écoles
 *
 * @module services/graphiqueService
 * @requires pdfkit
 * @author CPC Numérique
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import * as ss from "simple-statistics";

export class GraphiqueService {
    /**
     * Initialise le service de graphiques
     * @param {string} outputDir - Répertoire de sortie
     */
    constructor(outputDir) {
        this.outputDir = outputDir;

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    }

    /**
     * Génère les graphiques pour toutes les disciplines
     * @param {Array} analyses - Toutes les analyses
     * @param {Array} ecolesWithIPS - Écoles avec IPS
     * @param {string} academie - Nom académie
     * @param {string} departement - Code département
     * @param {string} circonscription - Nom de la circonscription
     * @returns {Promise<Array>} Chemins des fichiers générés
     */
    async genererGraphiquesDisciplines(
        analyses,
        ecolesWithIPS,
        academie,
        departement,
        circonscription
    ) {
        console.log("\n📊 GÉNÉRATION DES GRAPHIQUES PDF PAR DISCIPLINE");
        console.log("─".repeat(80));

        const fichiers = [];

        // Graphique Maths
        try {
            console.log("   📈 Génération graphique MATHS...");
            const fichierMaths = await this.genererGraphiqueDiscipline(
                "Maths",
                analyses,
                ecolesWithIPS,
                academie,
                departement,
                circonscription
            );
            fichiers.push(fichierMaths);
            console.log(`   ✓ Maths : ${path.basename(fichierMaths)}`);
        } catch (error) {
            console.error(`   ❌ Erreur Maths : ${error.message}`);
        }

        // Graphique Français
        try {
            console.log("   📚 Génération graphique FRANÇAIS...");
            const fichierFrancais = await this.genererGraphiqueDiscipline(
                "Français",
                analyses,
                ecolesWithIPS,
                academie,
                departement,
                circonscription
            );
            fichiers.push(fichierFrancais);
            console.log(`   ✓ Français : ${path.basename(fichierFrancais)}`);
        } catch (error) {
            console.error(`   ❌ Erreur Français : ${error.message}`);
        }

        console.log(`\n   ✅ ${fichiers.length} graphique(s) généré(s)`);
        return fichiers;
    }

    /**
     * Génère un graphique pour une discipline (UNE SEULE PAGE)
     * @param {string} matiere - "Maths" ou "Français"
     * @param {Array} analyses - Toutes les analyses
     * @param {Array} ecolesWithIPS - Écoles avec IPS
     * @param {string} academie - Nom académie
     * @param {string} departement - Code département
     * @param {string} circonscription - Nom de la circonscription
     * @returns {Promise<string>} Chemin du fichier généré
     */
    genererGraphiqueDiscipline(
        matiere,
        analyses,
        ecolesWithIPS,
        academie,
        departement,
        circonscription
    ) {
        return new Promise((resolve, reject) => {
            try {
                // Filtrer analyses par matière
                const analysesMatiere = analyses.filter(
                    (a) => a.matiere === matiere
                );

                if (analysesMatiere.length === 0) {
                    return reject(new Error(`Aucune analyse pour ${matiere}`));
                }

                // Agréger par école
                const donneesEcolesBrut = this.aggregerDonneesParEcole(
                    analysesMatiere,
                    ecolesWithIPS
                );

                if (donneesEcolesBrut.length < 4) {
                    return reject(
                        new Error(
                            `Données insuffisantes pour ${matiere} (< 4 écoles)`
                        )
                    );
                }

                // Calculer la régression linéaire
                const pointsRegression = donneesEcolesBrut.map((e) => [
                    e.ips,
                    e.pct_satisfaisant_moyen,
                ]);
                const regression = ss.linearRegression(pointsRegression);
                const regressionLine = ss.linearRegressionLine(regression);
                const r2 = ss.rSquared(pointsRegression, regressionLine);

                // Calculer le profil basé sur la position par rapport à la régression
                const donneesEcoles = donneesEcolesBrut.map((e) => {
                    const attendu = regression.m * e.ips + regression.b;
                    const ecart = e.pct_satisfaisant_moyen - attendu;

                    let profil = "CONFORME";
                    if (ecart > 7) {
                        profil = "LEVIER";
                    } else if (ecart < -7) {
                        profil = "VIGILANCE";
                    }

                    return {
                        ...e,
                        profil: profil,
                        ecart_regression: ecart,
                    };
                });

                // Trier par nom pour assignation de numéros cohérente
                donneesEcoles.sort((a, b) => a.nom.localeCompare(b.nom));

                // Assigner un numéro à chaque école
                donneesEcoles.forEach((e, idx) => {
                    e.numero = idx + 1;
                });

                // Limites des axes
                const ipsValues = donneesEcoles.map((e) => e.ips);
                const pctValues = donneesEcoles.map(
                    (e) => e.pct_satisfaisant_moyen
                );

                const minIPS = Math.max(
                    0,
                    Math.floor(Math.min(...ipsValues) / 10) * 10 - 10
                );
                const maxIPS = Math.ceil(Math.max(...ipsValues) / 10) * 10 + 10;
                const minPct = Math.max(
                    0,
                    Math.floor(Math.min(...pctValues) / 10) * 10 - 10
                );
                const maxPct = Math.min(
                    100,
                    Math.ceil(Math.max(...pctValues) / 10) * 10 + 10
                );

                // Créer le document PDF
                const doc = new PDFDocument({
                    size: "A4",
                    layout: "landscape",
                    margin: 30,
                });

                // Fichier de sortie
                const filename = `graphique_${matiere.toLowerCase()}_dept${departement}_${Date.now()}.pdf`;
                const filepath = path.join(this.outputDir, filename);

                const stream = fs.createWriteStream(filepath);
                doc.pipe(stream);

                // ═══════════════════════════════════════════════════════════
                // LAYOUT - Optimisé pour tenir sur UNE PAGE
                // ═══════════════════════════════════════════════════════════
                const PAGE_WIDTH = 842;
                const PAGE_HEIGHT = 595;

                const MARGIN_LEFT = 30;
                const MARGIN_TOP = 30;
                const MARGIN_RIGHT = 30;

                // Zone graphique (à gauche) - Remontée
                const GRAPH_LEFT = MARGIN_LEFT + 60;
                const GRAPH_TOP = 100; // Réduit de 110 à 105 (-5px)
                const GRAPH_WIDTH = 450;
                const GRAPH_HEIGHT = 355;

                // Zone liste écoles (à droite)
                const LISTE_LEFT = GRAPH_LEFT + GRAPH_WIDTH + 30;
                const LISTE_TOP = GRAPH_TOP;
                const LISTE_WIDTH = PAGE_WIDTH - LISTE_LEFT - MARGIN_RIGHT;

                // ═══════════════════════════════════════════════════════════
                // EN-TÊTE
                // ═══════════════════════════════════════════════════════════
                doc.fontSize(18).font("Helvetica-Bold").fillColor("#1f2937");
                doc.text(
                    `Analyse IPS - ${matiere.toUpperCase()}`,
                    MARGIN_LEFT,
                    MARGIN_TOP
                );

                // Ligne d'information avec circonscription
                doc.fontSize(10).font("Helvetica").fillColor("#6b7280");
                const infoText = circonscription
                    ? `Académie ${academie} | Circonscription ${circonscription} | Département ${departement} | ${donneesEcoles.length} écoles publiques`
                    : `Académie ${academie} | Département ${departement} | ${donneesEcoles.length} écoles publiques`;

                doc.text(infoText, MARGIN_LEFT, MARGIN_TOP + 25);

                doc.fontSize(8).fillColor("#9ca3af");
                doc.text(
                    `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
                    PAGE_WIDTH - MARGIN_RIGHT - 120,
                    MARGIN_TOP,
                    { width: 120, align: "right" }
                );

                // Statistiques - Remontée
                const pctMoyen = (
                    pctValues.reduce((a, b) => a + b) / pctValues.length
                ).toFixed(1);
                const ipsMoyen = (
                    ipsValues.reduce((a, b) => a + b) / ipsValues.length
                ).toFixed(1);

                const statsY = MARGIN_TOP + 43; // Réduit de 50 à 43 (-7px)
                doc.fontSize(9).font("Helvetica").fillColor("#374151");
                doc.text(
                    `Régression : y = ${regression.m.toFixed(
                        3
                    )}x + ${regression.b.toFixed(1)} | R² = ${r2.toFixed(
                        3
                    )} | IPS moyen : ${ipsMoyen} | % moyen : ${pctMoyen}%`,
                    MARGIN_LEFT,
                    statsY,
                    { width: GRAPH_WIDTH + LISTE_WIDTH + 40 }
                );

                // ═══════════════════════════════════════════════════════════
                // GRAPHIQUE
                // ═══════════════════════════════════════════════════════════

                // Fond
                doc.fillColor("#f9fafb")
                    .rect(GRAPH_LEFT, GRAPH_TOP, GRAPH_WIDTH, GRAPH_HEIGHT)
                    .fill();

                // Grille
                this.dessinerGrille(
                    doc,
                    GRAPH_LEFT,
                    GRAPH_TOP,
                    GRAPH_WIDTH,
                    GRAPH_HEIGHT,
                    minIPS,
                    maxIPS,
                    minPct,
                    maxPct
                );

                // Zones colorées
                this.dessinerZonesCategorisation(
                    doc,
                    GRAPH_LEFT,
                    GRAPH_TOP,
                    GRAPH_WIDTH,
                    GRAPH_HEIGHT,
                    minIPS,
                    maxIPS,
                    minPct,
                    maxPct,
                    regression.m,
                    regression.b
                );

                // Droite de régression
                this.dessinerRegression(
                    doc,
                    GRAPH_LEFT,
                    GRAPH_TOP,
                    GRAPH_WIDTH,
                    GRAPH_HEIGHT,
                    minIPS,
                    maxIPS,
                    minPct,
                    maxPct,
                    regression.m,
                    regression.b
                );

                // Points des écoles avec numéros
                this.dessinerEcoles(
                    doc,
                    GRAPH_LEFT,
                    GRAPH_TOP,
                    GRAPH_WIDTH,
                    GRAPH_HEIGHT,
                    minIPS,
                    maxIPS,
                    minPct,
                    maxPct,
                    donneesEcoles
                );

                // Axes
                this.dessinerAxes(
                    doc,
                    GRAPH_LEFT,
                    GRAPH_TOP,
                    GRAPH_WIDTH,
                    GRAPH_HEIGHT,
                    minIPS,
                    maxIPS,
                    minPct,
                    maxPct
                );

                // ═══════════════════════════════════════════════════════════
                // LISTE DES ÉCOLES - TOUTES AFFICHÉES
                // ═══════════════════════════════════════════════════════════
                doc.fontSize(10).font("Helvetica-Bold").fillColor("#1f2937");
                doc.text("ÉCOLES", LISTE_LEFT, LISTE_TOP);

                let listeY = LISTE_TOP + 18;
                const LINE_HEIGHT = 10.5;

                // Afficher TOUTES les écoles
                donneesEcoles.forEach((ecole) => {
                    // Couleur du numéro
                    let couleur = "#eab308";
                    if (ecole.profil === "LEVIER") couleur = "#22c55e";
                    else if (ecole.profil === "VIGILANCE") couleur = "#ef4444";

                    // Numéro
                    doc.fontSize(8).font("Helvetica-Bold").fillColor(couleur);
                    doc.text(ecole.numero.toString(), LISTE_LEFT, listeY, {
                        width: 15,
                        align: "right",
                    });

                    // Nom de l'école
                    const nomCourt =
                        ecole.nom.length > 22
                            ? ecole.nom
                                  .replace(/ECOLE ELEMENTAIRE /, "")
                                  .replace(/NA - /, "")
                                  .replace(/ECOLE PRIMAIRE /, "")
                                  .replace(/PUBLIQUE /, "")
                                  .replace(/INTERCOMMUNALE /, "")
                                  .replace(/ANNONAY/, "An")
                                  .substring(0, 20) + "..."
                            : ecole.nom;

                    doc.fontSize(7).font("Helvetica").fillColor("#374151");
                    doc.text(nomCourt, LISTE_LEFT + 18, listeY, {
                        width: LISTE_WIDTH - 18,
                    });

                    listeY += LINE_HEIGHT;
                });

                // ═══════════════════════════════════════════════════════════
                // LÉGENDE - Espacement augmenté
                // ═══════════════════════════════════════════════════════════
                const legendeY = GRAPH_TOP + GRAPH_HEIGHT + 30; // Augmenté de 20 à 30 (+10px)

                doc.fontSize(9).font("Helvetica-Bold").fillColor("#1f2937");
                doc.text("LÉGENDE", GRAPH_LEFT, legendeY);

                const legende = [
                    {
                        couleur: "#22c55e",
                        label: "LEVIER : % satisfaisant > attendu IPS + 7 pts",
                    },
                    {
                        couleur: "#eab308",
                        label: "CONFORME : % satisfaisant proche de l'attendu IPS (±7 pts)",
                    },
                    {
                        couleur: "#ef4444",
                        label: "VIGILANCE : % satisfaisant < attendu IPS - 7 pts",
                    },
                ];

                let legendeCurrentY = legendeY + 15;
                legende.forEach((item) => {
                    doc.fillColor(item.couleur)
                        .rect(GRAPH_LEFT, legendeCurrentY - 2, 10, 10)
                        .fill();

                    doc.fontSize(8).font("Helvetica").fillColor("#374151");
                    doc.text(item.label, GRAPH_LEFT + 15, legendeCurrentY, {
                        width: GRAPH_WIDTH - 15,
                    });

                    legendeCurrentY += 14;
                });

                // Interprétation
                const interpreY = legendeCurrentY + 5;
                doc.fontSize(7).font("Helvetica").fillColor("#6b7280");
                const interpretationText = `La droite de régression montre le % "satisfaisant" attendu selon l'IPS. Les écoles au-dessus surperforment (LEVIERS), celles en-dessous sous-performent (VIGILANCE). L'écart vertical mesure la performance relative au contexte socio-économique.`;

                doc.text(interpretationText, GRAPH_LEFT, interpreY, {
                    width: GRAPH_WIDTH + LISTE_WIDTH + 40,
                    align: "justify",
                });

                // Finaliser
                doc.end();

                stream.on("finish", () => resolve(filepath));
                stream.on("error", (err) => reject(err));
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Agrège les données par école avec cumul des effectifs B, F, S
     * @param {Array} analysesMatiere - Analyses filtrées par matière
     * @param {Array} ecolesWithIPS - Écoles avec IPS
     * @returns {Array} Données agrégées par école
     */
    aggregerDonneesParEcole(analysesMatiere, ecolesWithIPS) {
        const parEcole = new Map();

        analysesMatiere.forEach((a) => {
            if (!parEcole.has(a.uai)) {
                const ecole = ecolesWithIPS.find((e) => e.uai === a.uai);
                if (!ecole) return;

                parEcole.set(a.uai, {
                    uai: a.uai,
                    nom: a.ecole,
                    ips: a.ips,
                    effectifs_total: {
                        besoins: 0,
                        fragiles: 0,
                        satisfaisant: 0,
                    },
                });
            }

            const ecole = parEcole.get(a.uai);

            // Cumuler les effectifs de toutes les compétences
            if (a.effectifs) {
                ecole.effectifs_total.besoins += a.effectifs.besoins;
                ecole.effectifs_total.fragiles += a.effectifs.fragiles;
                ecole.effectifs_total.satisfaisant += a.effectifs.satisfaisant;
            }
        });

        return Array.from(parEcole.values()).map((e) => {
            // Calcul du pourcentage global avec cumul des effectifs
            const total =
                e.effectifs_total.besoins +
                e.effectifs_total.fragiles +
                e.effectifs_total.satisfaisant;

            const pct_satisfaisant_moyen =
                total > 0 ? (e.effectifs_total.satisfaisant / total) * 100 : 0;

            return {
                uai: e.uai,
                nom: e.nom,
                ips: e.ips,
                pct_satisfaisant_moyen: pct_satisfaisant_moyen,
                effectifs_total: e.effectifs_total,
                nb_eleves_total: total,
            };
        });
    }

    /**
     * Dessine la grille du graphique
     * @param {Object} doc - Document PDF
     * @param {number} left - Position gauche
     * @param {number} top - Position haute
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} minX - Valeur minimale X
     * @param {number} maxX - Valeur maximale X
     * @param {number} minY - Valeur minimale Y
     * @param {number} maxY - Valeur maximale Y
     */
    dessinerGrille(doc, left, top, width, height, minX, maxX, minY, maxY) {
        doc.strokeColor("#e5e7eb").lineWidth(0.5);

        const stepY = 10;
        for (let y = Math.ceil(minY / 10) * 10; y <= maxY; y += stepY) {
            const posY = top + height - ((y - minY) / (maxY - minY)) * height;
            doc.moveTo(left, posY)
                .lineTo(left + width, posY)
                .stroke();
        }

        const stepX = 10;
        for (let x = Math.ceil(minX / 10) * 10; x <= maxX; x += stepX) {
            const posX = left + ((x - minX) / (maxX - minX)) * width;
            doc.moveTo(posX, top)
                .lineTo(posX, top + height)
                .stroke();
        }
    }

    /**
     * Dessine les zones de catégorisation (LEVIER, CONFORME, VIGILANCE)
     * @param {Object} doc - Document PDF
     * @param {number} left - Position gauche
     * @param {number} top - Position haute
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} minX - Valeur minimale X
     * @param {number} maxX - Valeur maximale X
     * @param {number} minY - Valeur minimale Y
     * @param {number} maxY - Valeur maximale Y
     * @param {number} a - Coefficient directeur de la régression
     * @param {number} b - Ordonnée à l'origine de la régression
     */
    dessinerZonesCategorisation(
        doc,
        left,
        top,
        width,
        height,
        minX,
        maxX,
        minY,
        maxY,
        a,
        b
    ) {
        const SEUIL = 7;

        // Zone LEVIER
        doc.fillColor("#22c55e").fillOpacity(0.08);

        const nbPoints = 50;
        const pointsLevier = [];

        for (let i = 0; i <= nbPoints; i++) {
            const x = minX + (i / nbPoints) * (maxX - minX);
            const y = Math.min(maxY, a * x + b + SEUIL);
            const posX = left + ((x - minX) / (maxX - minX)) * width;
            const posY = top + height - ((y - minY) / (maxY - minY)) * height;
            pointsLevier.push([posX, posY]);
        }

        pointsLevier.push([left + width, top]);
        pointsLevier.push([left, top]);

        doc.moveTo(pointsLevier[0][0], pointsLevier[0][1]);
        for (let i = 1; i < pointsLevier.length; i++) {
            doc.lineTo(pointsLevier[i][0], pointsLevier[i][1]);
        }
        doc.closePath().fill();

        // Zone VIGILANCE
        doc.fillColor("#ef4444").fillOpacity(0.08);

        const pointsVig = [];

        for (let i = 0; i <= nbPoints; i++) {
            const x = minX + (i / nbPoints) * (maxX - minX);
            const y = Math.max(minY, a * x + b - SEUIL);
            const posX = left + ((x - minX) / (maxX - minX)) * width;
            const posY = top + height - ((y - minY) / (maxY - minY)) * height;
            pointsVig.push([posX, posY]);
        }

        pointsVig.push([left + width, top + height]);
        pointsVig.push([left, top + height]);

        doc.moveTo(pointsVig[0][0], pointsVig[0][1]);
        for (let i = 1; i < pointsVig.length; i++) {
            doc.lineTo(pointsVig[i][0], pointsVig[i][1]);
        }
        doc.closePath().fill();

        doc.fillOpacity(1);
    }

    /**
     * Dessine la droite de régression linéaire
     * @param {Object} doc - Document PDF
     * @param {number} left - Position gauche
     * @param {number} top - Position haute
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} minX - Valeur minimale X
     * @param {number} maxX - Valeur maximale X
     * @param {number} minY - Valeur minimale Y
     * @param {number} maxY - Valeur maximale Y
     * @param {number} a - Coefficient directeur
     * @param {number} b - Ordonnée à l'origine
     */
    dessinerRegression(
        doc,
        left,
        top,
        width,
        height,
        minX,
        maxX,
        minY,
        maxY,
        a,
        b
    ) {
        doc.strokeColor("#1f2937").lineWidth(2);

        const x1 = minX;
        const y1 = Math.max(minY, Math.min(maxY, a * x1 + b));
        const x2 = maxX;
        const y2 = Math.max(minY, Math.min(maxY, a * x2 + b));

        const posX1 = left + ((x1 - minX) / (maxX - minX)) * width;
        const posY1 = top + height - ((y1 - minY) / (maxY - minY)) * height;
        const posX2 = left + ((x2 - minX) / (maxX - minX)) * width;
        const posY2 = top + height - ((y2 - minY) / (maxY - minY)) * height;

        doc.moveTo(posX1, posY1).lineTo(posX2, posY2).stroke();
    }

    /**
     * Dessine les points représentant les écoles avec leurs numéros
     * @param {Object} doc - Document PDF
     * @param {number} left - Position gauche
     * @param {number} top - Position haute
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} minX - Valeur minimale X
     * @param {number} maxX - Valeur maximale X
     * @param {number} minY - Valeur minimale Y
     * @param {number} maxY - Valeur maximale Y
     * @param {Array} donneesEcoles - Données des écoles
     */
    dessinerEcoles(
        doc,
        left,
        top,
        width,
        height,
        minX,
        maxX,
        minY,
        maxY,
        donneesEcoles
    ) {
        donneesEcoles.forEach((ecole) => {
            const { ips, pct_satisfaisant_moyen, profil, numero } = ecole;

            if (isNaN(ips) || isNaN(pct_satisfaisant_moyen)) return;

            const posX = left + ((ips - minX) / (maxX - minX)) * width;
            const posY =
                top +
                height -
                ((pct_satisfaisant_moyen - minY) / (maxY - minY)) * height;

            if (
                posX < left ||
                posX > left + width ||
                posY < top ||
                posY > top + height
            ) {
                return;
            }

            let couleur = "#eab308";
            if (profil === "LEVIER") couleur = "#22c55e";
            else if (profil === "VIGILANCE") couleur = "#ef4444";

            doc.fillColor(couleur).strokeColor("#ffffff").lineWidth(1.5);
            doc.circle(posX, posY, 6).fillAndStroke();

            doc.fontSize(7).font("Helvetica-Bold").fillColor("#ffffff");
            const numeroStr = numero.toString();
            const numeroWidth = doc.widthOfString(numeroStr);
            doc.text(numeroStr, posX - numeroWidth / 2, posY - 3.5);
        });
    }

    /**
     * Dessine les axes avec graduations et labels
     * @param {Object} doc - Document PDF
     * @param {number} left - Position gauche
     * @param {number} top - Position haute
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} minX - Valeur minimale X
     * @param {number} maxX - Valeur maximale X
     * @param {number} minY - Valeur minimale Y
     * @param {number} maxY - Valeur maximale Y
     */
    dessinerAxes(doc, left, top, width, height, minX, maxX, minY, maxY) {
        doc.strokeColor("#374151").lineWidth(1.5);

        doc.moveTo(left, top + height)
            .lineTo(left + width, top + height)
            .stroke();
        doc.moveTo(left, top)
            .lineTo(left, top + height)
            .stroke();

        doc.fontSize(8).font("Helvetica").fillColor("#374151");

        const stepX = 10;
        for (let x = Math.ceil(minX / 10) * 10; x <= maxX; x += stepX) {
            const posX = left + ((x - minX) / (maxX - minX)) * width;
            doc.moveTo(posX, top + height)
                .lineTo(posX, top + height + 4)
                .stroke();
            doc.text(x.toString(), posX - 10, top + height + 8, {
                width: 20,
                align: "center",
            });
        }

        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1f2937");
        doc.text(
            "IPS (Indice de Position Sociale)",
            left + width / 2 - 80,
            top + height + 28
        );

        doc.fontSize(8).font("Helvetica").fillColor("#374151");

        const stepY = 10;
        for (let y = Math.ceil(minY / 10) * 10; y <= maxY; y += stepY) {
            const posY = top + height - ((y - minY) / (maxY - minY)) * height;
            doc.moveTo(left - 4, posY)
                .lineTo(left, posY)
                .stroke();
            doc.text(`${y}%`, left - 35, posY - 4, {
                width: 30,
                align: "right",
            });
        }

        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1f2937");
        doc.save();
        doc.translate(left - 50, top + height / 2);
        doc.rotate(-90);
        doc.text("% groupe satisfaisant", 0, 0);
        doc.restore();
    }
}
