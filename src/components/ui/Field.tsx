import type { ReactNode } from 'react'

const messageClass = 'fieldset-label !block w-full min-w-0 !whitespace-normal leading-snug text-[10px]';

export function Field({id, label, help, error, children}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode
}) {
  return (
    <fieldset className="fieldset p-0 gap-1 min-w-0 w-full">
      <label className="label py-0" htmlFor={id}>
        <span className="label-text text-[11px] font-medium text-base-content/60">{label}</span>
      </label>
      {children}
      {error ? <div id={`${id}-message`} className={`${messageClass} text-error`} role="alert">{error}</div> : help ? <div id={`${id}-message`} className={`${messageClass} text-base-content/55`}>{help}</div> : null}
    </fieldset>
  );
}
