/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6318 — the seven catalog entries this card moved out of
 * `objectui check`'s "carries a registered ObjectUI component type but did not
 * validate" bucket stay out of it.
 *
 * ## Why a pin at all
 *
 * The bucket is reported by a COUNT and a file list on stdout. Nothing fails
 * when a file rejoins it: `objectui check` exits 0 whether the list is empty or
 * 53 entries long (`packages/cli/src/commands/check.ts` increments `errors`
 * only on a parse failure). So a corpus repair that is not pinned is a repair
 * that regresses silently — which is how the two shapes below got here.
 *
 * ## The two shapes are NOT the same repair, and must not be pinned alike
 *
 *  1. **The validator was short four files** (`code-editor` ×3, `bar-chart`).
 *     Both types RENDER — `@object-ui/plugin-editor` and
 *     `@object-ui/plugin-charts` register them — and `AnyComponentSchema`
 *     modelled neither, so every document naming them failed
 *     `safeValidateSchema` no matter what it said. The fix was in
 *     `@object-ui/types`; the fixtures were never wrong and are UNCHANGED by
 *     this card. Their assertion is therefore about the union, and it is paired
 *     with a counter-probe below: a mirror that accepted everything would
 *     satisfy `.success` while declaring nothing.
 *
 *  2. **Three fixtures were wrong** — measured against what their own renderer
 *     reads, and confirmed the way objectui#6318's triage asks: the corrected
 *     file must RENDER DIFFERENTLY, because a "correction" that changes no
 *     pixel is evidence the schema was at fault instead. All three changed:
 *     the select grew a third option in its list, the button group's three
 *     buttons went from blank to labelled, and the tab panel began painting its
 *     content. Each pin below names the KEY that moved, not just `.success` —
 *     `.success` alone would go green again if a later sweep deleted the key
 *     and the enclosing object with it.
 *
 * ⛔ This file deliberately does NOT pin the size of the remaining bucket. The
 * 28 entries still in it are open findings on the Zod union (`tooltip` and
 * `context-menu` demand a `children` their renderers never read; `tree-view`
 * demands `data` where the renderer reads `nodes` first; and so on), and a
 * number pinned here would turn red on the card that repairs any one of them.
 */
import { describe, it, expect } from 'vitest';
import { safeValidateSchema } from '@object-ui/types/zod';

import javascriptEditor from '../src/schemas/plugin-editor/javascript-editor.json' with { type: 'json' };
import pythonEditor from '../src/schemas/plugin-editor/python-editor.json' with { type: 'json' };
import readOnlyJsonViewer from '../src/schemas/plugin-editor/read-only-json-viewer.json' with { type: 'json' };
import simpleBarChart from '../src/schemas/plugin-charts/simple-bar-chart.json' with { type: 'json' };
import basicSelect from '../src/schemas/components-form-select/basic-select.json' with { type: 'json' };
import basicTabs from '../src/schemas/components-layout-tabs/basic-tabs.json' with { type: 'json' };
import iconToolbar from '../src/schemas/components-basic-button-group/icon-toolbar.json' with { type: 'json' };

/** Report the first issue rather than `false`, so a red run says what broke. */
function reasons(schema: unknown): string[] {
  const r = safeValidateSchema(schema);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('objectui#6318 — the union now models the two plugin types it rendered but could not validate', () => {
  it.each([
    ['plugin-editor/javascript-editor', javascriptEditor],
    ['plugin-editor/python-editor', pythonEditor],
    ['plugin-editor/read-only-json-viewer', readOnlyJsonViewer],
    ['plugin-charts/simple-bar-chart', simpleBarChart],
  ])('%s validates unchanged', (_id, fixture) => {
    expect(reasons(fixture)).toEqual([]);
  });

  it('the members are real declarations, not passthrough holes', () => {
    // Counter-probes. Every key probed is one the mirror DECLARES — an unknown
    // key proves nothing here, because `BaseSchema` is `.passthrough()`.
    expect(safeValidateSchema({ type: 'code-editor', theme: 'solarized' }).success).toBe(false);
    expect(safeValidateSchema({ type: 'code-editor', height: 300 }).success).toBe(false);
    expect(safeValidateSchema({ type: 'bar-chart', height: '300px' }).success).toBe(false);
    expect(safeValidateSchema({ type: 'bar-chart', dataKey: 5 }).success).toBe(false);
    // …and the good shapes still pass, so the four above are not failing for
    // some unrelated reason.
    expect(safeValidateSchema({ type: 'code-editor', theme: 'light', height: '300px' }).success).toBe(true);
    expect(safeValidateSchema({ type: 'bar-chart', height: 300, dataKey: 'value' }).success).toBe(true);
  });
});

describe('objectui#6318 — three fixtures were wrong about what their renderer reads', () => {
  it('basic-select: the third option carries `label`, which is the only child SelectItem renders', () => {
    expect(reasons(basicSelect)).toEqual([]);
    // `select.tsx` renders `{opt.label}` and nothing else, so an option without
    // it is a blank row in the open list — measured before the repair.
    const options = (basicSelect as { options: Array<Record<string, unknown>> }).options;
    expect(options.map((o) => o.label)).toEqual(['Option 1', 'Option 2', 'Option 3']);
    expect(options.some((o) => 'type' in o)).toBe(false);
  });

  it('basic-tabs: every item carries `value`, and `defaultValue` names one of them', () => {
    expect(reasons(basicTabs)).toEqual([]);
    // `tabs.tsx` passes `item.value` to both `TabsTrigger` and `TabsContent`;
    // with all three undefined no panel can be selected, and `defaultValue` is
    // what makes one paint at all (the registration marks it `required: true`).
    const tabs = basicTabs as { defaultValue?: string; items: Array<{ value?: string }> };
    const values = tabs.items.map((i) => i.value);
    expect(values).toEqual(['tab1', 'tab2', 'tab3']);
    expect(values).toContain(tabs.defaultValue);
  });

  it('icon-toolbar: every button carries `label`, the only key the group renders', () => {
    expect(reasons(iconToolbar)).toEqual([]);
    // `button-group.tsx` renders `{button.label}` and reads neither `icon` nor
    // `value`; the sibling `with-icons.json` — which already validated — is the
    // corpus's own precedent for carrying all three.
    const buttons = (iconToolbar as { buttons: Array<Record<string, unknown>> }).buttons;
    expect(buttons.map((b) => b.label)).toEqual(['Copy', 'Cut', 'Paste']);
    expect(buttons.map((b) => b.icon)).toEqual(['copy', 'scissors', 'clipboard']);
  });
});
