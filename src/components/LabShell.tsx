import type { RefObject } from 'react';
import { LabNavbar } from './LabNavbar.tsx';
import { LabSidebar } from './LabSidebar.tsx';
import { LabViewport } from './LabViewport.tsx';
import { ReportModal } from './ReportModal.tsx';

type LabShellProps = {
  webglRef: RefObject<HTMLCanvasElement | null>;
  webgpuRef: RefObject<HTMLCanvasElement | null>;
  chartRef: RefObject<HTMLCanvasElement | null>;
};

export function LabShell({ webglRef, webgpuRef, chartRef }: LabShellProps) {
  return (
    <div className="h-full w-full min-h-0 overflow-hidden">
      <div className="grid h-full w-full min-h-0 overflow-hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div data-lab-main="true" className="min-w-0 min-h-0 flex flex-col overflow-hidden">
          <LabNavbar />
          <LabViewport webglRef={webglRef} webgpuRef={webgpuRef} />
        </div>
        <LabSidebar chartRef={chartRef} />
      </div>
      <ReportModal />
    </div>
  );
}
