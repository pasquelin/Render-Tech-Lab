import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
  children: ReactNode;
};

export function ChoiceCard({ pressed = false, className = '', children, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`min-w-0 rounded-box border p-2.5 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${pressed ? 'border-primary bg-primary/5' : 'border-base-content/10 bg-base-200'} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
