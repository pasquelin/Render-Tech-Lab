/** Lock legacy controls added outside React while preserving their idle attributes. */
export function createControlLock(root: HTMLElement): (locked: boolean) => void {
  let restore: (() => void)[] = [];
  let locked = false;
  const captured = new Set<Element>();
  const isStop = (node: Element) => node.id === 'btn-pain-benchmark' || node.id === 'btn-stop-campaign';
  const guard = (event: Event) => {
    if (!locked || !(event.target instanceof Element)) return;
    const control = event.target.closest('a, button, input, select');
    if (control && !isStop(control)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  root.addEventListener('click', guard, true);
  root.addEventListener('change', guard, true);
  const captureControls = () => {
    for (const control of root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button, input, select')) {
      if (isStop(control) || captured.has(control)) continue;
      captured.add(control);
      const disabled = control.disabled;
      restore.push(() => { control.disabled = disabled; });
      control.disabled = true;
    }
    for (const link of root.querySelectorAll<HTMLAnchorElement>('a')) {
      if (captured.has(link)) continue;
      captured.add(link);
      const href = link.getAttribute('href'), tabIndex = link.getAttribute('tabindex'), aria = link.getAttribute('aria-disabled');
      restore.push(() => {
        for (const [name, value] of [['href', href], ['tabindex', tabIndex], ['aria-disabled', aria]]) {
          if (value === null) link.removeAttribute(name!); else link.setAttribute(name!, value!);
        }
      });
      link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); link.tabIndex = -1;
    }
  };
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => { if (locked) captureControls(); });
  return value => {
    if (value === locked) return;
    locked = value;
    if (!value) {
      observer?.disconnect();
      for (const reset of restore) reset();
      restore = []; captured.clear(); return;
    }
    captureControls(); observer?.observe(root, { childList: true, subtree: true });
  };
}
