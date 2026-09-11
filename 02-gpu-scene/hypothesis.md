# Hypothèse R&D : 02-gpu-scene

**Sujet d'étude :** Représentation d'une Scène Hétérogène Complète sur GPU (ObjectBuffer, GeometryBuffer, MaterialBuffer, DrawBuffer)  
**Question gouvernante :** *Peut-on faire fonctionner une vraie scène 3D hétérogène (multi-géométries, multi-matériaux, objets dynamiques) dans un pipeline GPU-driven sans perdre l'avantage de soumission $O(1)$ démontré sur le prototype initial ?*

---

## 1. Contexte & Problème

Le banc `01-gpu-driven` a validé le principe d'une décision de visibilité et d'un compactage entièrement déportés sur GPU via Compute Shader WGSL et `drawIndexedIndirect`, divisant le temps de soumission CPU par plus de $13\times$ à S3 (2 000 objets).

Cependant, le prototype `01` reposait sur une hypothèse simplificatrice :
> **Scène homogène :** 1 seule topologie partagée, 1 seul matériau basique.

Dans une production réelle, une scène n'est jamais homogène :
- Elle comporte des centaines ou milliers de **géométries distinctes** (maillages uniques).
- Elle comporte des dizaines ou centaines de **matériaux et textures distincts**.
- Une fraction des objets est **dynamique** (transforms modifiées par frame).
- La caméra est mobile, faisant varier la **visibilité frustum** de 0% à 100%.

Sans une structure de données GPU dédiée, la gestion de cette hétérogénéité forcerait le retour à des interruptions d'encodage CPU (`setPipeline`, `setBindGroup`, `draw`), anéantissant le gain GPU-driven.

---

## 2. Hypothèse Technique

En unifiant la scène dans quatre tampons de stockage GPU contigus :
1. **`ObjectBuffer`** : Transform (`mat4x4`), boîtes englobantes AABB/Sphère, `geometryId`, `materialId`, `flags`.
2. **`GeometryBuffer`** : Offsets globaux de sommets (`vertexOffset`), offsets d'indices (`indexOffset`), compteurs d'indices (`indexCount`), rayon englobant.
3. **`MaterialBuffer`** : Paramètres PBR/couleur, indices de textures, drapeaux de rendu.
4. **`DrawBuffer`** : Tableau de commandes `drawIndexedIndirect` compactées et alimentées directement par le compute shader.

Le GPU est capable d'évaluer la visibilité, de sélectionner la sous-plage géométrique et de générer l'ensemble des commandes de tir indirectes en **un seul dispatch compute**, sans aucune intervention du thread JavaScript.

---

## 3. Les 4 Dimensions de Stress Expérimental

Le banc d'essai évalue la robustesse de l'architecture selon quatre axes orthogonaux :

| Dimension | Paliers de test | Ce que l'on cherche à isoler |
| :--- | :--- | :--- |
| **A — Diversité géométrique** | 1, 10, 100, 1 000, 10 000 topologies | Impact de l'indirection géométrique sur la cohérence du cache et du dispatch. |
| **B — Diversité matériaux** | 1, 10, 100, 1 000 matériaux | Coût de l'adressage des matériaux dans le shader de rendu. |
| **C — Dynamique de scène** | 0%, 10%, 50%, 100% transforms modifiées | Bande passante CPU $\rightarrow$ GPU (`queue.writeBuffer`) et saturation de bus. |
| **D — Visibilité frustum** | 0%, 10%, 25%, 50%, 75%, 100% visibles | Efficacité du compactage atomique sous différents taux de rejet. |

---

## 4. Critères de Décision & Seuils de Sortie (Gates)

Pour que l'architecture `02-gpu-scene` soit adoptée comme socle des étapes suivantes (`03-gpu-lod` et `04-meshlets`), elle doit franchir les trois seuils suivants :

1. **Gate Soumission CPU :** Maintenir $\ge 70\%$ de réduction du temps de soumission CPU par rapport à Three.js classique sur le palier 2 000 objets avec 100 géométries distinctes.
2. **Gate Invariant CPU $\leftrightarrow$ GPU :** 0 octet lu par le CPU depuis la VRAM pendant la frame de rendu (aucun stall de pipeline).
3. **Gate Débit Dynamique :** Temps de mise à jour CPU $\rightarrow$ GPU $\le 1.0\,\text{ms}$ pour 50% d'objets dynamiques sur 2 000 objets.
