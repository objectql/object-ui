/**
 * useBranding Hook
 *
 * Applies CSS custom properties derived from the active app's branding configuration.
 * This enables the entire UI theme to adapt per-app (e.g., different primary colors).
 *
 * Supported branding properties:
 * - primaryColor: Hex color → applied as --brand-primary and HSL override for --primary
 * - favicon: URL → applied to the <link rel="icon"> element
 * - logo: URL → consumed by AppSidebar for the app icon
 */

import { useEffect, useRef } from 'react';

interface AppBranding {
  primaryColor?: string;
  accentColor?: string;
  favicon?: string;
  logo?: string;
}

/**
 * Convert a hex color (#RRGGBB) to HSL values string "H S% L%"
 * for use in Tailwind CSS custom properties.
 */
function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useBranding(app: { branding?: AppBranding; label?: string } | undefined) {
  const prevAppName = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!app) return;

    const root = document.documentElement;
    const branding = app.branding;

    // Apply primaryColor as CSS custom properties
    if (branding?.primaryColor) {
      const hsl = hexToHSL(branding.primaryColor);
      if (hsl) {
        root.style.setProperty('--brand-primary', branding.primaryColor);
        root.style.setProperty('--brand-primary-hsl', hsl);
      }
    } else {
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-primary-hsl');
    }

    // Apply accent color
    if (branding?.accentColor) {
      const hsl = hexToHSL(branding.accentColor);
      if (hsl) {
        root.style.setProperty('--brand-accent', branding.accentColor);
        root.style.setProperty('--brand-accent-hsl', hsl);
      }
    } else {
      root.style.removeProperty('--brand-accent');
      root.style.removeProperty('--brand-accent-hsl');
    }

    // Apply favicon
    if (branding?.favicon) {
      const link = document.querySelector<HTMLLinkElement>('#favicon') 
        || document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        link.href = branding.favicon;
      }
    }

    // Update page title
    if (app.label) {
      document.title = `${app.label} — ObjectStack Console`;
    }

    prevAppName.current = app.label;

    // Cleanup on unmount
    return () => {
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-primary-hsl');
      root.style.removeProperty('--brand-accent');
      root.style.removeProperty('--brand-accent-hsl');
    };
  }, [app?.branding?.primaryColor, app?.branding?.accentColor, app?.branding?.favicon, app?.label]);
}
