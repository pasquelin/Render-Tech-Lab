export type RadioBoardOption<T extends string | number> = {
  value: T;
  title: string;
  detail?: string;
};

export function RadioBoard<T extends string | number>({
  id,
  label,
  help,
  value,
  options,
  disabled = false,
  columns = 2,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: T;
  options: readonly RadioBoardOption<T>[];
  disabled?: boolean;
  columns?: 2 | 3 | 4;
  onChange: (value: T) => void;
}) {
  const labelId = `${id}-label`;
  const grid = columns === 4 ? 'grid-cols-1 sm:grid-cols-4' : columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';
  return (
    <div className="space-y-2 min-w-0 w-full">
      <p id={labelId} className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">{label}</p>
      <div
        role="radiogroup"
        id={id}
        aria-labelledby={labelId}
        aria-describedby={help ? `${id}-message` : undefined}
        aria-disabled={disabled || undefined}
        className={`grid gap-2 min-w-0 ${grid}`}
      >
        {options.map(option => {
          const checked = option.value === value;
          const optionId = `${id}-${String(option.value)}`;
          return (
            <label
              key={optionId}
              htmlFor={optionId}
              className={`relative min-w-0 h-16 rounded-box border px-3 py-2 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-2 cursor-pointer transition-colors hover:border-primary/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${checked ? 'border-primary bg-primary/5' : 'border-base-content/10 bg-base-100/40'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                id={optionId}
                type="radio"
                name={id}
                value={String(option.value)}
                checked={checked}
                disabled={disabled}
                aria-label={option.title}
                className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
                onChange={() => onChange(option.value)}
              />
              <span className="min-w-0 truncate text-xs font-medium">{option.title}</span>
              <span className="shrink-0 text-[10px] font-mono text-primary text-right">{checked ? 'Choisi' : ''}</span>
              {option.detail ? <span className="col-span-2 min-w-0 truncate text-[10px] text-base-content/55">{option.detail}</span> : <span className="col-span-2" />}
            </label>
          );
        })}
      </div>
      {help ? <p id={`${id}-message`} className="text-[10px] leading-snug text-base-content/55">{help}</p> : null}
    </div>
  );
}
