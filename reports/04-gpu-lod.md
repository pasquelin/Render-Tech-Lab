# Rapport de Banc R&D : 04-gpu-lod

**Périmètre :** Niveaux de Détail (LOD) & Screen-Space Error (Spec 16 & Master Test Plan)  
**Dernière mise à jour :** 11/09/2026 18:08:44  
**Plateforme d'essai :** Apple M-Series GPU (WebGPU) | Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.52386.0 Chrome/152.0.7977.76 Safari/537.36  
**Commit git :** `d2eb71a`  
**Statut d'arbitrage :** `INTEGRATE` pour 04A & 04B (mesurés) — `PENDING` pour 04C (non instrumenté)

> **Règle gouvernante :** *« Aucune infrastructure majeure n'est adoptée sans qu'un banc démontre que l'architecture actuelle est le facteur limitant. »*

---

## 1. Synthèse Exécutive & Décision d'Arbitrage

Le banc unitaire **04-gpu-lod** a décomposé le problème des niveaux de détail en 3 sous-bancs scientifiques indépendants :

1. **04A — Génération LOD (`meshoptimizer`) :**
   - La décimation hors thread UI produit une réduction géométrique massive (**75.0% de triangles économisés**) en **11.4 ms** sans saccade de frame.
   - **Décision :** `INTEGRATE` — Validé pour l'import de modèles 3D denses.

2. **04B — Sélection Screen-Space Error (CPU) :**
   - Pour des scènes de 1 000 à 10 000 objets, la boucle CPU est ultra-légère (**0.07 ms à 2 000 objets**).
   - **Décision :** `INTEGRATE` — Recommandé par défaut jusqu'à 10 000 objets.

3. **04C — Sélection Screen-Space Error (GPU) :**
   - **Non mesuré.** Le Compute Shader WGSL (`gpuLodShader.ts`) est écrit mais n'est dispatché par aucun code : aucune campagne ne l'a exécuté.
   - **Décision :** `PENDING` — à réévaluer une fois le dispatch réellement instrumenté.

---

## 2. 04A — Génération LOD Hors Thread UI (`meshoptimizer`)

| Niveau | Ratio Cible | Triangles | Gain Géométrique | Erreur Simplification |
|:---:|:---:|:---:|:---:|:---:|
| **LOD 0** | 100 % | 8 064 | 0.0 % (Référence) | 0.00 mm |
| **LOD 1** | 50 % | 4 031 | −50.0 % | < 0.02 mm |
| **LOD 2** | 25 % | 2 016 | −75.0 % | < 0.05 mm |

- **Temps total de décimation (Worker) :** `11.4 ms`
- **Mode de transfert mémoire :** `Transferable ArrayBuffer` (0 copie, allocation isolée).

---

## 3. Comparatif 04B (CPU) vs 04C (GPU) : Sélection Screen-Space Error

| Objets dans la Scène | Sélection CPU 04B (mesurée) | Sélection GPU 04C | Ratio |
|:---:|:---:|:---:|:---:|
| **1 000** | 0.12 ms | non mesuré | n/a |
| **2 000** | 0.07 ms | non mesuré | n/a |
| **5 000** | 0.14 ms | non mesuré | n/a |
| **10 000** | 0.31 ms | non mesuré | n/a |
| **50 000** | 1.51 ms | non mesuré | n/a |

> La colonne 04C reste vide tant que `gpuLodShader.ts` n'est pas dispatché :
> le banc ne publie pas d'estimation analytique à la place d'une mesure.

---

## 4. Validation Contractuelle de l'Erreur Projetée (SSE)

La formule mathématique gouvernante :

$$\text{pixels} = \frac{D \times H}{2d \tan(\text{FOV} / 2)}$$

- **Seuil contractuel maximal :** `\le 1.5 pixel`
- **Erreur projetée maximale observée :** `0.04 px`
- **Statut de conformité :** ✅ **CONFORME** (Erreur imperceptible sous la tolérance visuelle)

---

## 5. Prochaine Étape

La décimation géométrique et la sélection LOD étant validées, le laboratoire peut aborder le découpage infra-maillage :
👉 **[05 · Meshlets & Cluster Partitioning](../05-meshlets/README.md)**
