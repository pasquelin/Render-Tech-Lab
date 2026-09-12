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
    <div className="drawer drawer-end lg:drawer-open h-full w-full overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <input id="sidebar-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content min-w-0 min-h-0 flex flex-col h-full overflow-hidden p-0">
        <LabNavbar />
        <LabViewport webglRef={webglRef} webgpuRef={webgpuRef} />
      </div>
      <LabSidebar chartRef={chartRef} />
      <ReportModal />
    </div>
  );
}
