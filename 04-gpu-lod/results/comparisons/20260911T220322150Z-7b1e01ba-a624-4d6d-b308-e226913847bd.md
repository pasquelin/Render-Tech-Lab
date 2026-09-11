# 04 · Comparaison des calculs sur une scène détaillée

Date : 2026-09-11T22:02:59.586Z

**Statut : mesures comparatives, aucune certification globale automatique.**

## Configuration réellement exécutée

```json
{
  "count": 2000,
  "width": 1920,
  "height": 1080,
  "pixelRatio": 1,
  "seed": 42,
  "samples": 600,
  "warmup": 60,
  "shadows": true,
  "candidate": "prepared"
}
```

## Environnement et provenance

```json
{
  "runtime": {
    "browser": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    "threeVersion": "174",
    "backend": "WebGL2",
    "glVersion": "WebGL 2.0 (OpenGL ES 3.0 Chromium)",
    "renderer": "WebKit WebGL",
    "gpu": "ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)",
    "vendor": "Google Inc. (Apple)",
    "timerQueryAvailable": true,
    "devicePixelRatio": 2.200000047683716,
    "visibility": "visible",
    "cssWidth": 1920,
    "cssHeight": 1080,
    "renderPixelRatio": 1,
    "physicalWidth": 1920,
    "physicalHeight": 1080,
    "performanceTimeOrigin": 1789164129790.9,
    "candidateStatus": "benchmark-candidate",
    "candidateAssumptions": null
  },
  "sources": {
    "before": {
      "timestamp": "2026-09-11T22:02:59.585Z",
      "node": "v26.8.2",
      "os": {
        "platform": "darwin",
        "release": "25.6.0",
        "arch": "arm64"
      },
      "cpu": {
        "model": "Apple M2 Max",
        "logicalCount": 12
      },
      "memoryBytes": 103079215104,
      "commit": "8425a625878e0e0ae4e1696e5771d77994840dfd",
      "sourceHashes": {
        "04-gpu-lod/cpuLodSelector.ts": "4bdc8710f3a16b0b80b68a3ce456183890816335bc49c459707d97f10b6f4e48",
        "shared/math/screenSpaceError.ts": "91f44140836225b19f47b7d6b2263d5ff4a92237aa5d9ad453a421360f32c723",
        "shared/scene/random.ts": "0fb7dd2984b5af2996d5d1a64432dc6200e3f83c51163a81f3d327eea8c973e6",
        "04-gpu-lod/benchmark/variants.ts": "e2603cfcbe895d1dcdabaa56e363345d12c00af3ec8243b154dc07fa9cf425d9",
        "04-gpu-lod/benchmark/sceneComparison.ts": "f9c8e6960dbd85b41e0d7f8706ac24b877fa8439f2661bb3d6dbed8ad2eaddda",
        "04-gpu-lod/benchmark/comparisonTypes.ts": "8c22fd344e3a0a4f4f369f384be917b7945213b4c4c11fffcceeb60fec8e4a38",
        "04-gpu-lod/benchmark/comparisonReporter.ts": "e08142257cdd15fa7d3112dc562a25da37217cd02d120fb639d30919b9168e6c",
        "04-gpu-lod/benchmark/comparisonPage.ts": "6f646000bf39b966c96d6dd49312c3b7f416242c042aed1e9f71fb392ccc733e",
        "benchmarks/lodComparisonPlugin.ts": "ce03b19cd9616e982c988e7d1b4f0081619b10376dc2ba6341644843b6b01d73",
        "package.json": "1bb8e3475a277dbcd9c785ec709836421de95992e68aeb561762a072e981ed85",
        "pnpm-lock.yaml": "2f6313d7776788eb69b8fc27b58d9897f970453752f920a65a036a08d3362bd6"
      }
    },
    "after": {
      "timestamp": "2026-09-11T22:03:22.110Z",
      "node": "v26.8.2",
      "os": {
        "platform": "darwin",
        "release": "25.6.0",
        "arch": "arm64"
      },
      "cpu": {
        "model": "Apple M2 Max",
        "logicalCount": 12
      },
      "memoryBytes": 103079215104,
      "commit": "8425a625878e0e0ae4e1696e5771d77994840dfd",
      "sourceHashes": {
        "04-gpu-lod/cpuLodSelector.ts": "4bdc8710f3a16b0b80b68a3ce456183890816335bc49c459707d97f10b6f4e48",
        "shared/math/screenSpaceError.ts": "91f44140836225b19f47b7d6b2263d5ff4a92237aa5d9ad453a421360f32c723",
        "shared/scene/random.ts": "0fb7dd2984b5af2996d5d1a64432dc6200e3f83c51163a81f3d327eea8c973e6",
        "04-gpu-lod/benchmark/variants.ts": "e2603cfcbe895d1dcdabaa56e363345d12c00af3ec8243b154dc07fa9cf425d9",
        "04-gpu-lod/benchmark/sceneComparison.ts": "f9c8e6960dbd85b41e0d7f8706ac24b877fa8439f2661bb3d6dbed8ad2eaddda",
        "04-gpu-lod/benchmark/comparisonTypes.ts": "8c22fd344e3a0a4f4f369f384be917b7945213b4c4c11fffcceeb60fec8e4a38",
        "04-gpu-lod/benchmark/comparisonReporter.ts": "e08142257cdd15fa7d3112dc562a25da37217cd02d120fb639d30919b9168e6c",
        "04-gpu-lod/benchmark/comparisonPage.ts": "6f646000bf39b966c96d6dd49312c3b7f416242c042aed1e9f71fb392ccc733e",
        "benchmarks/lodComparisonPlugin.ts": "ce03b19cd9616e982c988e7d1b4f0081619b10376dc2ba6341644843b6b01d73",
        "package.json": "1bb8e3475a277dbcd9c785ec709836421de95992e68aeb561762a072e981ed85",
        "pnpm-lock.yaml": "2f6313d7776788eb69b8fc27b58d9897f970453752f920a65a036a08d3362bd6"
      }
    },
    "sourcesStable": true
  }
}
```

## Comparaison par bloc

Durées en millisecondes. Chaque ligne correspond à un bloc après échauffement ; l'ordre des lignes est l'ordre réel d'exécution. Les quantiles utilisent l'indice zéro floor((N−1)×p). Les échantillons consécutifs sont corrélés ; ce tableau ne constitue pas à lui seul un test de significativité.

| Variante | Images | Sélection p50 | Travail CPU p50 | Travail CPU p95 | Intervalle rAF p50 | Intervalle rAF p95 | GPU p50 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Référence 04B | 600 | 0.200 | 1.000 | 1.300 | 8.300 | 9.000 | 1.802 |
| Tangente partagée | 600 | 0.100 | 1.000 | 1.200 | 8.300 | 9.300 | 1.809 |
| Tangente partagée | 600 | 0.100 | 1.000 | 1.200 | 8.300 | 9.000 | 1.728 |
| Référence 04B | 600 | 0.200 | 0.900 | 1.300 | 8.300 | 9.300 | 1.733 |

La sélection CPU est une partie du travail de frame. L'intervalle rAF mesure la cadence des callbacks et non la présentation physique. Un temps GPU absent reste non mesuré. Les éventuels échantillons à zéro reflètent la résolution du compteur ; ils ne signifient pas un travail gratuit. Les comparaisons de qualité et le contrôle exhaustif de la trajectoire sont effectués hors de la fenêtre de chronométrage.

## Géométrie et préparation

```json
{
  "scene": {
    "fixture": "dense-visible-resident-torus-knot-grid-with-detailed-foreground",
    "count": 2000,
    "geometryTrianglesPerLod": [
      12288,
      3072,
      768
    ],
    "sourceTrianglesAtFinestLod": 24576000,
    "positionHash": "c8146221e8fff59a2187415788e8be981d7980d03343da9a754de544371639d6",
    "radiiHash": "c6f9a849f3e1732efb9a1da54b44ebe12c490302c8e71beadafd2ccd2db502ac",
    "matricesHash": "e98dd298d80be6df4b53268f1f4b9ca338702e67a06c824b43c41e727940eb72",
    "materialCount": 2,
    "lights": 3,
    "shadowLights": 1,
    "shadowMapSize": [
      2048,
      2048
    ],
    "fov": 60,
    "aspect": 1.7777777777777777,
    "near": 0.1,
    "far": 2000,
    "seed": 42,
    "instanceBufferCapacityBytes": 384000,
    "snapshotRetentionBytesPerBlock": 1200000,
    "note": "All N assets are selected and submitted; frustum counts do not mean every surface is unoccluded."
  },
  "preparationMs": {
    "sceneAndCompileMs": 8.399999976158142,
    "trajectoryControlsMs": 162.10000002384186,
    "pixelQualityMs": 235.89999997615814
  }
}
```

Triangles réellement soumis, minimum–maximum des images mesurées. La passe principale et les ombres sont séparées ; leur somme ne représente pas des triangles uniques supplémentaires dans le modèle.

| Bloc | Passe principale | Ombres | Dessins au total |
|---|---:|---:|---:|
| 1 · Référence 04B | 1549826–1549826 | 1549824–1549824 | 7–7 |
| 2 · Tangente partagée | 1549826–1549826 | 1549824–1549824 | 7–7 |
| 3 · Tangente partagée | 1549826–1549826 | 1549824–1549824 | 7–7 |
| 4 · Référence 04B | 1549826–1549826 | 1549824–1549824 | 7–7 |

## Contrôle des résultats et de l'image

```json
{
  "passed": true,
  "captures": [
    {
      "frameIndex": 0,
      "variant": "reference",
      "width": 1920,
      "height": 1080,
      "differentPixels": 0,
      "maxChannelError": 0,
      "referenceHash": "fd587e2dead09231ac27d04693506fe34d8ea73d77ee47c7a010b3428c01e320",
      "candidateHash": "fd587e2dead09231ac27d04693506fe34d8ea73d77ee47c7a010b3428c01e320"
    },
    {
      "frameIndex": 0,
      "variant": "prepared",
      "width": 1920,
      "height": 1080,
      "differentPixels": 0,
      "maxChannelError": 0,
      "referenceHash": "fd587e2dead09231ac27d04693506fe34d8ea73d77ee47c7a010b3428c01e320",
      "candidateHash": "fd587e2dead09231ac27d04693506fe34d8ea73d77ee47c7a010b3428c01e320"
    },
    {
      "frameIndex": 300,
      "variant": "reference",
      "width": 1920,
      "height": 1080,
      "differentPixels": 0,
      "maxChannelError": 0,
      "referenceHash": "58904c006658a7eb9dcb971f9d0ba64a06d0f367c0ab819b8037669f93704722",
      "candidateHash": "58904c006658a7eb9dcb971f9d0ba64a06d0f367c0ab819b8037669f93704722"
    },
    {
      "frameIndex": 300,
      "variant": "prepared",
      "width": 1920,
      "height": 1080,
      "differentPixels": 0,
      "maxChannelError": 0,
      "referenceHash": "58904c006658a7eb9dcb971f9d0ba64a06d0f367c0ab819b8037669f93704722",
      "candidateHash": "58904c006658a7eb9dcb971f9d0ba64a06d0f367c0ab819b8037669f93704722"
    },
    {
      "frameIndex": 599,
      "variant": "reference",
      "width": 1920,
      "height": 1080,
      "differentPixels": 0,
      "maxChannelError": 0,
      "referenceHash": "0d0498acd9365f1d3fb2141ae7b771ae477f8758d15fb48184464c8899a948b4",
      "candidateHash": "0d0498acd9365f1d3fb2141ae7b771ae477f8758d15fb48184464c8899a948b4"
    },
    {
      "frameIndex": 599,
      "variant": "prepared",
      "width": 1920,
      "height": 1080,
      "differentPixels": 0,
      "maxChannelError": 0,
      "referenceHash": "0d0498acd9365f1d3fb2141ae7b771ae477f8758d15fb48184464c8899a948b4",
      "candidateHash": "0d0498acd9365f1d3fb2141ae7b771ae477f8758d15fb48184464c8899a948b4"
    }
  ],
  "trajectory": [
    {
      "frameIndex": 0,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 1,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 2,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 3,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 4,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 5,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 6,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 7,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 8,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 9,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 10,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 11,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 12,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 13,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 14,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 15,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 16,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 17,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 18,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 19,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 20,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 21,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 22,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 23,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 24,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 25,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 26,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 27,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 28,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 29,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 30,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 31,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 32,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 33,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 34,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 35,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 36,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 37,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 38,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 39,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 40,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 41,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 42,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 43,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 44,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 45,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 46,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 47,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 48,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 49,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 50,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 51,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 52,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 53,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 54,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 55,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 56,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 57,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 58,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 59,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 60,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 61,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 62,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 63,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 64,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 65,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 66,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 67,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 68,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 69,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 70,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 71,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 72,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 73,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 74,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 75,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 76,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 77,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 78,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 79,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 80,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 81,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 82,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 83,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 84,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 85,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 86,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 87,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 88,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 89,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 90,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 91,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 92,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 93,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 94,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 95,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 96,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 97,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 98,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 99,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 100,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 101,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 102,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 103,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 104,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 105,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 106,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 107,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 108,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 109,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 110,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 111,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 112,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 113,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 114,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 115,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 116,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 117,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 118,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 119,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 120,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 121,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 122,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 123,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 124,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 125,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 126,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 127,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 128,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 129,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 130,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 131,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 132,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 133,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 134,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 135,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 136,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 137,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 138,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 139,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 140,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 141,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 142,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 143,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 144,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 145,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 146,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 147,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 148,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 149,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 150,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 151,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 152,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 153,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 154,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 155,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 156,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 157,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 158,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 159,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 160,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 161,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 162,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 163,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 164,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 165,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 166,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 167,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 168,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 169,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 170,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 171,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 172,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 173,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 174,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 175,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 176,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 177,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 178,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 179,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 180,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 181,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 182,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 183,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 184,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 185,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 186,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 187,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 188,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 189,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 190,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 191,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 192,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 193,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 194,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 195,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 196,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 197,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 198,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 199,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 200,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 201,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 202,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 203,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 204,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 205,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 206,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 207,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 208,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 209,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 210,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 211,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 212,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 213,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 214,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 215,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 216,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 217,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 218,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 219,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 220,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 221,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 222,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 223,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 224,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 225,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 226,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 227,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 228,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 229,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 230,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 231,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 232,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 233,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 234,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 235,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 236,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 237,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 238,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 239,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 240,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 241,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 242,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 243,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 244,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 245,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 246,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 247,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 248,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 249,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 250,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 251,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 252,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 253,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 254,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 255,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 256,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 257,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 258,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 259,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 260,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 261,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 262,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 263,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 264,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 265,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 266,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 267,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 268,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 269,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 270,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 271,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 272,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 273,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 274,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 275,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 276,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 277,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 278,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 279,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 280,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 281,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 282,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 283,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 284,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 285,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 286,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 287,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 288,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 289,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 290,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 291,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 292,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 293,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 294,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 295,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 296,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 297,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 298,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 299,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 300,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 301,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 302,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 303,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 304,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 305,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 306,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 307,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 308,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 309,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 310,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 311,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 312,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 313,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 314,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 315,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 316,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 317,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 318,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 319,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 320,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 321,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 322,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 323,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 324,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 325,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 326,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 327,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 328,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 329,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 330,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 331,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 332,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 333,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 334,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 335,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 336,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 337,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 338,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 339,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 340,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 341,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 342,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 343,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 344,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 345,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 346,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 347,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 348,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 349,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 350,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 351,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 352,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 353,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 354,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 355,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 356,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 357,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 358,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 359,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 360,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 361,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 362,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 363,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 364,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 365,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 366,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 367,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 368,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 369,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 370,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 371,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 372,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 373,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 374,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 375,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 376,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 377,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 378,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 379,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 380,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 381,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 382,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 383,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 384,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 385,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 386,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 387,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 388,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 389,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 390,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 391,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 392,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 393,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 394,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 395,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 396,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 397,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 398,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 399,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 400,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 401,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 402,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 403,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 404,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 405,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 406,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 407,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 408,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 409,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 410,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 411,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 412,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 413,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 414,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 415,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 416,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 417,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 418,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 419,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 420,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 421,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 422,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 423,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 424,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 425,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 426,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 427,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 428,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 429,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 430,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 431,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 432,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 433,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 434,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 435,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 436,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 437,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 438,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 439,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 440,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 441,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 442,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 443,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 444,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 445,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 446,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 447,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 448,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 449,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 450,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 451,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 452,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 453,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 454,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 455,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 456,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 457,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 458,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 459,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 460,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 461,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 462,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 463,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 464,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 465,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 466,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 467,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 468,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 469,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 470,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 471,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 472,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 473,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 474,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 475,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 476,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 477,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 478,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 479,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 480,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 481,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 482,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 483,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 484,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 485,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 486,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 487,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 488,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 489,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 490,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 491,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 492,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 493,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 494,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 495,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 496,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 497,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 498,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 499,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 500,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 501,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 502,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 503,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 504,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 505,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 506,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 507,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 508,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 509,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 510,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 511,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 512,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 513,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 514,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 515,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 516,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 517,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 518,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 519,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 520,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 521,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 522,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 523,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 524,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 525,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 526,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 527,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 528,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 529,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 530,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 531,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 532,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 533,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 534,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 535,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 536,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 537,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 538,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 539,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 540,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 541,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 542,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 543,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 544,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 545,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 546,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 547,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 548,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 549,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 550,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 551,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 552,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 553,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 554,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 555,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 556,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 557,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 558,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 559,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 560,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 561,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 562,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 563,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 564,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 565,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 566,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 567,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 568,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 569,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 570,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 571,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 572,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 573,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 574,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 575,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 576,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 577,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 578,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 579,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 580,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 581,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 582,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 583,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 584,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 585,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 586,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 587,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 588,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 589,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 590,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 591,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 592,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 593,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 594,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 595,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 596,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 597,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 598,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    },
    {
      "frameIndex": 599,
      "referenceHash": "ecd13aeca7a607ce9d768854be278477008d1e2e10f659530c2e4b1179c1b118",
      "lodCounts": [
        1,
        1,
        1998
      ],
      "frustumIntersectingInstances": 2000
    }
  ],
  "measuredFrameIdsMatch": true,
  "correspondingDrawCountsMatch": true
}
```

## Portée du résultat

Il s'agit d'une scène de stress procédurale rendue par le banc du projet. Elle ne représente pas tous les assets et toutes les fonctionnalités possibles. Les dimensions physiques, charge, options et versions ci-dessus définissent la portée de cette campagne. Une répétition à configuration identique et les cas de la matrice documentaire restent nécessaires pour conclure à un gain reproductible.

La tangente partagée conserve l'expression numérique de la référence. La variante de distances carrées reste expérimentale : sa démonstration est conditionnelle aux hypothèses numériques documentées dans variants.ts ; la réussite de cette scène ne certifie pas tous les moteurs JavaScript.

Les données brutes, les compteurs de géométrie et les résultats au format du laboratoire sont conservés dans le JSON associé. Les campagnes précédentes sont archivées dans results/comparisons/. Aucun résultat de ce rapport ne remplace implicitement les conclusions des autres bancs.

Limites enregistrées par le moteur de mesure :

- Single browser/device/configuration; no universal low-end or all-resolution claim.
- Historical 04B radial-size LOD is preserved; this does not certify projected geometric error.
- Frame CPU measures selection, matrix application and render submission, not GPU completion.
- GPU queries measure submitted rendering including shadows, when the extension is available; invalid queries remain null.
- rAF intervals precede current-row work and measure callback cadence, not actual presentation.
- Actual selection arrays are retained for one block and hashed after timing; retention changes GC lifetime equally for A/B.
- Upload byte instrumentation and GPU queries add overhead equally to both paths; there is no uninstrumented control in this run.
- All instances are submitted; frustum intersection and draw counts do not prove every surface is visible through occlusion.
- Only three trajectory images are compared pixel-for-pixel; all measured-frame selection IDs are checked.
