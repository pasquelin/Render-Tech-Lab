export type BenchmarkModel = Readonly<{
  id: string;
  label: string;
  sourceDirectory: string;
  derivedDirectory: string;
  runtimeFile: string;
}>;

export const benchmarkModels: readonly BenchmarkModel[] = [
  { id: 'bistro-exterior', label: 'Bistro Exterior', sourceDirectory: 'public/benchmark-assets/bistro', derivedDirectory: 'public/benchmark-assets/bistro-exterior-derived', runtimeFile: 'bistro-exterior.glb' },
  { id: 'low-poly-city', label: 'Low Poly City', sourceDirectory: 'public/benchmark-assets/low-poly-city', derivedDirectory: 'public/benchmark-assets/low-poly-city-derived', runtimeFile: 'low-poly-city.glb' },
  { id: 'accucities-london', label: 'AccuCities London', sourceDirectory: 'public/benchmark-assets/accucities-london', derivedDirectory: 'public/benchmark-assets/accucities-london-derived', runtimeFile: 'accucities-london.glb' },
  { id: 'drive-for-speed-map', label: 'Drive for Speed Map', sourceDirectory: 'public/benchmark-assets/drive-for-speed-map', derivedDirectory: 'public/benchmark-assets/drive-for-speed-map-derived', runtimeFile: 'drive-for-speed-map.glb' },
  { id: 'new-york', label: 'New York', sourceDirectory: 'public/benchmark-assets/new-york', derivedDirectory: 'public/benchmark-assets/new-york-derived', runtimeFile: 'new-york.glb' },
  { id: 'new-york-manhattan', label: 'New York Manhattan', sourceDirectory: 'public/benchmark-assets/new-york-manhattan', derivedDirectory: 'public/benchmark-assets/new-york-manhattan-derived', runtimeFile: 'new-york-manhattan.glb' },
  { id: 'skibidi-toilet-77-map', label: 'Episode 77 Map', sourceDirectory: 'public/benchmark-assets/skibidi-toilet-77-map', derivedDirectory: 'public/benchmark-assets/skibidi-toilet-77-map-derived', runtimeFile: 'scene.gltf' },
];

export function modelById(id: string): BenchmarkModel | undefined {
  return benchmarkModels.find(model => model.id === id);
}
