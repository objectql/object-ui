/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `AppActionSchema.onClick`'s retirement message says something FALSIFIABLE
 * about this tree, so it is pinned here (objectui#6854, maintainer ruling of
 * 2026-09-05, option B2).
 *
 * The message `handlerKeyRefusal('onClick', 'retired', …)` generates ends:
 *
 *   > … and no renderer reads this key, so nothing could ever run it.
 *
 * That sentence was FALSE when this card was filed. `@object-ui/runner`'s
 * `LayoutRenderer` mapped `AppAction.items` and reached `(item as any).onClick`
 * — past the declared element type, which is `AppMenuItem` and has no such key
 * — leaving three mutually exclusive signals for a reader to pick from: the
 * TypeScript face said `?: never`, the validator said nobody reads it, and a
 * renderer read it. The ruling closed that by deleting the cast rather than by
 * softening the sentence, so the sentence is true again and this file is what
 * keeps it that way from the `packages/types` side: edit the shared template in
 * `zod/tombstone.zod.ts` and this test names what the edit costs.
 *
 * The renderer side is pinned where the renderer lives —
 * `packages/runner/src/__tests__/LayoutRenderer.appActionItems-6854.test.tsx`
 * drives a real menu and requires an authored `onClick` never to be invoked.
 * Neither pin can see the other's package, which is the point: the claim is
 * about both, so it takes an assertion on each side.
 *
 * ⛔ NOT a pin on the template's exact prose in general — 22 other retired keys
 * share it and their own message assertions live with them. This one asserts
 * the clause whose truth this card measured.
 */

import { describe, it, expect } from 'vitest';
import { AppActionSchema, MenuItemSchema } from '../zod/app.zod';

/** The clause this card measured. Spelled out, not built from the template. */
const MEASURED_CLAUSE = 'no renderer reads this key, so nothing could ever run it';

const onClickArm = AppActionSchema.shape.onClick;
const describeText = (onClickArm as { description?: string }).description;

describe('AppActionSchema.onClick — the retirement message states a measured fact (objectui#6854)', () => {
  it('claims, verbatim, that no renderer reads the key', () => {
    expect(describeText).toContain(MEASURED_CLAUSE);
  });

  it('names the key and marks it RETIRED, not a runtime slot', () => {
    expect(describeText).toContain('`onClick`');
    expect(describeText).toContain('RETIRED (objectui#6124');
    expect(describeText).not.toContain('RUNTIME SLOT');
  });

  it('an authored value is refused BY NAME, carrying that same sentence to the author', () => {
    const result = AppActionSchema.safeParse({
      type: 'button',
      label: 'Quick actions',
      onClick: 'openQuickActions',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) => String(i.path[0]) === 'onClick');
    expect(issue, 'no issue addressed to `onClick`').toBeDefined();
    expect(issue!.code).toBe('custom');
    // ONE string feeds both author-facing channels (the `handlerKeyRefusal`
    // invariant): the parse-time message an author reads cannot drift away from
    // the `.describe()` metadata the docs surface publishes.
    expect(issue!.message).toBe(describeText);
    expect(issue!.message).toContain(MEASURED_CLAUSE);
  });

  it('the action without the key parses green — the refusal is about the key, not the action', () => {
    expect(AppActionSchema.safeParse({ type: 'button', label: 'Quick actions' }).success).toBe(true);
  });
});

describe('why the cast could never have been fed by an author (objectui#6854 Zone 2, the premise)', () => {
  // `AppAction.items` is parsed by the LEGACY eight-member `MenuItemSchema`, a
  // plain `z.object` — so `onClick` and `shortcut` are not refused there, they
  // are STRIPPED in silence. An author therefore has no declared route to send
  // either key, which is what made deleting the two reads a cleanup rather than
  // a behaviour removal. Whether `shortcut` SHOULD become authorable here is a
  // separate contract question and deliberately not answered by this file.
  const authored = { label: 'Profile', onClick: 'goProfile', shortcut: 'Ctrl+P' };

  it('the items mirror accepts the document and drops both undeclared keys', () => {
    const result = MenuItemSchema.safeParse(authored);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parsed = result.data as Record<string, unknown>;
    expect(parsed.label).toBe('Profile');
    expect('onClick' in parsed).toBe(false);
    expect('shortcut' in parsed).toBe(false);
  });

  it('a whole action carrying such an item parses green, with the item scrubbed', () => {
    const result = AppActionSchema.safeParse({
      type: 'user',
      label: 'Ada Lovelace',
      items: [authored, { type: 'separator' }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const [first] = (result.data as { items: Record<string, unknown>[] }).items;
    expect('onClick' in first).toBe(false);
    expect('shortcut' in first).toBe(false);
  });
});
