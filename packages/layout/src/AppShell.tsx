import React, { useEffect } from 'react';
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  Sidebar
} from '@object-ui/components';
import { cn } from '@object-ui/components';

/**
 * Branding configuration for the AppShell.
 * Applies CSS custom properties to the document root for theme customization.
 */
export interface AppShellBranding {
  /** Primary brand color (hex, e.g. "#3B82F6") */
  primaryColor?: string;
  /** Accent brand color (hex, e.g. "#10B981") */
  accentColor?: string;
  /** Favicon URL — replaces the <link rel="icon"> href */
  favicon?: string;
  /** Logo URL — passed to sidebar/navbar via context */
  logo?: string;
  /** Page title suffix (sets document.title) */
  title?: string;
}

export interface AppShellProps {
  sidebar?: React.ReactNode;
  navbar?: React.ReactNode; // Top navbar content
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  /** App branding — applies CSS custom properties for theming */
  branding?: AppShellBranding;
}

/**
 * Convert a hex color (#RRGGBB) to HSL string "H S% L%"
 * for use in Tailwind CSS custom properties.
 */
function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

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

/**
 * Apply branding CSS custom properties to the document root.
 * This is extracted as a standalone hook so it can be re-used independently.
 */
export function useAppShellBranding(branding?: AppShellBranding, title?: string) {
  useEffect(() => {
    const root = document.documentElement;

    // Primary color
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

    // Accent color
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

    // Favicon
    if (branding?.favicon) {
      const link = document.querySelector<HTMLLinkElement>('#favicon')
        || document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        link.href = branding.favicon;
      }
    }

    // Page title
    if (title) {
      document.title = title;
    }

    return () => {
      root.style.removeProperty('--brand-primary');
      root.style.removeProperty('--brand-primary-hsl');
      root.style.removeProperty('--brand-accent');
      root.style.removeProperty('--brand-accent-hsl');
    };
  }, [branding?.primaryColor, branding?.accentColor, branding?.favicon, title]);
}

export function AppShell({
  sidebar,
  navbar,
  children,
  className,
  defaultOpen = true,
  branding,
}: AppShellProps) {
  // Apply branding CSS custom properties
  useAppShellBranding(branding, branding?.title);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {sidebar}
      <SidebarInset>
        <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b bg-background px-2 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="w-px h-4 bg-border mx-1 sm:mx-2" />
          {navbar}
        </header>
        <main className={cn("flex-1 min-w-0 overflow-auto p-3 sm:p-4 md:p-6", className)}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
