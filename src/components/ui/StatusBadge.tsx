import type { HTMLAttributes, ReactNode } from 'react';

const tones = { neutral: 'badge-neutral', success: 'badge-success', warning: 'badge-warning', error: 'badge-error', outline: 'badge-outline' } as const;

type Props = HTMLAttributes<HTMLSpanElement> & { children: ReactNode; tone?: keyof typeof tones };

export function StatusBadge({ children, tone = 'neutral', className = '', ...props }: Props) {
  return <span {...props} className={`badge badge-sm ${tones[tone]} ${className}`}>{children}</span>;
}
