import type { ReactNode } from 'react';

export interface DataSourceProviderProps {
  dataSource: any;
  children: ReactNode;
}

export interface MetadataProviderProps {
  metadata?: any;
  children: ReactNode;
}

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeProviderProps {
  defaultTheme?: Theme;
  storageKey?: string;
  children: ReactNode;
}
