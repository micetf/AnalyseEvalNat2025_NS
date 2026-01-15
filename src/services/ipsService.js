/**
 * Service de récupération des IPS via API data.gouv
 * Gère le cache et le téléchargement des données IPS
 *
 * @module services/ipsService
 * @requires axios
 * @author CPC Numérique
 */

import axios from "axios";
import fs from "fs";
import path from "path";

export class IPSService {
    /**
     * Initialise le service IPS
     * @param {string} cacheDir - Répertoire de cache (optionnel)
     */
    constructor(cacheDir = null) {
        this.baseURL =
            "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-ips-ecoles-ap2022/exports/json";
        this.rentree = "2024-2025";

        // Utiliser __dirname dans le contexte du fichier actuel
        const currentDir = path.dirname(new URL(import.meta.url).pathname);
        this.cacheDir = cacheDir || path.join(currentDir, "../../data/cache");

        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        this.ipsCache = null;
    }

    /**
     * Récupère le chemin du fichier de cache
     * @param {string} codeDepartement - Code département
     * @returns {string}
     */
    getCachePath(codeDepartement) {
        const filename = `ips_dept_${codeDepartement}_${this.rentree.replace(
            "-",
            "_"
        )}.json`;
        return path.join(this.cacheDir, filename);
    }

    /**
     * Vérifie si le cache est valide (< 30 jours)
     * @param {string} cachePath - Chemin du cache
     * @returns {boolean}
     */
    isCacheValid(cachePath) {
        if (!fs.existsSync(cachePath)) return false;

        const stats = fs.statSync(cachePath);
        const ageJours =
            (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        return ageJours < 30;
    }

    /**
     * Charge le cache depuis le disque
     * @param {string} cachePath - Chemin du cache
     * @returns {Array|null}
     */
    loadCache(cachePath) {
        try {
            const data = fs.readFileSync(cachePath, "utf-8");
            return JSON.parse(data);
        } catch (error) {
            console.warn(`   ⚠️  Erreur lecture cache: ${error.message}`);
            return null;
        }
    }

    /**
     * Sauvegarde le cache sur le disque
     * @param {string} cachePath - Chemin du cache
     * @param {Array} data - Données à sauvegarder
     */
    saveCache(cachePath, data) {
        try {
            fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
            console.log(`   💾 Cache sauvegardé: ${path.basename(cachePath)}`);
        } catch (error) {
            console.warn(`   ⚠️  Erreur sauvegarde cache: ${error.message}`);
        }
    }

    /**
     * Télécharge les IPS d'un département
     * @param {string} codeDepartement - Code département
     * @returns {Promise<Array>}
     */
    async downloadDepartementIPS(codeDepartement) {
        console.log(
            `   📡 Téléchargement IPS département ${codeDepartement}...`
        );

        try {
            const params = new URLSearchParams();
            params.append("refine", `rentree_scolaire:"${this.rentree}"`);
            params.append("refine", `code_du_departement:"${codeDepartement}"`);

            const url = `${this.baseURL}?${params.toString()}`;
            const response = await axios.get(url);

            const results = response.data;
            console.log(`   📊 ${results.length} écoles trouvées`);

            const formatted = results.map((record) => ({
                uai: record.uai,
                ips: parseFloat(record.ips) || null,
                secteur: record.secteur,
                academie: record.academie,
                departement: record.departement,
                nom_commune: record.nom_de_la_commune,
                nom_etablissement: record.nom_etablissement || null,
            }));

            console.log(`   ✓ ${formatted.length} IPS téléchargés`);
            return formatted;
        } catch (error) {
            console.error(`   ❌ Erreur téléchargement: ${error.message}`);
            return [];
        }
    }

    /**
     * Charge les IPS d'un département (cache ou API)
     * @param {string} codeDepartement - Code département
     * @param {boolean} forceRefresh - Forcer le téléchargement
     * @returns {Promise<Array>}
     */
    async loadDepartementIPS(codeDepartement, forceRefresh = false) {
        const cachePath = this.getCachePath(codeDepartement);

        if (!forceRefresh && this.isCacheValid(cachePath)) {
            console.log(`   📂 Chargement cache: ${path.basename(cachePath)}`);
            const cached = this.loadCache(cachePath);
            if (cached && cached.length > 0) {
                console.log(`   ✓ ${cached.length} IPS depuis cache`);
                this.ipsCache = cached;
                return cached;
            }
        }

        console.log(`   🌐 Téléchargement depuis API...`);
        const downloaded = await this.downloadDepartementIPS(codeDepartement);

        if (downloaded.length > 0) {
            this.saveCache(cachePath, downloaded);
            this.ipsCache = downloaded;
        }

        return downloaded;
    }

    /**
     * Récupère l'IPS d'une école depuis le cache
     * @param {string} uai - UAI de l'école
     * @returns {Object|null}
     */
    getIPSFromCache(uai) {
        if (!this.ipsCache) return null;
        return this.ipsCache.find((e) => e.uai === uai.trim()) || null;
    }

    /**
     * Récupère les IPS pour une liste d'UAI
     * @param {Array} uais - Liste des UAI
     * @returns {Promise<Array>}
     */
    async getIPSBatch(uais) {
        if (!this.ipsCache) {
            console.warn(`   ⚠️  Aucun cache IPS chargé`);
            return [];
        }

        console.log(`   🔍 Recherche de ${uais.length} écoles...`);

        const results = [];
        const notFound = [];

        for (const uai of uais) {
            const ips = this.getIPSFromCache(uai);
            if (ips) {
                results.push(ips);
            } else {
                notFound.push(uai);
            }
        }

        console.log(`   ✓ ${results.length}/${uais.length} IPS trouvés`);

        if (notFound.length > 0 && notFound.length <= 5) {
            console.warn(`   ⚠️  ${notFound.length} écoles non trouvées:`);
            notFound.forEach((uai) => console.warn(`      - ${uai}`));
        }

        return results;
    }
}
