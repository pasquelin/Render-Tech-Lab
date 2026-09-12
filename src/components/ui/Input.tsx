import { forwardRef, type InputHTMLAttributes } from 'react';
import { Field } from './Field.tsx';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string };

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ id, label, help, error, className = '', type = 'text', ...props }, ref) {
  const controlId = id ?? `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const checkbox = type === 'checkbox';
  return (
    <Field id={controlId} label={label} help={help} error={error}>
      <input
        ref={ref}
        id={controlId}
        type={type}
        className={checkbox ? `checkbox checkbox-primary ${className}` : `input input-bordered input-sm w-full max-w-full min-w-0 bg-base-100 ${className}`}
        {...props}
      />
    </Field>
  );
});
