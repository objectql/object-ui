/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:quick_actions` — the toolbar's accessible name is read under the
 * spelling the platform ARIA contract actually accepts (objectui#4663).
 *
 * The bar used to read `schema.aria?.label` and nothing else. That is the ONE
 * spelling `@objectstack/spec`'s `AriaPropsSchema` refuses: `label` is an ALIAS
 * ENTRY on that closed shape, i.e. a rename prescription pointing at
 * `ariaLabel`, so it exists to produce a better rejection message — never to be
 * accepted. The two halves compounded into a dead read point:
 *
 *   - the spec-valid `aria: { ariaLabel: '…' }` reached the renderer and was
 *     read by nothing (the built-in "Quick actions" default won every time);
 *   - the spelling the renderer honoured is the one an author cannot write
 *     without the contract rejecting the document.
 *
 * `SchemaRenderer`'s generic ARIA channel is no escape hatch here: it reads the
 * FLAT `schema.ariaLabel` off the hoisted node and injects `aria-label` as a
 * component PROP, and this renderer drops every prop that is not a designer key
 * (`splitDesigner` keeps `data-obj-id` / `data-obj-type` / `style` and discards
 * the rest). The nested bag read below is the only live path for an authored
 * name on this surface.
 *
 * The spec half is measured, not asserted from memory — the last case parses
 * both spellings through the installed `AriaPropsSchema` so "the contract
 * refuses `label`" stays a fact this file checks rather than a claim it repeats.
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecordContextProvider } from '@object-ui/react';
import { AriaPropsSchema } from '@objectstack/spec/ui';
import { RecordQuickActionsRenderer } from '../record-quick-actions';

/**
 * One visible action, so the toolbar element (and its `aria-label`) renders at
 * all — with no visible action the bar short-circuits to its dashed placeholder,
 * which carries no toolbar role.
 */
const ACT = { name: 'act', label: 'Act', type: 'script', locations: ['record_header'] };

function mount(aria?: Record<string, unknown>) {
  return render(
    <RecordContextProvider objectName="crm_account" recordId="rec-1" data={{ id: 'rec-1' }}>
      <RecordQuickActionsRenderer schema={{ actions: [ACT], ...(aria ? { aria } : {}) } as any} />
    </RecordContextProvider>,
  );
}

const toolbarName = () => screen.getByRole('toolbar').getAttribute('aria-label');

describe('record:quick_actions — toolbar accessible name (objectui#4663)', () => {
  it('reads the contract spelling `aria.ariaLabel`', () => {
    mount({ ariaLabel: 'Account actions' });
    expect(toolbarName()).toBe('Account actions');
  });

  it('still honours the legacy `aria.label` stored documents carry', () => {
    // Back-compat only. `AriaPropsSchema` refuses this spelling (last case), so
    // nothing newly authored can reach here — it exists for documents written
    // before the contract closed, mirroring the fold `normalizeListViewSchema`
    // applies at the ListView boundary (`ARIA_KEY_ALIASES`, objectui#2890).
    mount({ label: 'Legacy name' });
    expect(toolbarName()).toBe('Legacy name');
  });

  it('prefers the canonical spelling when a document carries both', () => {
    mount({ ariaLabel: 'Canonical', label: 'Legacy' });
    expect(toolbarName()).toBe('Canonical');
  });

  it('falls back to the built-in name when neither spelling is authored', () => {
    mount();
    expect(toolbarName()).toBe('Quick actions');
  });

  /**
   * Empty-string semantics, pinned because this is exactly where `??` and `||`
   * part company and the choice is deliberate (objectui#4663).
   *
   * Both halves follow the repo's existing handling of THIS key:
   *
   *   - canonical-vs-legacy uses `??`, matching `normalizeListViewSchema`'s aria
   *     fold, which copies the legacy key across only when the canonical one is
   *     `undefined` — a declared `ariaLabel: ''` shadows the legacy key there,
   *     and does here;
   *   - the built-in default is truthiness-gated, matching `ListView`'s own read
   *     point (`schema.aria?.ariaLabel ? {'aria-label': …} : {}`), which treats
   *     an empty string as no accessible name at all. `role="toolbar"` needs a
   *     name, so the equivalent here is the built-in default rather than
   *     ListView's "omit the attribute".
   */
  it('treats an authored empty string as no name — the built-in default wins', () => {
    mount({ ariaLabel: '' });
    expect(toolbarName()).toBe('Quick actions');
    cleanup();

    // …and the empty canonical value still shadows the legacy key, rather than
    // letting a stale legacy name resurface under a document that has been
    // migrated to the contract spelling.
    mount({ ariaLabel: '', label: 'Legacy' });
    expect(toolbarName()).toBe('Quick actions');
  });

  it('the platform contract really accepts `ariaLabel` and refuses `label`', () => {
    // The premise the read order above rests on, measured against the installed
    // spec instead of restated. If a future spec ever accepts `label`, this
    // fails and the legacy leg's justification (back-compat only, never an
    // authoring surface) has to be revisited.
    expect(AriaPropsSchema.safeParse({ ariaLabel: 'Account actions' }).success).toBe(true);

    const legacy = AriaPropsSchema.safeParse({ label: 'Account actions' });
    expect(legacy.success).toBe(false);
    // Asserted as an envelope — the code AND the key it names — so a rejection
    // of something else could not satisfy it.
    expect(legacy.error?.issues.map((i) => i.code)).toContain('unrecognized_keys');
    expect(
      legacy.error?.issues.flatMap((i) => (i as unknown as { keys?: string[] }).keys ?? []),
    ).toContain('label');
  });
});
