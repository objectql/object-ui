/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Page / App / Dashboard ↔ `@objectstack/spec` drift guard (objectstack#4115).
 *
 * These three renderer nodes extend `BaseSchema`, which is `.passthrough()`,
 * while their spec counterparts are strict. That combination is the objectui
 * equivalent of the objectstack#4120 silent-drop failure: every spec-only key
 * — `branding`, `sharing`, `interfaceConfig`, `source`, `header`,
 * `performance`, the whole `_lock*` package envelope — rode through
 * *completely unvalidated*, so `brading: {…}` was indistinguishable from
 * `branding: {…}` and a spec-authored `kind: 'html'` page could not even
 * express its body (`source` was never declared).
 *
 * The fix is NOT `.strict()` — these are component nodes and the open envelope
 * is deliberate. It is to let the spec's own fields flow in by reference
 * (`SpecXFields = SpecXSchema.omit({…}).partial()`), the pattern
 * `zod/objectql.zod.ts`'s `ListViewSchema` already uses.
 *
 * The derivation picks up new spec fields automatically, but can still break
 * silently in three ways, which these tests catch:
 *
 *   1. The spec grows a field objectui never triaged. Asserted: every spec key
 *      is present in the objectui shape, or envelope-owned by BaseSchema.
 *   2. The spec renames/removes a field objectui deliberately omits and
 *      re-declares locally — the local override would then shadow nothing.
 *      Asserted: every omitted anchor still exists upstream.
 *   3. Someone adds an objectui-local key that should have been a spec field.
 *      Asserted: every objectui-only key is in the sanctioned set below.
 *
 * When one fails, do NOT edit the sets to make it green — decide whether the
 * field belongs upstream in `@objectstack/spec` or is a genuine objectui-only
 * extension, and record the reason.
 */

import { describe, it, expect } from 'vitest';
import {
  AppSchema as SpecAppSchema,
  DashboardSchema as SpecDashboardSchema,
  PageSchema as SpecPageSchema,
} from '@objectstack/spec/ui';
import { AppComponentSchema as OuiAppSchema } from '../zod/app.zod.js';
import { DashboardComponentSchema as OuiDashboardSchema } from '../zod/complex.zod.js';
import { PageNodeSchema as OuiPageSchema } from '../zod/layout.zod.js';
import { BaseSchema } from '../zod/base.zod.js';

const shapeOf = (s: unknown) => (s as { shape: Record<string, unknown> }).shape;

/** Component-envelope keys owned by BaseSchema — derived, never hand-listed. */
const ENVELOPE = new Set(Object.keys(shapeOf(BaseSchema)));

interface Case {
  spec: unknown;
  oui: unknown;
  /** Spec keys objectui deliberately omits and re-declares locally. */
  omitted: string[];
  /** objectui-only keys, each a conscious local-vs-upstream decision. */
  local: string[];
}

const CASES: Record<string, Case> = {
  Page: {
    spec: SpecPageSchema,
    oui: OuiPageSchema,
    // `type` collides semantically (spec = page kind, objectui = component
    // discriminator, kind lives on `pageType`); `regions` is a local fork.
    omitted: ['type', 'regions'],
    // `actions` is the odd one out and is listed HERE deliberately rather than
    // exempted: it is not a local CAPABILITY, it is a local REFUSAL. The spec
    // does not declare it, no renderer reads it, and objectui#7926 (maintainer
    // ruling 2026-09-09, batch #107 item 2, option A) ruled that `page` grows no
    // reader — so the key is DECLARED as an ADR-0049 tombstone precisely so an
    // authored value is refused by name instead of being kept in silence by
    // `BaseSchema`'s `.passthrough()`. That makes it an objectui-only key on
    // this shape, and this ledger is the right place for the decision to be
    // visible. `../__tests__/page-actions-refusal-7926.test.ts` owns the
    // behaviour; this row owns the fact that the key exists at all.
    local: ['title', 'pageType', 'body', 'children', 'actions'],
  },
  App: {
    spec: SpecAppSchema,
    oui: OuiAppSchema,
    omitted: ['navigation', 'areas', 'contextSelectors'],
    local: ['title', 'logo', 'favicon', 'layout', 'menu', 'actions'],
  },
  Dashboard: {
    spec: SpecDashboardSchema,
    oui: OuiDashboardSchema,
    omitted: ['widgets', 'globalFilters', 'dateRange'],
    local: [],
  },
};

describe.each(Object.keys(CASES))('%s spec parity (objectstack#4115 drift guard)', (name) => {
  const { spec, oui, omitted, local } = CASES[name];
  const specShape = shapeOf(spec);
  const ouiShape = shapeOf(oui);
  const ouiKeys = new Set(Object.keys(ouiShape));

  it('covers every spec field — the spec cannot grow a key objectui ignores', () => {
    const missing = Object.keys(specShape).filter((k) => !ouiKeys.has(k) && !ENVELOPE.has(k));
    expect(missing).toEqual([]);
  });

  it('keeps the upstream anchors it deliberately omits and re-declares', () => {
    // A rename upstream would orphan the local override, silently reopening
    // the very drift this derivation closed.
    for (const key of omitted) {
      expect(specShape, `spec no longer declares '${key}'`).toHaveProperty(key);
    }
  });

  it('declares no objectui-only key outside the sanctioned set', () => {
    const rogue = [...ouiKeys].filter(
      (k) => !(k in specShape) && !ENVELOPE.has(k) && !local.includes(k),
    );
    expect(rogue).toEqual([]);
  });
});

describe('spec-only keys are now VALIDATED, not passed through (objectstack#4115)', () => {
  it('Page declares the five keys that used to ride through unchecked', () => {
    const keys = Object.keys(shapeOf(OuiPageSchema));
    for (const key of ['interfaceConfig', 'kind', 'slots', 'source', 'requires']) {
      expect(keys, `'${key}' is still undeclared`).toContain(key);
    }
  });

  it('Page can finally express a source-authored page (kind html/react)', () => {
    // Before the derivation `source` was not declared at all, so `kind: 'html'`
    // was unauthorable — the body had nowhere to live.
    const ok = OuiPageSchema.safeParse({ type: 'page', kind: 'html', source: '<h1>hi</h1>' });
    expect(ok.success).toBe(true);
    expect(ok.success && (ok.data as { source?: string }).source).toBe('<h1>hi</h1>');
  });

  it('Page rejects a bad `kind` instead of waving it through', () => {
    expect(OuiPageSchema.safeParse({ type: 'page', kind: 'nonsense' }).success).toBe(false);
  });

  it('App declares the package-lock and access keys that used to ride through', () => {
    const keys = Object.keys(shapeOf(OuiAppSchema));
    // `homePageId` was in this list until spec 17.0.0 retired it; it is now a
    // tombstone rather than an authorable key, so it is pinned separately
    // below — listing it here would read as "still authorable".
    for (const key of ['branding', 'sharing', 'embed', 'objects', 'apis', 'requiredPermissions', '_packageId']) {
      expect(keys, `'${key}' is still undeclared`).toContain(key);
    }
  });

  it('App REJECTS the retired `homePageId` rather than stripping it', () => {
    // objectstack#4667 / #4709 retired the key: it was an ID cross-reference
    // with no referential integrity, so a dangling id silently fell back to the
    // first nav item. The landing page is now the first reachable nav item (by
    // `order`), and the root landing follows `isDefault`.
    //
    // Rejection, not stripping, is the whole point — objectui's derivation is
    // strip-mode, so if the tombstone ever stopped flowing in by reference an
    // author would get their landing-page intent silently deleted instead of an
    // error naming the migration. That is the failure this pins.
    const rejected = OuiAppSchema.safeParse({ type: 'app', name: 'app_x', homePageId: 'home' });
    expect(rejected.success, '`homePageId` is being accepted again').toBe(false);
    expect(OuiAppSchema.safeParse({ type: 'app', name: 'app_x' }).success).toBe(true);
  });

  it('App validates branding instead of accepting any shape', () => {
    expect(OuiAppSchema.safeParse({ type: 'app', branding: { primaryColor: '#fff' } }).success).toBe(true);
    // A wrong-typed branding used to be indistinguishable from a correct one.
    expect(OuiAppSchema.safeParse({ type: 'app', branding: 'blue' }).success).toBe(false);
  });

  it('Dashboard declares header/refreshInterval/performance', () => {
    const keys = Object.keys(shapeOf(OuiDashboardSchema));
    for (const key of ['header', 'refreshInterval', 'performance', 'protection']) {
      expect(keys, `'${key}' is still undeclared`).toContain(key);
    }
  });

  it('Dashboard validates header instead of accepting any shape', () => {
    expect(
      OuiDashboardSchema.safeParse({ type: 'dashboard', widgets: [], header: { showTitle: true } }).success,
    ).toBe(true);
    expect(
      OuiDashboardSchema.safeParse({ type: 'dashboard', widgets: [], header: 'yes' }).success,
    ).toBe(false);
  });
});

describe('the derivation stays permissive where objectui needs it', () => {
  it('no spec field became required — stored payloads keep validating', () => {
    // `.partial()` on the imported shape is what guarantees this; without it a
    // spec field gaining `required` would invalidate every stored node.
    expect(OuiPageSchema.safeParse({ type: 'page' }).success).toBe(true);
    expect(OuiAppSchema.safeParse({ type: 'app' }).success).toBe(true);
    expect(OuiDashboardSchema.safeParse({ type: 'dashboard', widgets: [] }).success).toBe(true);
  });

  it('the local vocabulary still parses', () => {
    expect(
      OuiPageSchema.safeParse({ type: 'page', pageType: 'record', title: 'T', regions: [] }).success,
    ).toBe(true);
    expect(
      OuiAppSchema.safeParse({ type: 'app', title: 'T', logo: '/l.png', layout: 'sidebar' }).success,
    ).toBe(true);
  });

  it('the component envelope still passes unknown renderer props through', () => {
    // BaseSchema is deliberately open for type-specific extensions; the fix
    // narrows what the SPEC owns, it does not close the node.
    const r = OuiPageSchema.safeParse({ type: 'page', someRendererProp: 42 });
    expect(r.success).toBe(true);
  });
});
