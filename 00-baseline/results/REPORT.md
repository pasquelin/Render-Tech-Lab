# Rapport de Référence Socle : 00-baseline

**Périmètre :** Moteur Three.js standard de référence (Spec 11 & Spec 13)  
**Dernière mise à jour :** 11/09/2026 16:43:47  
**Objectif :** Établir la courbe de charge étalon S0 à S5 pour servir de point zéro à tous les modules R&D.

> **Règle gouvernante :** Aucune infrastructure majeure n'est adoptée sans qu'un banc démontre que l'architecture actuelle est le facteur limitant.

---

## 1. Courbe de Charge Officielle S0–S5 (Three.js Standard)

| Scénario | Intitulé | Objets | Instancié | Lumières | Submit CPU | Frame CPU | Draw Calls | Goulot Dominant |
|:---:|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **S0** | Baseline minimale | 1 | Non | 1 | **0.08 ms** | 0.45 ms | 2 | Aucun |
| **S1** | 500 instanciés | 500 | Oui | 2 | **0.12 ms** | 0.65 ms | 3 | Aucun |
| **S2** | 1 000 instanciés | 1000 | Oui | 2 | **0.18 ms** | 0.85 ms | 3 | Aucun |
| **S3** | 2 000 uniques | 2000 | Non | 2 | **3.35 ms** | 4.15 ms | 2002 | CPU Soumission |
| **S4** | 30 lumières dynamiques | 200 | Oui | 30 | **0.45 ms** | 1.95 ms | 31 | GPU |
| **S5** | Hostile | 5000 | Non | 8 | **8.45 ms** | 10.20 ms | 5008 | CPU Soumission |

---

## 2. Enseignements & Déclencheurs R&D

1. **Le Coude CPU de S3 (2 000 objets uniques) :**
   - Sur S1 et S2 (instanciés), le moteur tient sans difficulté ($submit < 0.2\,\text{ms}$).
   - Dès que les objets sont uniques (S3), le temps de soumission explose à **$3.35\,\text{ms}$** pour $2\,000$ draw calls.
   - **Décision R&D :** C'est ce coude précis qui justifie l'ouverture du module [**01-gpu-driven**](../01-gpu-driven/README.md).

2. **Le Stress Passes de S4 (30 lumières) :**
   - La soumission reste contenue, mais le frametime GPU augmente.
   - **Décision R&D :** Sujet suivi par le module [**04-lumen-inspired**](../04-lumen-inspired/README.md).

3. **Le Scénario Hostile S5 :**
   - Décrochage sévère ($8.45\,\text{ms}$ de soumission CPU).
   - Justifie les techniques combinées : GPU-driven, LOD automatique (Meshoptimizer), et Hi-Z.
