import type { ReactNode } from 'react';
import type { ThemeModeSchema } from '@objectstack/spec/ui';

export interface DataSourceProviderProps {
  dataSource: any;
  children: ReactNode;
}

export interface MetadataProviderProps {
  metadata?: any;
  children: ReactNode;
}

/**
 * The theme MODE this provider stores and applies: the spec's `ThemeMode`
 * vocabulary (`auto | light | dark`) plus the one legacy spelling this package
 * still accepts.
 *
 * Named `ThemePreference`, not `Theme` (objectui#3161, objectstack#4115 ledger
 * batch 7). `@objectstack/spec/ui` owns `Theme` for a whole theme DOCUMENT —
 * `{ name, label, mode, colors: { primary, background, … }, typography, … }` —
 * so the local declaration was not a drifted copy of the spec's `Theme` at all;
 * it was the spec's `Theme['mode']` under the spec's `Theme` name, which is the
 * more misleading of the two failures: a session reading `Theme` here would
 * conclude an ObjectStack theme is a string. The spec's own name for this
 * concept, `ThemeMode`, is exported too, so THAT name could not be taken either
 * (the "run the new name past the guard first" rule from objectui#3169 — it
 * would have traded one collision for another); and it would be wrong anyway,
 * because of `'system'`.
 *
 * The three real modes are now the spec enum rather than a hand copy of it, so
 * a mode the spec adds arrives here and `ThemeProvider`'s branch must handle
 * it. `'system'` stays as an explicit local union member: it is the pre-spec
 * spelling of `auto`, still sitting in users' `localStorage`, and the provider
 * treats the two identically (#2942, pinned in `theme-mode-spec-parity`).
 * Reached through the schema's `_zod` carrier so this package takes no zod
 * dependency — same technique as `packages/react/src/spec-input.ts`.
 */
export type ThemePreference = (typeof ThemeModeSchema)['_zod']['input'] | 'system';

export interface ThemeProviderProps {
  defaultTheme?: ThemePreference;
  storageKey?: string;
  children: ReactNode;
}
