import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'xs' | 'sm' | 'md';
const variants = { primary: 'btn-lab-primary', secondary: 'btn-lab-secondary', danger: 'btn-lab-danger', ghost: 'btn-ghost', outline: 'btn-outline' };

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  href?: string;
  htmlFor?: string;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({
  variant = 'primary', size = 'sm', loading = false, className = '', children, disabled, href, htmlFor, id, ...props
}, ref) {
  const classes = `btn btn-${size} ${variants[variant]} ${className}`;
  if (htmlFor) return <label htmlFor={htmlFor} className={classes} aria-label={props['aria-label']}>{children}</label>;
  if (href !== undefined) {
    return (
      <a id={id} href={disabled ? undefined : href} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={classes} onClick={event => { if (disabled) event.preventDefault(); }}>
        {children}
      </a>
    );
  }
  return (
    <button ref={ref} id={id} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} {...props}>
      {loading ? <span className="loading loading-spinner loading-xs" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
