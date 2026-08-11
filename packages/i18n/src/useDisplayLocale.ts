/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useLocalization } from './LocalizationContext';
import { useObjectTranslation } from './provider';

/**
 * `useDisplayLocale` — the BCP-47 tag that field / cell / metric renderers
 * format numbers and other `Intl` values with.
 *
 * This composes the two locale channels this repo already has; it does not add
 * a third. The precedence, highest first:
 *
 *  1. **`useLocalization().locale`** — the tenant's resolved regional default
 *     (ADR-0053, served by `GET /api/v1/auth/me/localization`). An org that has
 *     explicitly configured a display locale means it, so it outranks the UI
 *     language, and this keeps numbers agreeing with `DateCellRenderer`, which
 *     already formats from this channel. Frequently `undefined`: the endpoint is
 *     cosmetic and non-blocking, so an unconfigured or still-loading tenant
 *     simply has no answer here (the state objectui#4033 was measured in — a
 *     fresh database, console running `zh-CN`).
 *
 *  2. **`useObjectTranslation().language`** — the ACTIVE UI language, i.e. what
 *     the user picked in the language switcher. This is the channel that makes
 *     grouping and decimal marks follow the user's language when the tenant has
 *     stated no regional preference.
 *
 *  3. **`'en'`** — a concrete last resort rather than `undefined`. `undefined`
 *     would hand `Intl` the *machine's* locale, which is invisible in review and
 *     non-deterministic in CI; `'en'` at least fails the same way everywhere.
 *     Note this is `'en'`, not `'en-US'`: the point of objectui#4033 is that
 *     `en-US` is not the world's default. In practice step 2 already answers,
 *     since `useObjectTranslation` falls back to the react-i18next global
 *     instance and ultimately reports `'en'` itself.
 *
 * Provider-safe at every step: `useLocalization` returns `{}` outside its
 * provider and `useObjectTranslation` reads an optional context, so a renderer
 * mounted standalone (tests, docs demos) degrades instead of throwing.
 */
export function useDisplayLocale(): string {
  const { locale } = useLocalization();
  const { language } = useObjectTranslation();
  return locale || language || 'en';
}
