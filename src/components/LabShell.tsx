import type { ReactNode, RefObject } from 'react';
import { LabNavbar } from './LabNavbar.tsx';
import { LabSidebar, LabSidebarLayout } from './LabSidebar.tsx';
import { LabViewport } from './LabViewport.tsx';
import { ReportModal } from './ReportModal.tsx';

type LabShellProps = {
  webglRef: RefObject<HTMLCanvasElement | null>;
  webgpuRef: RefObject<HTMLCanvasElement | null>;
  chartRef: RefObject<HTMLCanvasElement | null>;
  viewport?: ReactNode;
  sidebar?: ReactNode;
};

export function LabShell({ webglRef, webgpuRef, chartRef, viewport, sidebar }: LabShellProps) {
  return (
    <div className="h-full w-full min-h-0 overflow-hidden">
      <div className="grid h-full w-full min-h-0 overflow-hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div data-lab-main="true" className="min-w-0 min-h-0 flex flex-col overflow-hidden">
          <LabNavbar />
          {viewport ?? <LabViewport webglRef={webglRef} webgpuRef={webgpuRef} />}
        </div>
        {sidebar === undefined ? <LabSidebar chartRef={chartRef} /> : <LabSidebarLayout>{sidebar}</LabSidebarLayout>}
      </div>
      <ReportModal />
    </div>
  );
}
