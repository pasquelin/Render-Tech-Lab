export interface ModuleScenario {
  val: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  desc?: string;
  statsClassic?: { objects: string; submit: string; cpuFrame: string; fps: string; drawCalls: string };
  statsGpu?: { objects: string; submit: string; cpuFrame: string; fps: string; drawCalls: string };
  pillsClassic?: { label: string; val: string; desc?: string }[];
  pillsGpu?: { label: string; val: string; desc?: string }[];
  chartA?: number; // CPU / baseline
  chartB?: number; // GPU / prototype
}

export interface ModuleDescriptor {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  badge: string;
  telemetryMode: string;
  telemetryDetail: string;
  description: string;
  technicalPrinciple: string;
  chartTitle?: string;
  chartUnit?: string;
  options: ModuleScenario[];
  benchLabel: string;
  painLabel?: string;
  metricsPills: { label: string; val: string; desc?: string }[];
  stats: {
    objects: string;
    submit: string;
    cpuFrame: string;
    fps: string;
    drawCalls: string;
  };
}
