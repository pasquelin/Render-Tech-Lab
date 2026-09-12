import type { ReactNode } from 'react';

const tones = { neutral: 'badge-neutral', success: 'badge-success', warning: 'badge-warning', error: 'badge-error', outline: 'badge-outline' } as const;

export function StatusBadge({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={`badge badge-sm ${tones[tone]} ${className}`}>{children}</span>;
}
