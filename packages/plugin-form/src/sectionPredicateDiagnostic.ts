/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The layout arms that DROP an authored `FormSection.visibleWhen` (objectui#6237).
 *
 * Of the five layout routes in `ObjectForm`, three rebuild each section key by key
 * and DO copy the predicate (`split` / `drawer` / `modal`), and the flat arm carries
 * it on the `section-divider` pseudo-field — those four honour it. `tabbed`
 * (`TabbedForm`) and `wizard` (`WizardForm`) rebuild the section the same way but
 * copy no predicate, so an authored key never reaches a renderer at all.
 *
 * Making those two arms actually honour it is a DESIGN task, ruled 2026-08-29
 * (option A): ONE renderer-side section/group contract with a predicate slot,
 * designed once for every layout arm rather than patched arm by arm. Ruled as part
 * of that option, this diagnostic lands FIRST so the gap stops being silent — an
 * author who writes the key on one of these arms is told it is not yet supported
 * here instead of watching it do nothing.
 *
 * Single-sourced so both inert arms report the gap in one voice, and so a test can
 * pin the wording without restating it.
 */
export function sectionPredicateUnsupportedWarning(
  layout: 'tabbed' | 'wizard',
  sectionNames: string,
): string {
  const surface = layout === 'tabbed'
    ? "the `tabbed` layout's tabs"
    : "the `wizard` layout's steps";
  return '[ObjectForm] Section `visibleWhen` is not yet supported on this layout: '
    + `${surface} drop the predicate, so section(s) ${sectionNames} render `
    + 'unconditionally. Support is being designed as ONE grouping contract across '
    + 'every layout arm (objectui#6237); until it lands, use '
    + "`formType: 'modal' | 'drawer' | 'split'` or the flat layout — each honours a "
    + 'section `visibleWhen` — or move the predicate onto the individual fields, '
    + 'whose own `visibleWhen` is evaluated on every layout.';
}

/*
 * Lives in its own module rather than in `ObjectForm.tsx`: exporting a
 * non-component from a component file costs that file Fast Refresh
 * (`react-refresh/only-export-components`), and `ObjectForm` is edited often
 * enough for that to be a real tax. Deliberately NOT re-exported from the
 * package barrel — this is an internal diagnostic, not published surface.
 */
