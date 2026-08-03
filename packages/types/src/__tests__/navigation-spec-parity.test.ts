/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Navigation ↔ `@objectstack/spec` drift guard (objectstack#4115).
 *
 * `NavigationItemSchema` is the only navigation schema with a *runtime*
 * consumer: `@object-ui/cli`'s published `objectui validate` command parses
 * metadata through `AnyComponentSchema`, which reaches it via `AppSchema`.
 * Renderers read plain objects and never parse, so every gap below was a CLI
 * defect — and a strip-mode schema fails silently, which is why they survived.
 *
 * The gaps this pins, all measured against spec 17.0.0-rc.0:
 *
 *  - `requiresObject` / `requiresService` — capability gates that
 *    `NavigationItem` has always declared and `NavigationRenderer` has always
 *    honoured. Only the schema lagged, so `objectui validate` dropped them.
 *  - `actionDef` — an action item's entire payload. Stripped, so an item that
 *    could never invoke anything validated clean.
 *  - `expanded` — the spec's spelling of group expansion. The renderer already
 *    read it (behind an `as any`, because the type did not declare it).
 *  - `badgeVariant: 'secondary'` — spec-valid, hard-rejected here.
 *  - `{ type: 'separator' }` — spec-valid, rejected for missing id/label.
 *
 * Deliberately NOT modelled: the spec expresses navigation as a discriminated
 * union of nine variants, each with its target field required and a
 * `superRefine` exclusivity rule. objectui keeps one flat, all-optional shape,
 * so it accepts items the spec would reject (e.g. `type: 'object'` with no
 * `objectName`). Converging on the union is a breaking change for every
 * consumer that reads fields off `NavigationItem` without narrowing — tracked
 * separately, not smuggled in here.
 */

import { describe, it, expect } from 'vitest';
import { NavigationItemSchema, NavigationAreaSchema } from '../zod/app.zod.js';

/** Parse and return the surviving object, so "accepted" cannot hide a strip. */
function keep(input: unknown): Record<string, unknown> | null {
  const r = NavigationItemSchema.safeParse(input);
  return r.success ? (r.data as Record<string, unknown>) : null;
}

describe('NavigationItemSchema keeps the spec vocabulary it used to drop', () => {
  it('keeps the capability gates the renderer actually reads', () => {
    const kept = keep({ id: 'apps', type: 'object', label: 'Apps', objectName: 'sys_app', requiresObject: 'sys_app' });
    expect(kept).not.toBeNull();
    expect(kept!.requiresObject).toBe('sys_app');

    const svc = keep({ id: 'ai', type: 'url', label: 'AI', url: '/ai', requiresService: 'ai' });
    expect(svc!.requiresService).toBe('ai');
  });

  it('keeps an action item\'s payload instead of validating an empty shell', () => {
    const kept = keep({ id: 'run', type: 'action', label: 'Run', actionDef: { actionName: 'sync_now' } });
    expect(kept).not.toBeNull();
    expect(kept!.actionDef).toEqual({ actionName: 'sync_now' });
  });

  it('keeps the spec spelling of group expansion', () => {
    const kept = keep({ id: 'grp', type: 'group', label: 'Group', children: [], expanded: true });
    expect(kept!.expanded).toBe(true);
  });

  it('still accepts the legacy defaultOpen spelling', () => {
    const kept = keep({ id: 'grp', type: 'group', label: 'Group', children: [], defaultOpen: true });
    expect(kept!.defaultOpen).toBe(true);
  });

  it('accepts every spec badge variant, including secondary', () => {
    for (const variant of ['default', 'secondary', 'destructive', 'outline']) {
      const kept = keep({ id: 'x', type: 'url', label: 'X', url: '/x', badgeVariant: variant });
      expect(kept, `badgeVariant '${variant}' was rejected`).not.toBeNull();
      expect(kept!.badgeVariant).toBe(variant);
    }
  });

  it('accepts a bare separator, which carries no identity or text by definition', () => {
    expect(keep({ type: 'separator' })).not.toBeNull();
  });

  it('exempts ONLY the separator from needing id + label', () => {
    // The separator exemption is implemented by declaring `id`/`label`
    // optional, so without the refinement that re-imposes them this would
    // also wave through an unidentifiable destination.
    expect(keep({ type: 'object', label: 'No id', objectName: 'contact' })).toBeNull();
    expect(keep({ id: 'no_label', type: 'object', objectName: 'contact' })).toBeNull();
    expect(keep({ id: 'ok', type: 'object', label: 'Ok', objectName: 'contact' })).not.toBeNull();
  });

  it('still rejects an unknown item type', () => {
    // The permissiveness above is scoped to spec vocabulary — it must not
    // become "anything goes".
    expect(keep({ id: 'x', type: 'wormhole', label: 'X' })).toBeNull();
  });
});

describe('NavigationAreaSchema keeps the spec fields it used to drop', () => {
  it('keeps description', () => {
    // `order` was asserted here too until spec 17.0.0 retired it at AREA level
    // (with `visible` and `requiredPermissions`); `description` is the one of
    // the pair from objectui#3088 that is still a spec key.
    const r = NavigationAreaSchema.safeParse({
      id: 'sales',
      label: 'Sales',
      description: 'Pipeline and accounts',
      navigation: [],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.description).toBe('Pipeline and accounts');
  });
});
