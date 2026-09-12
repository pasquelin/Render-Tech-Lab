export const LAB_NAVIGATION_EVENT = 'render-tech-lab:navigate';

export function navigateLabRoute(moduleId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('test', moduleId);
  url.searchParams.delete('backend');
  window.history.pushState({}, '', url);
  window.dispatchEvent(new CustomEvent(LAB_NAVIGATION_EVENT, { detail: { moduleId } }));
}

export function navigateFromNativeBench(moduleId: string): void {
  navigateLabRoute(moduleId);
}
