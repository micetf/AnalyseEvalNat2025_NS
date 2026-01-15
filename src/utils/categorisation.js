/**
 * Utilitaires de catégorisation
 * Fonctions helper pour la classification des écoles et compétences
 *
 * @module utils/categorisation
 * @author CPC Numérique
 */

/**
 * Catégorise une école selon son IPS
 * @param {number} ips - Indice de Position Sociale
 * @returns {string} Catégorie IPS
 */
export function categoriserIPS(ips) {
    if (ips < 80) return "Très défavorisé";
    if (ips < 90) return "Défavorisé";
    if (ips > 120) return "Très favorisé";
    if (ips > 110) return "Favorisé";
    return "Moyen";
}

/**
 * Détermine le profil dominant d'une école pour une matière
 * @param {Object} stats - {leviers, conformes, vigilance}
 * @param {number} seuilProfil - Seuil en % pour déterminer le profil (défaut: 30)
 * @returns {string} "L" (Levier), "V" (Vigilance) ou "C" (Conforme)
 */
export function determinerProfilMatiere(stats, seuilProfil = 30) {
    const total = stats.leviers + stats.conformes + stats.vigilance;

    if (total === 0) return "C";

    const tauxLeviers = (stats.leviers / total) * 100;
    const tauxVigilance = (stats.vigilance / total) * 100;

    if (tauxLeviers >= seuilProfil) return "L";
    if (tauxVigilance >= seuilProfil) return "V";
    return "C";
}

/**
 * Calcule la priorité d'une école selon son profil croisé
 * @param {string} profilMaths - "L", "C" ou "V"
 * @param {string} profilFrancais - "L", "C" ou "V"
 * @returns {number} Priorité de 0 (urgent) à 5 (excellence)
 */
export function calculerPriorite(profilMaths, profilFrancais) {
    const profil = `${profilMaths},${profilFrancais}`;

    const priorites = {
        "V,V": 0, // Urgence absolue
        "V,C": 1,
        "C,V": 1, // Prioritaire
        "V,L": 2,
        "L,V": 2, // Accompagnement ciblé
        "C,C": 3, // Standard
        "C,L": 4,
        "L,C": 4, // Suivi renforcé
        "L,L": 5, // Excellence
    };

    return priorites[profil] ?? 3;
}

/**
 * Détermine l'emoji représentant un profil
 * @param {string} profilCroise - Format "(M,F)" ex: "(V,V)"
 * @returns {string} Emoji correspondant
 */
export function getEmojiProfil(profilCroise) {
    const emojis = {
        "(V,V)": "🔴",
        "(V,C)": "🚨",
        "(C,V)": "🚨",
        "(V,L)": "🎯",
        "(L,V)": "🎯",
        "(C,C)": "😐",
        "(C,L)": "✅",
        "(L,C)": "✅",
        "(L,L)": "⭐",
    };

    return emojis[profilCroise] || "❓";
}

/**
 * Génère une description textuelle du profil
 * @param {string} profilCroise - Format "(M,F)"
 * @returns {string} Description
 */
export function getDescriptionProfil(profilCroise) {
    const descriptions = {
        "(V,V)": "ACCOMPAGNEMENT GLOBAL URGENT",
        "(V,C)": "ACCOMP. MATHS + SUIVI FRANÇAIS",
        "(C,V)": "ACCOMP. FRANÇAIS + SUIVI MATHS",
        "(V,L)": "ACCOMP. MATHS + VALORISER FRANÇAIS",
        "(L,V)": "ACCOMP. FRANÇAIS + VALORISER MATHS",
        "(C,C)": "SUIVI STANDARD",
        "(C,L)": "SUIVI RENFORCÉ + OBSERVATION",
        "(L,C)": "SUIVI RENFORCÉ + OBSERVATION",
        "(L,L)": "EXCELLENCE À VALORISER",
    };

    return descriptions[profilCroise] || "PROFIL INDÉTERMINÉ";
}

/**
 * Interprète un coefficient R²
 * @param {number} r2 - Coefficient de détermination
 * @returns {string} Interprétation pédagogique
 */
export function interpreterR2(r2) {
    if (r2 > 0.7) return "IPS très déterminant (leviers limités)";
    if (r2 > 0.5) return "IPS déterminant";
    if (r2 > 0.3) return "IPS modérément déterminant";
    return "Faible influence IPS (forte marge manœuvre) ✨";
}
