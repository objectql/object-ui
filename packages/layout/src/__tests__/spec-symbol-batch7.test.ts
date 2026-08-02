/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/layout` ↔ `@objectstack/spec` symbol-collision guards
 * (objectui#3161, objectstack#4115 ledger batch 7).
 *
 * Both symbols batch 7 touched here were the RENDERED layer wearing the
 * AUTHORED layer's name. They ended differently, and the difference is the
 * point:
 *
 *  - `PageHeaderProps` → `PageHeaderComponentProps`, the name
 *    `@object-ui/app-shell` already settled on for its own header props
 *    (objectui#3169). Reused deliberately: one concept, one name, even across
 *    two packages that each draw their own header. Still exported, still
 *    guarded below.
 *  - `Page` → `PageNodeRenderer` → **deleted** (objectui#3223, ADR-0049
 *    enforce-or-remove). The rename was correct and did not go far enough: the
 *    renderer was registered nowhere and called from nowhere — the `page` key
 *    belongs to `@object-ui/components`'s `PageRenderer`, and `registerLayout`
 *    actively discourages re-registering it — so all the export did was tell
 *    the next reader that `@object-ui/layout` is where page rendering lives.
 *
 * What survives that deletion is the LAYER SPLIT it was renamed for, pinned
 * below: the spec's `Page` is the authored page DOCUMENT, `@object-ui/types`'s
 * `PageNodeSchema` is the SDUI NODE discriminated by `type: 'page'`, and the
 * two are not interchangeable. Those pins are load-bearing beyond the deleted
 * component — `type: 'page'` is the wire key `PageRenderer` is registered
 * under, and this is the only place in the repo that pins it — so they are
 * kept here rather than deleted along with their former subject.
 *
 * Each `import type` below is load-bearing: if the spec retires one of these
 * names, this file stops compiling, and the rename's justification is up for
 * re-triage rather than quietly outliving it. The opposite direction — the spec
 * claiming one of the NEW names — is what
 * `scripts/check-spec-symbol-derivation.mjs` reports on every CI run.
 */

import { describe, it, expect } from 'vitest';
// `PageHeaderProps` is a zod SCHEMA in the spec, not a type — which is the
// collision in one line: the spec's is a validator for authored JSON, this
// package's was a React props interface.
import type { Page as SpecPage, PageHeaderProps as SpecPageHeaderPropsSchema } from '@objectstack/spec/ui';
import type { PageNodeSchema } from '@object-ui/types';

import { PageHeader } from '../PageHeader';
import type { PageHeaderComponentProps } from '../PageHeader';

describe('the renamed export is still the component it was', () => {
  it('exports the renderer under its new name', () => {
    expect(typeof PageHeader).toBe('function');
    expect(PageHeader.name).toBe('PageHeader');
  });
});

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off type-check. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Extends<A, B> = [A] extends [B] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type HasKey<T, K extends string> = K extends keyof T ? true : false;

/** What `PageHeaderProps.parse()` returns — the authored node, normalised. */
type SpecParsedHeader = (typeof SpecPageHeaderPropsSchema)['_zod']['output'];

describe('the spec names still mean the authored layer', () => {
  it('is pinned at compile time', () => {
    type _PageIsReal = Assert<Equal<IsAny<SpecPage>, false>>;
    type _HeaderIsReal = Assert<Equal<IsAny<SpecParsedHeader>, false>>;

    // The spec's is the AUTHORED node: `breadcrumb` is a required boolean once
    // parsed, `actions` is a list of action IDs, `icon` an icon NAME. These
    // props are what the DOM component takes. Not interchangeable in the
    // direction that matters — a renderer's props cannot stand in for authored
    // metadata, so nothing can accidentally serialise one as the other.
    type _RenderedIsNotAuthored = Assert<Equal<Extends<PageHeaderComponentProps, SpecParsedHeader>, false>>;
    type _AuthoredHasBreadcrumb = Assert<HasKey<SpecParsedHeader, 'breadcrumb'>>;
    type _RenderedHasSchemaNode = Assert<HasKey<PageHeaderComponentProps, 'schema'>>;

    // `Page` in the spec is the page DOCUMENT (`name` + `label` identify it);
    // the SDUI node is `PageNodeSchema`, tagged `type: 'page'`. Two layers, two
    // names — pinned here even though objectui#3223 deleted this package's
    // page-node renderer, because `type: 'page'` is the registry key
    // `@object-ui/components`'s `PageRenderer` answers to, and nowhere else in
    // the repo pins it. Collapse these two types back together and the next
    // renderer named after the wrong layer compiles clean.
    type _DocumentIsNotNode = Assert<Equal<Equal<SpecPage, PageNodeSchema>, false>>;
    type _DocumentIsIdentified = Assert<HasKey<SpecPage, 'name'>>;
    type _NodeIsATaggedNode = Assert<Equal<PageNodeSchema['type'], 'page'>>;

    expect(true).toBe(true);
  });
});
