import type { MouseEvent } from 'react';
import { moduleDescription } from '../lab/modulePresentation.ts';
import { MODULE_NAV, moduleTitle } from '../lab/catalog.ts';
import { useLab } from './LabContext.tsx';
import { SelectControl } from './ui/Select.tsx';
import { StatusBadge } from './ui/StatusBadge.tsx';

export function LabNavbar() {
  const { state, actions, model } = useLab();
  const description = model ? 'Modèles complets en exploration libre. La comparaison reste indépendante et bloquée par le contrôle A/A.' : moduleDescription(state.moduleId);
  const goToDashboard = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (state.running) return;
    actions.switchModule('00-baseline');
  };
  return (
    <header className="bg-base-200 border-b border-base-content/10 z-20 shrink-0">
      <div className="navbar bg-base-200 border-b border-base-content/10 h-14 min-h-14 px-4 flex justify-between items-center z-20 shrink-0 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-sm sm:text-base text-base-content whitespace-nowrap">
            <a
              href="/?test=00-baseline"
              aria-disabled={state.running}
              aria-label="Ouvrir le Dashboard render-tech-lab"
              className="text-primary font-mono tracking-normal rounded-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={goToDashboard}
            >
              render-tech-lab
            </a>
            <span className="text-base-content/30">/</span>
            <span id="nav-module-title" className="font-mono text-xs text-base-content/60">
              {moduleTitle(state.moduleId)}
            </span>
          </div>
          <StatusBadge tone="outline" className="border-base-content/20 text-base-content/70 font-mono text-[10px] tracking-wide whitespace-nowrap hidden md:inline-flex">R&amp;D LAB</StatusBadge>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SelectControl
            id="select-module"
            disabled={state.running}
            className="select-xs sm:select-sm font-semibold text-primary bg-base-300 focus:border-primary focus:outline-none"
            value={state.moduleId}
            onChange={event => { if (!state.running) actions.switchModule(event.target.value); }}
          >
            {MODULE_NAV.map(module => (
              <option key={module.id} value={module.id} className={module.id === state.moduleId ? 'active' : undefined}>
                {module.label}
              </option>
            ))}
          </SelectControl>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-base-content/10 min-w-0 w-full overflow-hidden" tabIndex={0} aria-label="Description du banc actif">
        <p id="nav-module-description" title={description} className="block w-full min-w-0 h-5 text-xs leading-5 text-base-content/80 truncate whitespace-nowrap overflow-hidden text-ellipsis">
          {description}
        </p>
      </div>
    </header>
  );
}
