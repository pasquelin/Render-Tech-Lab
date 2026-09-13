/** The modal always reads its content from the archived Markdown source of truth. */
export const REPORT_PREVIEW_BYTES = 1_048_576;
export const PROGRESSIVE_REPORT_FEEDBACK = 'Aperçu progressif : le fichier Markdown complet reste disponible dans Finder.';

type ReportResponse = {
  ok: boolean;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
};

type ReportFetcher = (url: string) => Promise<ReportResponse>;
type ReportAvailabilityFetcher = (url: string, init: RequestInit) => Promise<{ ok: boolean; headers: { get: (name: string) => string | null } }>;

export function markdownReportUrl(testId: string): string {
  return `/api/get-report?testId=${encodeURIComponent(testId)}&previewBytes=${REPORT_PREVIEW_BYTES}`;
}

export async function loadMarkdownReport(fetcher: ReportFetcher, testId: string): Promise<{ ok: boolean; raw: string; feedback: string }> {
  const response = await fetcher(markdownReportUrl(testId));
  const raw = await response.text();
  return {
    ok: response.ok,
    raw,
    feedback: response.headers.get('x-report-truncated') === 'true' ? PROGRESSIVE_REPORT_FEEDBACK : '',
  };
}

/** A report area is useful only when the current package pointer resolves to Markdown. */
export async function hasMarkdownReport(fetcher: ReportAvailabilityFetcher, testId: string, attempts = 1, retryDelayMs = 0): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetcher(markdownReportUrl(testId), { method: 'HEAD' });
      if (response.ok && response.headers.get('x-report-available') === 'true') return true;
    } catch { /* A missing or temporarily unavailable package remains unavailable. */ }
    if (attempt + 1 < attempts && retryDelayMs > 0) await new Promise<void>(resolve => setTimeout(resolve, retryDelayMs));
  }
  return false;
}
