import { forwardRef, type SelectHTMLAttributes } from 'react';
import { Field } from './Field.tsx';

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label: string; help?: string; error?: string };

export const selectControlClass = 'select select-bordered bg-base-100';

export const SelectControl = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function SelectControl({ className = '', ...props }, ref) {
  return <select ref={ref} {...props} className={`${selectControlClass} ${className}`} />;
});

export const Select = forwardRef<HTMLSelectElement, Props>(function Select({ id, label, help, error, className = 'select-sm w-full max-w-full min-w-0', children, ...props }, ref) {
  const controlId = id ?? `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <Field id={controlId} label={label} help={help} error={error}>
      <SelectControl ref={ref} id={controlId} className={className} aria-describedby={help || error ? `${controlId}-message` : undefined} {...props}>
        {children}
      </SelectControl>
    </Field>
  );
});
