import { useEffect, useState } from 'react';
import { hasMarkdownReport } from '../lab/reportReader.ts';

export function useReportAvailability(testId: string, refreshKey: string, enabled: boolean) {
  const [report, setReport] = useState({ testId, refreshKey, available: false });
  useEffect(() => {
    let cancelled = false;
    setReport({ testId, refreshKey, available: false });
    if (enabled) void hasMarkdownReport(fetch, testId, 12, 300).then(found => {
      if (!cancelled) setReport({ testId, refreshKey, available: found });
    });
    return () => { cancelled = true; };
  }, [testId, refreshKey, enabled]);
  return enabled && report.testId === testId && report.refreshKey === refreshKey && report.available;
}
