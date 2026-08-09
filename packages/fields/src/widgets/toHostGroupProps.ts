/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { toDomProps } from './toDomProps';

/**
 * The props that make a group-labelled widget's rendered surface the thing its
 * host label actually NAMES, on the surfaces that are not controls
 * (objectui#3990).
 *
 * ## What it is for
 *
 * A widget declared `labelling: 'group'` (objectui#3961) is told by the form
 * renderer: your label publishes an `id` and drops its `for`, so name yourself
 * by IDREF. The renderer hands down exactly two facts that address the field as
 * a WHOLE:
 *
 *  - `id` — the host's control id (`…-form-item`), the id the label's `for`
 *    used to point at;
 *  - `aria-labelledby` — the IDREF of that visible label.
 *
 * Every editable branch already consumes them inside its wider `toDomProps`
 * spread. The branches that returned EARLY did not — a field-level
 * `readonly: true`, or an option list with zero offered options — so the label
 * published an id that no element in the document referenced. Measured on
 * `origin/main`, one field per row, reading the host label against the DOM:
 *
 * ```
 * multiselect  readonly+value   consumers=0  byLabelText=0  namedByRole=[]
 * multiselect  readonly+empty   consumers=0  byLabelText=0  namedByRole=[]
 * multiselect  zeroOptions      consumers=0  byLabelText=0  namedByRole=[]
 * multiselect  editable         consumers=1  byLabelText=1  namedByRole=[group:1]
 * ```
 *
 * All seven group-labelled types measured the same, in every readonly state.
 * This is quieter than the dangling `for` #3961 replaced: a `for` that resolves
 * to nothing can at least be swept for, while "a label published an id and
 * nobody consumed it" looks like healthy markup.
 *
 * ## Why this narrow pair, and not the whole `toDomProps` result
 *
 * Everything else in the DOM pass-through addresses a CONTROL, and a readonly
 * display has none: `aria-describedby` / `aria-required` are announced when
 * focus lands on something focusable, `disabled` / `tabIndex` / the focus
 * handlers only mean something on an interactive element, and `name` is
 * DOM-legal on form controls only — on a `div` it is exactly the leak
 * objectui#3291 sweeps for. Spreading the full result would also put the host's
 * `className` on top of the widget's own, because the widgets whose readonly
 * surface is a placeholder or a plain container (`EmptyValue`, `FileField`,
 * `AddressField`) keep `className` inside `props`.
 *
 * ## Why `role` travels with the two keys
 *
 * `aria-labelledby` on a role-less `div` / `span` names NOTHING — `generic`
 * prohibits an author name — so the pair is inert without a role that supports
 * naming. `group` is the one that fits a readonly surface: it names a set of
 * values (chips, checked labels, stars, file names, a formatted address)
 * without promising the interactivity `textbox` or `radiogroup` would. It is
 * deliberately NOT the role the same widget answers with while editable:
 * `RadioField`'s readonly branch renders the chosen label as text with no radios
 * left in it, and `FileField`'s renders file names with no dropzone button.
 *
 * The role is emitted ONLY when a host actually named the field, mirroring
 * every editable branch's `isLabelledGroup` test: standalone rendering (the
 * grid's inline cell editor, a bare SDUI node) hands down neither key, so every
 * value here is `undefined`, React emits no attribute, and that markup stays
 * byte-identical to what it was.
 */
export interface HostGroupProps {
  /** The host's control id — the id its label would have pointed `for` at. */
  id?: string;
  /** IDREF of the host's visible label. */
  'aria-labelledby'?: string;
  /** `'group'` when — and only when — a host named this surface. */
  role?: 'group';
}

/**
 * Read the two whole-field keys out of a widget's leftover props, plus the role
 * that makes them mean something. See {@link HostGroupProps}.
 *
 * Routed through {@link toDomProps} rather than reading `props` directly so the
 * pair keeps ONE gate: those keys reach an element only if the DOM pass-through
 * whitelist still forwards them, and its two compile-time assertions bind that
 * whitelist to the props contract in both directions.
 */
export function toHostGroupProps(props: {
  id?: string;
  'aria-labelledby'?: string;
}): HostGroupProps {
  const { id, 'aria-labelledby': labelledBy } = toDomProps(props);
  return {
    id,
    'aria-labelledby': labelledBy,
    ...(labelledBy != null ? { role: 'group' as const } : null),
  };
}
