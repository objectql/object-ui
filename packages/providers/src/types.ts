import type { ReactNode } from 'react';

export interface DataSourceProviderProps {
  dataSource: any;
  children: ReactNode;
}

export interface MetadataProviderProps {
  metadata?: any;
  children: ReactNode;
}

// `auto` is the spec's OS-following mode (ThemeModeSchema); `system` is the
// pre-spec spelling, kept accepted for stored preferences.
export type Theme = 'light' | 'dark' | 'auto' | 'system';

export interface ThemeProviderProps {
  defaultTheme?: Theme;
  storageKey?: string;
  children: ReactNode;
}
