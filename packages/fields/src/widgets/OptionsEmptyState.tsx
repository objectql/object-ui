/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { cn } from '@object-ui/components';
import { useFieldTranslation } from './useFieldTranslation.js';
import type { HostGroupProps } from './toHostGroupProps.js';

/**
 * The "this option list cannot be filled" state shared by every fixed-option
 * widget (`SelectField` single, `MultiSelectField`, `RadioField`,
 * `CheckboxesField`) — objectui#3231.
 *
 * ## One producer, one consumer
 *
 * `emptyHint` is a declared prop on `FieldWidgetComponentProps`, computed by
 * the form renderer (`form.tsx`, the `#2284` dependency gate) and forwarded to
 * these widgets. **When the host supplies it, it wins**: the host resolves the
 * controlling fields to their human LABELS ("Select Country first"), where a
 * widget on its own only knows the raw metadata names ("Select country first").
 * Absent a host hint — a standalone widget, the inline grid editor, an action
 * param dialog — the widget falls back to its own copy.
 *
 * Each of the four widgets used to inline this box, destructure `emptyHint`
 * into `_emptyHint` and throw it away, then render a hardcoded English literal.
 * Four independent copies is precisely why they drifted together, so the box
 * AND the copy live here only: adding a fifth option widget cannot re-introduce
 * the gap without deliberately re-implementing it.
 *
 * ## Fallback copy is translated
 *
 * The fallback goes through `useFieldTranslation()` (`fields.options.*`,
 * present in all ten locale packs) rather than an English string literal — the
 * gate sentence is the SAME i18n key the form renderer uses, so the two can
 * never say different things in the same locale.
 */
export interface OptionsEmptyStateProps {
  /**
   * Host-computed hint. Wins over the widget's own copy whenever it is a
   * non-empty string — this is the whole point of the prop.
   */
  emptyHint?: string;
  /** The list is waiting on a `dependsOn` controlling field (vs. unconfigured). */
  gated: boolean;
  /** Controlling field names, used by the fallback gate sentence. */
  dependsOnFields: readonly string[];
  /** Widget-specific stable locator, e.g. `select-empty-${fieldName}`. */
  testId?: string;
  /** Widget-specific sizing (the dropdown is a fixed `h-9`, lists grow). */
  className?: string;
  /**
   * The host label's IDREF plumbing, when this box is the whole rendered surface
   * of a group-labelled field (objectui#3990) — a `checkboxes` / `radio` /
   * `multiselect` whose option list came back empty renders NOTHING but this
   * box, so the visible label named zero elements until it landed here. Its
   * help text described zero elements for the same reason, which is why the
   * callers ask `toHostGroupProps` for the `'instead-of-the-inputs'` surface:
   * there is no option control in this state to announce the description on
   * (objectui#4005).
   *
   * A closed type rather than an open props tail: only `id`, `aria-labelledby`,
   * `aria-describedby` and the `role` that makes them meaningful may reach this
   * element, and reopening a spread is what objectui#3291 exists to prevent —
   * `aria-invalid` / `aria-required` are control-channel state and stay off this
   * surface. Absent for the single `SelectField` — it is not group-labelled, its
   * label still uses a plain `for`, and it must keep emitting no such
   * attributes.
   */
  hostGroupProps?: HostGroupProps;
}

export function OptionsEmptyState({
  emptyHint,
  gated,
  dependsOnFields,
  testId,
  className,
  hostGroupProps,
}: OptionsEmptyStateProps) {
  const { t } = useFieldTranslation();
  // The host's hint when it computed one; otherwise this widget's own copy,
  // translated. Never an English literal — that was the reported defect.
  // The joiner between the controlling-field names is read from the locale
  // pack, not hardcoded (objectui#4026). This site and the form renderer's
  // `gatedHint` are the two callers of the SAME `fields.options.selectFirst`
  // sentence, so a separator baked into either one is enough to make the
  // shared sentence read two ways.
  const hint =
    emptyHint ||
    (gated
      ? t('fields.options.selectFirst', {
          fields: dependsOnFields.join(t('validation.formInvalidJoiner')),
        })
      : t('fields.options.empty'));
  return (
    <div
      {...hostGroupProps}
      data-testid={testId}
      className={cn(
        'flex w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground',
        className,
      )}
    >
      {hint}
    </div>
  );
}
