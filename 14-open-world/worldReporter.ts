import type { WorldFrame, WorldReport } from './worldTypes.ts';

export type SavedWorldReport = WorldReport & { test: '14-open-world'; provenance: unknown };
export const modeLabels: Record<string, string> = {
  brute: 'Brut · tout soumis', frustum: 'Culling Three.js', hierarchy: 'Culling des quartiers + Three.js',
  'shadow-cache': 'Ombres statiques réutilisées', 'static-cache': 'Ombres et matrices statiques réutilisées',
  'adaptive-coherent': 'Culling adaptatif · visibilité certifiée',
  'adaptive-frustum': 'Culling adaptatif · dernier plan rejetant',
};
export const ms = (value: number | null | undefined) => value == null ? 'non mesuré' : value.toFixed(3);
function cadenceStats(samples: WorldFrame[]) {
  const intervals = samples.map(sample => sample.rafDeltaMs).filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
  const duration = intervals.reduce((sum, value) => sum + value, 0);
  return {
    cadence: duration > 0 ? 1000 * intervals.length / duration : null,
    rafSamples: intervals.length,
    over33: intervals.filter(value => value > 33.333).length,
    over50: intervals.filter(value => value > 50).length,
  };
}
export function worldRows(report: WorldReport) {
  return report.blocks.map(block => ({
    label: modeLabels[block.variant], frames: block.samples.length, ...cadenceStats(block.samples),
    cpu: block.summary.cpuFrameWorkMs?.p50 ?? null,
    cpuP95: block.summary.cpuFrameWorkMs?.p95 ?? null,
    cpuP99: block.summary.cpuFrameWorkMs?.p99 ?? null,
    gpu: block.summary.gpuMs?.p50 ?? null,
    gpuSamples: block.summary.gpuMs?.validSamples ?? 0,
    raf: block.summary.rafDeltaMs?.p50 ?? null,
    rafP95: block.summary.rafDeltaMs?.p95 ?? null,
    rafP99: block.summary.rafDeltaMs?.p99 ?? null,
    mainMin: Math.min(...block.samples.map(s => s.mainPassTriangles)),
    mainMax: Math.max(...block.samples.map(s => s.mainPassTriangles)),
    shadowMax: Math.max(...block.samples.map(s => s.shadowPassTriangles)),
  }));
}
const json = (value: unknown) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
const comparisonDescriptions: Record<string, string> = {
  'adaptive-coherent': 'Même référence Three.js et mêmes sphères. Une marge minimale positive certifie la visibilité. Entre deux caméras, elle est diminuée de max(||delta normale||) × ||centre|| + max(|delta constante|), avec majoration d’arrondi. Cette borne vient de Cauchy-Schwarz. Si la marge reste strictement positive, les six plans restent satisfaits ; sinon les tests exacts sont recalculés. Les rejets sont toujours testés avec la caméra courante. Les décisions pilotent les layers du rendu principal ; les ombres restent inchangées. Les compteurs de certificats, plans testés et rejets sont archivés. Le cache de sphères et les certificats supposent les transformations du décor constantes ; animation et streaming restent hors validation.',
  'adaptive-frustum': 'Référence : culling par sphère Three.js. Proposition adaptative : les mêmes sphères monde sont préparées pour ce décor immobile ; à chaque nouvelle caméra, le dernier plan rejetant est testé en premier, puis les cinq autres si nécessaire. La conjonction des six prédicats reste identique, quelle que soit leur permutation. Chaque décision est recalculée, pilote les layers du rendu principal et est vérifiée contre intersectsObject lors des contrôles. Les ombres conservent les layers et le culling Three.js d’origine. Aucun LOD ou budget graphique réduit. Les compteurs adaptivePlaneTests et adaptiveRejectedMeshes sont dans les données brutes. Cette adaptativité concerne la visibilité de la caméra ; elle ne valide pas animation ou streaming.',
  frustum: 'Rendu brut (toutes les géométries soumises) contre élimination hors champ de Three.js. Ce contrôle mesure le bénéfice du culling classique ; il ne prouve pas une amélioration de ces calculs.',
  hierarchy: 'Culling Three.js habituel contre filtrage conservateur des quartiers suivi du même culling Three.js. La variante conserve les quartiers utiles à la caméra ou aux ombres.',
  'shadow-cache': 'Référence Three.js avec culling habituel et recalcul des ombres contre réutilisation de la carte des ombres statiques. Le décor, la lumière et les objets qui produisent les ombres restent fixes ; seule la caméra suit le parcours. La réutilisation évite de soumettre à nouveau la passe des ombres après sa préparation.',
  'static-cache': 'Référence Three.js avec culling habituel contre réutilisation des ombres et des matrices du décor statique. La caméra continue de parcourir le décor ; les transformations des bâtiments et la lumière restent fixes. Le premier calcul des ombres et des matrices reste nécessaire avant leur réutilisation.',
};
const staticCacheJustification = 'Justification statique : S(t) = F(géométrie, transformations, lumière, projection et couverture des ombres, textures, résolution, camera.layers), donc S(t) = S(0) tant que toutes ces entrées restent constantes. Le mouvement de la caméra principale conserve ici ses layers et les paramètres de la caméra des ombres. Pour les matrices, W_i = W_parent × L_i reste invariant par induction lorsque les matrices locales et la racine restent fixes. La carte des ombres est recalculée à l’entrée du mode et pour chaque nouvelle configuration. Sa première construction intervient en préparation ou pendant l’échauffement ; les blocs mesurent ensuite sa réutilisation. Les contrôles de pixels comparent plusieurs poses avec la même carte après amorçage ; leurs compteurs de passe des ombres restent enregistrés. Cette justification ne donne aucun gain théorique de FPS : seules les durées du banc permettent de comparer les résultats. Les animations et les changements de lumière, alpha, textures, layers ou objets exigent une invalidation adaptée, qui n’est pas testée ici.';
export function formatWorldReport(report: SavedWorldReport): string {
  return `# 14 · Monde ouvert sous pression

Date : ${report.timestamp}

**Contrôle des images : ${report.quality.passed ? 'réussi pour les vues contrôlées' : 'ÉCHEC — comparaison rejetée'}.**

## Ce que cette campagne compare

${comparisonDescriptions[report.config.candidate] ?? report.config.candidate}

${report.config.candidate === 'shadow-cache' || report.config.candidate === 'static-cache' ? staticCacheJustification : ''}

Aucun niveau de détail réduit, aucune réduction de résolution entre A et B. Les quartiers partagent les mêmes modèles et textures. Le nombre de triangles source désigne les occurrences dans le décor, pas autant de géométrie unique en mémoire ni autant de triangles nécessairement visibles.

## Configuration et décor

${json({ config: report.config, scene: report.scene, preparationMs: report.preparationMs, qualityMs: report.qualityMs })}

## Mesures par bloc

Les lignes suivent l'ordre réel ${report.config.order ?? 'ABBA'}. Les répétitions nouvelles alternent ABBA et BAAB pour contrôler l’effet d’ordre. Durées en millisecondes ; p50 médiane, p95 et p99 pour les images les plus lentes. L'intervalle rAF est une cadence de callbacks, pas une mesure de présentation physique.

| Variante | Images | CPU p50 | CPU p95 | CPU p99 | GPU p50 | GPU mesurées | Intervalle p50 | Intervalle p95 | Intervalle p99 | Triangles principaux min–max | Ombres max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${worldRows(report).map(row => `| ${row.label} | ${row.frames} | ${[row.cpu,row.cpuP95,row.cpuP99,row.gpu].map(ms).join(' | ')} | ${row.gpuSamples}/${row.frames} | ${[row.raf,row.rafP95,row.rafP99].map(ms).join(' | ')} | ${row.mainMin}–${row.mainMax} | ${row.shadowMax} |`).join('\n')}

La somme des passes principale et ombres représente le travail soumis ; elle ne doit pas être annoncée comme autant de triangles uniques. Une valeur GPU absente reste non mesurée ; la colonne GPU mesurées indique le nombre d’échantillons valides sur les images du bloc. En affichage filaire, les segments sont comptés séparément des triangles. Une passe des ombres réutilisée peut soumettre zéro triangle d’ombres sans supprimer les ombres de l’image. Le travail CPU chronométré couvre caméra, culling et soumission ; il exclut notamment la collecte des queries GPU effectuée avant ce chronométrage et ne désigne donc pas toute la boucle du navigateur.

## Cadence et intervalles longs

La cadence de callbacks est calculée par 1 000 / moyenne des intervalles rAF valides, et non par moyenne des FPS. Le premier intervalle de chaque bloc, non mesuré, est exclu. Le nombre d’intervalles retenus et le nombre d’images enregistrées sont affichés ; les pourcentages utilisent uniquement les intervalles valides. Cette cadence ne mesure pas la présentation physique.

| Variante | Cadence callbacks/s | Intervalles valides / images | > 33,333 ms | > 50 ms |
|---|---:|---:|---:|---:|
${worldRows(report).map(row => {
    const percent = (count: number) => row.rafSamples ? `${(100 * count / row.rafSamples).toFixed(2)} % (${count}/${row.rafSamples})` : 'non mesuré (0/0)';
    return `| ${row.label} | ${row.cadence === null ? 'non mesurée' : row.cadence.toFixed(2)} | ${row.rafSamples}/${row.frames} | ${percent(row.over33)} | ${percent(row.over50)} |`;
  }).join('\n')}

## Contrôle des pixels

${json(report.quality)}

## Machine, versions et empreintes des sources

${json({ environment: report.environment, provenance: report.provenance })}

## Limites de la preuve

${report.limitations.map(limit => `- ${limit}`).join('\n')}

- Les variantes de cache supposent un décor et une lumière statiques. Une transformation d’objet, de lumière ou de matériau affectant les ombres exige de recalculer les données concernées ; ce banc ne valide pas cette gestion dans une scène animée.
- Scène urbaine étendue par répétition de Bistro, entièrement résidente. Ce scénario ne mesure pas le streaming d'un monde infini, les collisions, les personnages ou l'animation des bâtiments.
- Une machine de moins de cinq ans n'est pas une catégorie homogène. Les résultats s'appliquent à la configuration matérielle enregistrée ; ils ne certifient pas les petites machines non testées.
- La réussite des vues de contrôle ne constitue pas une preuve visuelle pour toutes les caméras possibles. Les données sont conservées même en cas de rejet.
- Une campagne isolée n'établit pas une supériorité générale. Comparer les répétitions, les résolutions et les charges équivalentes avant toute adoption.

## Asset et licence

Amazon Lumberyard Bistro, Open Research Content Archive (ORCA), 2017. [Source officielle](https://developer.nvidia.com/orca/amazon-lumberyard-bistro), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Conversion FBX vers glTF locale et répétition des quartiers ; détails et empreintes dans le manifeste de l'asset.
`;
}
