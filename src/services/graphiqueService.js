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
     * @returns {Promise<Array>} Chemins des fichiers générés
     */
    async genererGraphiquesDisciplines(
        analyses,
        ecolesWithIPS,
        academie,
        departement
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
                departement
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
                departement
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
     * @returns {Promise<string>} Chemin du fichier généré
     */
    genererGraphiqueDiscipline(
        matiere,
        analyses,
        ecolesWithIPS,
        academie,
        departement
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
                const donneesEcoles = this.aggregerDonneesParEcole(
                    analysesMatiere,
                    ecolesWithIPS
                );

                if (donneesEcoles.length < 4) {
                    return reject(
                        new Error(
                            `Données insuffisantes pour ${matiere} (< 4 écoles)`
                        )
                    );
                }

                // Trier par nom pour assignation de numéros cohérente
                donneesEcoles.sort((a, b) => a.nom.localeCompare(b.nom));

                // Assigner un numéro à chaque école
                donneesEcoles.forEach((e, idx) => {
                    e.numero = idx + 1;
                });

                // Calculer la régression linéaire
                const pointsRegression = donneesEcoles.map((e) => [
                    e.ips,
                    e.pct_satisfaisant_moyen,
                ]);
                const regression = ss.linearRegression(pointsRegression);
                const regressionLine = ss.linearRegressionLine(regression);
                const r2 = ss.rSquared(pointsRegression, regressionLine);

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
                // LAYOUT
                // ═══════════════════════════════════════════════════════════
                const PAGE_WIDTH = 842;
                const PAGE_HEIGHT = 595;

                const MARGIN_LEFT = 40;
                const MARGIN_TOP = 40;
                const MARGIN_RIGHT = 40;

                // Zone graphique (à gauche)
                const GRAPH_LEFT = MARGIN_LEFT + 60;
                const GRAPH_TOP = 120;
                const GRAPH_WIDTH = 450;
                const GRAPH_HEIGHT = 350;

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

                doc.fontSize(10).font("Helvetica").fillColor("#6b7280");
                doc.text(
                    `Académie ${academie} | Département ${departement} | ${donneesEcoles.length} écoles publiques`,
                    MARGIN_LEFT,
                    MARGIN_TOP + 25
                );

                doc.fontSize(8).fillColor("#9ca3af");
                doc.text(
                    `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
                    PAGE_WIDTH - MARGIN_RIGHT - 120,
                    MARGIN_TOP,
                    { width: 120, align: "right" }
                );

                // Statistiques
                const pctMoyen = (
                    pctValues.reduce((a, b) => a + b) / pctValues.length
                ).toFixed(1);
                const ipsMoyen = (
                    ipsValues.reduce((a, b) => a + b) / ipsValues.length
                ).toFixed(1);

                const statsY = MARGIN_TOP + 50;
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
                // LISTE DES ÉCOLES
                // ═══════════════════════════════════════════════════════════
                doc.fontSize(10).font("Helvetica-Bold").fillColor("#1f2937");
                doc.text("ÉCOLES", LISTE_LEFT, LISTE_TOP);

                let listeY = LISTE_TOP + 18;
                const LINE_HEIGHT = 11;
                const MAX_LINES =
                    33 | Math.floor((GRAPH_HEIGHT - 20) / LINE_HEIGHT);

                donneesEcoles.slice(0, MAX_LINES).forEach((ecole) => {
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

                if (donneesEcoles.length > MAX_LINES) {
                    doc.fontSize(7)
                        .font("Helvetica-Oblique")
                        .fillColor("#9ca3af");
                    doc.text(
                        `... ${donneesEcoles.length - MAX_LINES} autre(s)`,
                        LISTE_LEFT + 18,
                        listeY
                    );
                }

                // ═══════════════════════════════════════════════════════════
                // LÉGENDE
                // ═══════════════════════════════════════════════════════════
                const legendeY = GRAPH_TOP + GRAPH_HEIGHT + 20;

                doc.fontSize(9).font("Helvetica-Bold").fillColor("#1f2937");
                doc.text("LÉGENDE", GRAPH_LEFT, legendeY);

                const legende = [
                    {
                        couleur: "#22c55e",
                        label: "🟢 LEVIER : ≥30% compétences leviers (écart > +7 pts)",
                    },
                    {
                        couleur: "#eab308",
                        label: "🟡 CONFORME : Résultats conformes à l'IPS (-7 à +7 pts)",
                    },
                    {
                        couleur: "#ef4444",
                        label: "🔴 VIGILANCE : ≥30% compétences vigilance (écart < -7 pts)",
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
                const interpreY = legendeCurrentY + 10;
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
     * Agrège les données par école
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
                    resultats: [],
                    nb_leviers: 0,
                    nb_vigilance: 0,
                    nb_conformes: 0,
                });
            }

            const ecole = parEcole.get(a.uai);
            ecole.resultats.push(a.resultat_reel);

            if (a.categorie_code === "LEVIER") ecole.nb_leviers++;
            else if (a.categorie_code === "VIGILANCE") ecole.nb_vigilance++;
            else ecole.nb_conformes++;
        });

        return Array.from(parEcole.values()).map((e) => {
            const pct_satisfaisant_moyen =
                e.resultats.reduce((a, b) => a + b, 0) / e.resultats.length;

            const total = e.nb_leviers + e.nb_conformes + e.nb_vigilance;
            let profil = "CONFORME";
            if (total > 0) {
                const tauxLeviers = (e.nb_leviers / total) * 100;
                const tauxVigilance = (e.nb_vigilance / total) * 100;

                if (tauxLeviers >= 30) profil = "LEVIER";
                else if (tauxVigilance >= 30) profil = "VIGILANCE";
            }

            return {
                uai: e.uai,
                nom: e.nom,
                ips: e.ips,
                pct_satisfaisant_moyen: pct_satisfaisant_moyen,
                nb_competences: e.resultats.length,
                profil: profil,
            };
        });
    }

    /**
     * Dessine la grille
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
     * Dessine les zones de catégorisation
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
     * Dessine la droite de régression
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

        doc.fontSize(7).font("Helvetica").fillColor("#1f2937");
        const midX = (posX1 + posX2) / 2;
        const midY = (posY1 + posY2) / 2;
        doc.text("Régression", midX - 20, midY - 10);
    }

    /**
     * Dessine les points des écoles avec numéros
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
     * Dessine les axes avec repères
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
