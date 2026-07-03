/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Field-group helpers for ObjectForm.
 *
 * An object's metadata declares top-level `fieldGroups`, and individual
 * fields opt into a group via `field.group === group.key`. The grouping
 * SEMANTICS (declared order, empty groups dropped, trailing untitled bucket,
 * collapse behaviour incl. legacy alias handling) are single-sourced in
 * `@objectstack/spec` (`deriveFieldGroupLayout`, ADR-0085 §5) — this module
 * is only the adapter from that shared derivation onto the form renderer's
 * `ObjectFormSection` shape and its permission-filtered `FormField` list.
 */

import { deriveFieldGroupLayout } from '@objectstack/spec/data';
import type { FormField, ObjectFormSection } from '@object-ui/types';

/**
 * Derive form sections from an object's declared `fieldGroups` and each
 * rendered field's `group`.
 *
 * Returns `null` when grouping does not apply — no declared groups, or no
 * rendered field opts into a declared group — so callers fall back to a flat
 * form.
 *
 * The derivation runs against the RENDERED field list (post permission /
 * visibility filtering), not the raw object def, so a section never names a
 * field the form isn't showing. Any rendered field the shared derivation
 * excludes from its default buckets (audit/system fields) is re-appended to
 * the trailing bucket: the form was already told to render it, and a layout
 * helper silently dropping a rendered input is exactly the failure mode
 * ADR-0085 exists to kill.
 *
 * Section `fields` are field *names* (strings) so the result plugs straight
 * into ObjectForm's existing section-render path.
 */
export function deriveFieldGroupSections(
  fields: FormField[],
  fieldGroups: unknown,
): ObjectFormSection[] | null {
  const derived = deriveFieldGroupLayout({
    fieldGroups,
    // Pseudo-def over the rendered fields: membership is the only input the
    // derivation needs per field.
    fields: Object.fromEntries(
      fields.map((f) => [f.name, { group: (f as { group?: unknown }).group }]),
    ),
  });
  if (!derived) return null;

  const placed = new Set(derived.flatMap((s) => s.fields));
  const leftover = fields.map((f) => f.name).filter((n) => !placed.has(n));

  const sections: ObjectFormSection[] = derived.map((s) => ({
    ...(s.key !== undefined ? { name: s.key } : {}),
    ...(s.key !== undefined ? { label: s.label ?? s.key } : {}),
    fields: [...s.fields],
    // Map the shared `collapse` enum onto the renderer's boolean pair.
    ...(s.collapse !== 'none' ? { collapsible: true } : {}),
    ...(s.collapse === 'collapsed' ? { collapsed: true } : {}),
  }));

  if (leftover.length > 0) {
    const trailing = sections[sections.length - 1];
    if (trailing && trailing.name === undefined) {
      trailing.fields = [...(trailing.fields ?? []), ...leftover];
    } else {
      sections.push({ fields: leftover });
    }
  }

  return sections;
}
