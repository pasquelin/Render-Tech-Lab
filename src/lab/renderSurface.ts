type CssColorResolver = (value: string) => readonly [number, number, number] | null;

export type SurfaceClearColor = {
  source: 'theme' | 'surface';
  themeColor: string;
  computedBackground: string;
  value: number;
  hex: string;
};

/** Converts the host's resolved CSS background into the renderer-neutral 0xRRGGBB contract. */
export function clearColorFromCss(value: string, resolve?: CssColorResolver): number {
  const channels = value.match(/^rgb\(\s*(\d+)[,\s]+\s*(\d+)[,\s]+\s*(\d+)/i);
  const resolved = channels ? channels.slice(1).map(Number) : resolve?.(value);
  if (!resolved) throw new Error(`Couleur de fond de surface non prise en charge : ${value}`);
  const [red, green, blue] = resolved;
  if ([red, green, blue].some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    throw new Error(`Couleur de fond de surface invalide : ${value}`);
  }
  return (red << 16) | (green << 8) | blue;
}

/** A renderer canvas may report its implementation clear; the Lab theme is the presentation authority. */
export function surfaceThemeColor(themeColor: string, computedBackground: string): string {
  return themeColor.trim() || computedBackground;
}

export function resolveSurfaceClearColor(themeColor: string, computedBackground: string, resolve?: CssColorResolver): SurfaceClearColor {
  const source = themeColor.trim() ? 'theme' : 'surface';
  const value = clearColorFromCss(surfaceThemeColor(themeColor, computedBackground), resolve);
  return { source, themeColor, computedBackground, value, hex: `#${value.toString(16).padStart(6, '0')}` };
}

/** Lets the browser resolve all supported CSS color syntaxes, including theme tokens serialized as oklch(). */
export function clearColorFromSurface(surface: HTMLElement): SurfaceClearColor {
  const style = getComputedStyle(surface);
  return resolveSurfaceClearColor(style.getPropertyValue('--color-base-100'), style.backgroundColor, cssColor => {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.fillStyle = cssColor;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return [red, green, blue] as const;
  });
}
