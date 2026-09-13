import { useEffect, useRef } from 'react';
import { Copy, FileText, Folder, RefreshCw, X } from 'lucide-react';
import { useLab } from './LabContext.tsx';
import { Button } from './ui/Button.tsx';
import { MarkdownReport } from './ui/MarkdownReport.tsx';

const plain = (value: string) => value.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export function ReportModal() {
  const { state, actions } = useLab();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const { reportModal } = state;
  const packagePath = /<!--\s*report-package:([^>\s]+)\s*-->/.exec(reportModal.raw)?.[1];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (reportModal.open && !dialog.open) { previousFocus.current = document.activeElement as HTMLElement | null; dialog.showModal(); }
    if (!reportModal.open && dialog.open) { dialog.close(); previousFocus.current?.focus(); }
  }, [reportModal.open]);

  return (
    <dialog id="report-modal" ref={dialogRef} className="modal modal-bottom sm:modal-middle backdrop-blur-sm" onClose={actions.closeReport}>
      <div className="modal-box max-w-4xl bg-base-200 border border-base-content/15 p-0 max-h-[85vh] flex flex-col shadow-2xl rounded-box">
        <div className="flex justify-between items-center px-5 py-3.5 bg-base-300 border-b border-base-content/10">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <div id="modal-report-title" className="font-bold text-sm text-base-content">{reportModal.title}</div>
              <div id="modal-report-path" className="text-[10px] font-mono text-base-content/50">{reportModal.path}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button id="btn-copy-report" size="xs" variant="secondary" className="font-mono gap-1" onClick={actions.copyReport}>
              <Copy className="w-3 h-3" /> Copier Markdown
            </Button>
            <Button id="btn-refresh-report" size="xs" variant="secondary" className="font-mono gap-1" onClick={actions.refreshReport}>
              <RefreshCw className="w-3 h-3" /> Recharger
            </Button>
            <form method="dialog">
              <Button id="btn-close-modal" size="xs" variant="ghost" className="btn-circle" aria-label="Fermer le rapport" onClick={actions.closeReport}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>

        <div id="modal-report-body" className="p-6 overflow-y-auto flex-1 space-y-4 text-xs sm:text-sm font-sans text-base-content/90 leading-relaxed bg-base-100">
          {reportModal.raw ? <MarkdownReport source={reportModal.raw} basePath={packagePath} /> : <p>{plain(reportModal.html) || 'Chargement du rapport…'}</p>}
        </div>

        <div className="flex items-center justify-between px-5 py-3 bg-base-300 border-t border-base-content/10">
          <div id="modal-feedback" className="text-xs font-mono text-primary font-medium">{reportModal.feedback}</div>
          <div className="flex gap-2">
            <Button id="btn-modal-open-finder" size="xs" variant="secondary" className="font-mono gap-1" onClick={actions.openFinder}>
              <Folder className="w-3 h-3" /> Révéler dans Finder
            </Button>
            <form method="dialog">
              <Button id="btn-modal-close" size="xs" onClick={actions.closeReport}>Fermer</Button>
            </form>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <Button variant="ghost">close</Button>
      </form>
    </dialog>
  );
}
