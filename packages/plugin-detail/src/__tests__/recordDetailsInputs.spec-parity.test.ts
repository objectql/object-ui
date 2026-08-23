/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:details` — the published authoring surface stays in parity with
 * `@objectstack/spec` `RecordDetailsProps` (objectui#3807, objectstack#5611).
 *
 * Sibling of `recordHighlightsInputs.spec-parity.test.ts` (objectui#3407 /
 * PR #3795) and the same two directions, on the block where the drift was
 * worse: there the `fields` description spelled an entry shape that was merely
 * INCOMPLETE (`readonly` missing); here the `sections` description spelled an
 * entry shape the spec had DELETED. Until 17.x `sections` was
 * `z.array(z.string())` — "section IDs" — and objectstack#5611 replaced that
 * with the object form outright (no producer, no consumer, so one shape rather
 * than two de-facto contracts). The registry text kept teaching the ID list.
 *
 * WHY A DESCRIPTION IS WORTH A TEST. `inputs` is not documentation, it is the
 * published contract: `gen-manifest.ts` serializes it into `sdui.manifest.json`
 * (the save-gate + parser whitelist) and into `sdui-intrinsics.d.ts` (the JSX
 * authoring surface), and for an array-of-objects input the ENTRY shape exists
 * nowhere else — `ComponentInput` has no member-shape slot, which is why the
 * repo-wide gate in `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`
 * (objectui#3797 / PR #3806) can only see top-level keys and says so in its
 * LIMIT note. An author following the retired spelling gets four silent layers:
 * `['a','b']` is a valid `array` to the manifest gate, upstream
 * `validateComponentProps` is advisory, the spec is only parsed on paths that
 * parse, and `RecordDetailsRenderer` reads `s.name` / `s.label` / `s.fields`
 * off each entry — all `undefined` on a string, so the section renders nothing.
 * Once `sections` is authored at all it is the ONLY source of the body, so the
 * page comes up blank with no diagnostic anywhere pointing at `sections`.
 * (That used to read "under `layout: 'custom'`". `layout` was removed in
 * @objectstack/spec 17.0.0 — its `auto` | `custom` semantics were never
 * implemented — and the body is now chosen by what you author: `sections`
 * renders the explicit groups, omitting it falls back to the object's
 * `highlightFields`. The blank-page failure this file guards is unchanged.)
 *
 * Every expectation below is DERIVED from the spec schema at runtime rather
 * than restating today's key list, so a spec change fails here instead of
 * quietly reopening the gap.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ComponentRegistry } from '@object-ui/core';
import { RecordDetailsProps } from '@objectstack/spec/ui';
import '../index';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

type ShapeCarrier = { shape?: unknown; _def?: { shape?: unknown } };

/** Resolve a Zod object's `.shape` through both spellings, lazy or plain. */
function shapeKeys(schema: unknown): string[] {
  const carrier = schema as ShapeCarrier | undefined;
  const shape = carrier?.shape ?? carrier?._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return resolved && typeof resolved === 'object' ? Object.keys(resolved) : [];
}

/** One entry of `.shape`, unwrapped past `.optional()`. */
function shapeMember(schema: unknown, key: string): unknown {
  const carrier = schema as ShapeCarrier | undefined;
  const shape = carrier?.shape ?? carrier?._def?.shape;
  const resolved = (typeof shape === 'function' ? (shape as () => object)() : shape) as
    | Record<string, unknown>
    | undefined;
  const member = resolved?.[key] as { unwrap?: () => unknown } | undefined;
  return typeof member?.unwrap === 'function' ? member.unwrap() : member;
}

/** The element schema of a `z.array(...)`, through both spellings. */
function arrayElement(schema: unknown): unknown {
  const arr = schema as {
    element?: unknown;
    def?: { element?: unknown };
    _def?: { type?: unknown; element?: unknown };
  } | undefined;
  return arr?.element ?? arr?.def?.element ?? arr?._def?.element ?? arr?._def?.type;
}

/** Top-level keys of the spec's `RecordDetailsProps`, INCLUDING tombstones. */
const specTopLevelKeys = (): string[] => shapeKeys(RecordDetailsProps);

/**
 * Is this top-level key an ADR-0087 tombstone — declared, but typed `never` so
 * every value is rejected with a named migration message?
 *
 * This distinction is load-bearing, and objectui#3818 is what proved it. A D2
 * retirement does NOT delete the key from the shape; it REPLACES the member
 * with `z.never()` carrying the "removed in 17.0.0, run `os migrate meta`"
 * text. So a retired key still answers `Object.keys(shape)` — which is why
 * `layout` survived the 17.0.0-rc.6 pin bump on the published surface below
 * with every derived gate green: the gate asked "is this key in the shape",
 * the tombstone said yes, and the manifest kept offering an input the spec
 * rejects on parse. Filtering tombstones out is what makes the gate mean what
 * its name says.
 */
const isTombstoned = (key: string): boolean => {
  const member = shapeMember(RecordDetailsProps, key) as
    | { _def?: { type?: string }; def?: { type?: string } }
    | undefined;
  return (member?._def?.type ?? member?.def?.type) === 'never';
};

/** Top-level keys the spec actually ACCEPTS — tombstones removed. */
const specAcceptedTopLevelKeys = (): string[] =>
  specTopLevelKeys().filter((key) => !isTombstoned(key));

/** Member keys of one `sections[]` entry, per the spec. */
const specSectionKeys = (): string[] =>
  shapeKeys(arrayElement(shapeMember(RecordDetailsProps, 'sections')));

/**
 * Section keys `RecordDetailsRenderer` honours beyond the spec's four. Read off
 * `renderers/record-details.tsx` (`s.title ?? s.label`, `s.showBorder`,
 * `s.hideEmpty`) — a hand-kept list, but the ASSERTION filters it through the
 * spec at runtime, so the day upstream declares one of these it drops out of
 * the forbidden set on its own instead of pinning a stale prohibition.
 */
const RENDERER_ONLY_SECTION_KEYS = ['title', 'showBorder', 'hideEmpty'];

/**
 * Does the installed spec REFUSE an undeclared key inside a `sections[]` entry,
 * or drop it in silence? (objectui#4648, measured on a GA-installed tree.)
 *
 * `@objectstack/spec` 17.0.0 GA closed the section object under
 * objectstack#4001 batch A; the pinned `17.0.0-rc.6` strips. The verdict this
 * file asserts is the same on both — those keys are not an authoring surface,
 * so the `sections` description may not teach them — but the evidence differs.
 *
 * Probed behaviourally, on the section object specifically: strictness is per
 * schema, so the top-level probe in the sibling `record:highlights` file says
 * nothing about this one.
 */
const specRefusesUnknownSectionKeys = !RecordDetailsProps.safeParse({
  sections: [{ label: 'Contact', fields: ['phone'], __objectui_4648_probe__: true }],
}).success;

const config = () => ComponentRegistry.getConfig('record:details');
const inputs = () => config()?.inputs ?? [];
const input = (name: string) => inputs().find((i) => i.name === name);
const sectionsDescription = () => input('sections')?.description ?? '';

describe('record:details — registry inputs vs @objectstack/spec', () => {
  it('is registered with a non-empty `inputs` surface', () => {
    expect(config()).toBeDefined();
    expect(inputs().map((i) => i.name)).toContain('sections');
  });

  it('the spec really takes OBJECT sections — the id-list spelling is gone, not unioned in', () => {
    // Guards the premise the rest of the file rests on. A `z.array(z.string())`
    // arm coming back (or the object form moving) must fail here first, because
    // the description below would then be documenting the wrong shape again.
    expect(specSectionKeys().length).toBeGreaterThan(0);

    // A VALUE verdict, so the criterion is a full parse, not key recognition:
    // the retired spelling has to be rejected on its value, and the object form
    // has to survive intact.
    //
    // NEITHER fixture may carry `layout` (objectui#4167). Both did until
    // @objectstack/spec 17.0.0-rc.6, which gave the key — removed in 17.0.0 under
    // ADR-0087 D2 (objectstack#6946) — a named `never` rejection. That rejection
    // is what the fixtures then hit: the object-form case failed on `layout`
    // while its `sections` were perfectly valid, and, worse, the id-list case
    // above kept PASSING on `layout`'s own `invalid_type` without ever reaching
    // `sections` — green for a reason that has nothing to do with what it
    // asserts. Dropping the key puts both verdicts back on `sections`, where the
    // issues now resolve to path `sections.0` / `sections.1`.
    const idList = RecordDetailsProps.safeParse({
      sections: ['contact_info', 'address'],
    });
    expect(idList.success).toBe(false);
    expect(idList.error?.issues.map((i) => i.code)).toContain('invalid_type');
    // Pin the PATH, not just the code — this is precisely the assertion that was
    // satisfied by the wrong key, and a code alone cannot tell the two apart.
    expect(idList.error?.issues.map((i) => i.path.join('.'))).toContain('sections.0');

    const objectForm = RecordDetailsProps.safeParse({
      sections: [{ name: 'contact_info', label: 'Contact', columns: 2, fields: ['phone'] }],
    });
    expect(objectForm.success).toBe(true);
    expect(objectForm.data?.sections?.[0]).toMatchObject({
      name: 'contact_info',
      columns: 2,
      fields: ['phone'],
    });
  });

  it('every spec section member key is discoverable from the `sections` description', () => {
    const description = sectionsDescription();
    expect(description).not.toBe('');
    const undocumented = specSectionKeys().filter((key) => !description.includes(key));
    expect(undocumented).toEqual([]);
  });

  it('the `sections` description no longer teaches the retired section-id spelling', () => {
    // The regression this issue was filed for, named explicitly so it stays
    // legible if the derived check above is ever loosened. The entry shape must
    // be stated as an object, and the string form must be ruled out in the same
    // breath — an author reading only "object form" would not know their
    // existing `['contact_info']` page is now silently empty.
    const description = sectionsDescription();
    expect(description).not.toMatch(/section ids/i);
    expect(description).toMatch(/object/i);
    expect(description).toMatch(/string/i);
  });

  it('publishes no section member key the spec refuses to carry', () => {
    // The renderer honours `title` / `showBorder` / `hideEmpty` per section,
    // but the spec's section object does not declare them, so an author who
    // writes them gets nothing back from the contract. Documenting them here
    // would teach keys the contract does not carry — the member-level twin of
    // publishing a top-level input the props schema rejects.
    const stripped = RENDERER_ONLY_SECTION_KEYS.filter(
      (key) => !specSectionKeys().includes(key),
    );
    expect(stripped).not.toEqual([]); // the premise: these really are undeclared

    const parsed = RecordDetailsProps.safeParse({
      sections: [{ label: 'Contact', fields: ['phone'], title: 'T', showBorder: true, hideEmpty: false }],
    });

    if (specRefusesUnknownSectionKeys) {
      // 17.0.0 GA closed the section object too (objectstack#4001 batch A), so
      // the three arrive as a named refusal instead of vanishing. Envelope, not
      // a bare failure: the code, and the keys it names — `label` / `fields`
      // must NOT be among them, which a plain `success === false` cannot tell.
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.map((i) => i.code)).toContain('unrecognized_keys');
      const refused = parsed.error?.issues.flatMap(
        (i) => (i as unknown as { keys?: string[] }).keys ?? [],
      );
      expect(refused).toEqual(expect.arrayContaining(stripped));
      expect(refused).not.toContain('label');
      expect(refused).not.toContain('fields');
    } else {
      // The pinned rc.6: dropped in silence, which is the harm this file was
      // filed over — success receipt, section renders without them.
      expect(parsed.success).toBe(true);
      expect(Object.keys(parsed.data?.sections?.[0] ?? {}).sort()).toEqual(['fields', 'label']);
    }

    // Word-boundary, not substring: this direction asks "does the text teach
    // this KEY", and prose legitimately contains words that merely embed one
    // ("untitled" embeds `title`). The forward check above can stay a substring
    // test because a false positive there only ever accepts a description that
    // does mention the key.
    const description = sectionsDescription();
    const published = stripped.filter((key) => new RegExp(`\\b${key}\\b`).test(description));
    expect(published).toEqual([]);
  });

  it('declares no top-level input the spec does not accept', () => {
    // ACCEPTED keys, not merely DECLARED ones — a tombstone is present in the
    // shape and rejects every value (see `isTombstoned`). Reading raw shape
    // keys here is what let the retired `layout` input stay published and green
    // through the 17.0.0-rc.6 bump (objectui#3818).
    const allowed = new Set(specAcceptedTopLevelKeys());
    const offSpec = inputs().map((i) => i.name).filter((name) => !allowed.has(name));
    expect(offSpec).toEqual([]);
  });

  it('publishes `hideFields`, which the renderer has read all along', () => {
    // The reverse direction on this block (objectui#3808). `hideFields` was
    // declared by the spec (objectstack#5611) and read by
    // `renderers/record-details.tsx:147` while `inputs` omitted it, so the
    // manifest, the generated `.d.ts` and the designer panel all said the key
    // did not exist and `sdui-parser` reported `unknown-prop` on an author who
    // wrote it anyway — while the renderer honoured it. Same shape as `readonly`
    // in objectui#3407.
    //
    // A KEY-reachability claim, so the criterion is that the key SURVIVES the
    // parse. The verdict behind that choice is the same on every pin — an
    // undeclared top-level key is not an authoring surface — while the contract
    // states it two ways depending on the installed `@objectstack/spec`: the
    // closed props schemas refuse it with a named `unrecognized_keys` (the
    // top-level twin of `specRefusesUnknownSectionKeys` above), where the older
    // strip-mode `z.object`s dropped it from `data` with no error at all, which
    // is exactly why the gap was silent. So "it is still there afterwards" is the
    // proof on both, and `success === true` is not — on a stripping pin an
    // undeclared key gets that too. Probed behaviourally rather than off a
    // version string: `specRefusesUnknownTopLevelKeys` in the sibling
    // `recordHighlightsInputs.spec-parity.test.ts` models the shape, and
    // strictness is per schema, so it is the pattern rather than a reading of
    // this one.
    expect(specTopLevelKeys()).toContain('hideFields');
    const parsed = RecordDetailsProps.safeParse({ hideFields: ['phone'] });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.hideFields).toEqual(['phone']);

    expect(inputs().map((i) => i.name)).toContain('hideFields');
    expect(input('hideFields')?.description ?? '').not.toBe('');
  });

  it('`hideFields` documents bare names only, because the spec rejects entry objects', () => {
    // The same fence `fields` is held to below, on the sibling key — and here it
    // is a VALUE verdict, so the criterion is a full parse either way: the object
    // spelling has to be rejected on its value, not merely stripped.
    //
    // The renderer is more tolerant than the contract at this read site
    // (`typeof n === 'string' ? n : fieldName(n)`), which is not a second
    // contract to advertise. Every in-repo producer passes strings
    // (`synth/buildDefaultPageSchema.ts:557-562` types it `string[]`), so the
    // tolerant arm is unexercised drift rather than a live dialect.
    const element = arrayElement(shapeMember(RecordDetailsProps, 'hideFields'));
    expect(shapeKeys(element)).toEqual([]);
    expect(RecordDetailsProps.safeParse({ hideFields: ['phone'] }).success).toBe(true);

    const objectForm = RecordDetailsProps.safeParse({ hideFields: [{ name: 'phone' }] });
    expect(objectForm.success).toBe(false);
    expect(objectForm.error?.issues.map((i) => i.code)).toContain('invalid_type');

    // Non-empty FIRST. A `not.toContain('{')` on a description that does not
    // exist passes for the wrong reason — the reverse-verification run for
    // objectui#3808 deleted the `hideFields` declaration and watched this
    // assertion stay green on `''` while the three assertions that matter went
    // red. An empty description is a failure here, not a vacuous pass.
    const description = input('hideFields')?.description ?? '';
    expect(description).not.toBe('');
    expect(description).not.toContain('{');
  });

  it('publishes the two GA keys the renderer has read all along (#4668)', () => {
    // The same reverse direction as `hideFields` above, on the two keys
    // @objectstack/spec 17.0.0 GA added to this block. Both were read by
    // `RecordDetailsRenderer` — `(schema.inlineEdit ?? true) &&
    // objectInlineEditable`, and `showHeader: schema.showHeader ?? false` on the
    // synthesized `detail-view` — while `inputs` omitted them, so the manifest
    // and the generated `.d.ts` said the keys did not exist and `sdui-parser`
    // reported `unknown-prop` on an author who wrote one, which the renderer then
    // honoured.
    //
    // A VALUE verdict, not merely a key-reachability one: the published
    // `type: 'boolean'` is a claim about which values the contract takes, so the
    // criterion is a full parse both ways. Both keys read straight off the
    // top-level schema, so unlike `page:tabs.alwaysShowStrip` (see
    // `packages/components/src/__tests__/page-tabs-always-show-strip.test.tsx`)
    // the published spelling was already the one the renderer reads — no arm had
    // to be added here.
    for (const key of ['inlineEdit', 'showHeader']) {
      expect(specTopLevelKeys()).toContain(key);
      expect(isTombstoned(key), `${key} is a tombstone, not a live key`).toBe(false);

      expect(inputs().map((i) => i.name)).toContain(key);
      expect(input(key)?.type).toBe('boolean');
      expect((input(key)?.description ?? '').length).toBeGreaterThan(0);

      for (const value of [true, false]) {
        const parsed = RecordDetailsProps.safeParse({ [key]: value });
        expect(parsed.success).toBe(true);
        expect((parsed.data as Record<string, unknown> | undefined)?.[key]).toBe(value);
      }
      for (const rejected of [1, 'true', null]) {
        const parsed = RecordDetailsProps.safeParse({ [key]: rejected });
        expect(parsed.success, `spec accepted ${key}=${JSON.stringify(rejected)}`).toBe(false);
        expect(parsed.error?.issues.map((i) => i.path.join('.'))).toContain(key);
      }
    }
  });

  it('`inlineEdit` is documented as the opt-OUT it actually is (#4668)', () => {
    // The description is the only place this asymmetry can be stated, and it is
    // the part a wrong reading makes expensive rather than merely vague: the
    // value is AND-ed with the object's resolved editability (ADR-0103) and with
    // the server's effective API operation set (objectui#3546), so `false` is
    // unconditional while `true` cannot open editing the platform refuses. An
    // author told "true enables inline editing" files a bug against the renderer
    // when a system object stays read-only.
    const description = input('inlineEdit')?.description ?? '';
    expect(description).not.toBe('');
    expect(description).toMatch(/false/);
    // Asserted through the renderer's own default, so the text cannot drift from
    // the read: `schema.inlineEdit ?? true`.
    expect(input('inlineEdit')?.defaultValue).toBe(true);
    expect(input('showHeader')?.defaultValue).toBe(false);
  });

  it('`fields` documents no entry shape, because the spec accepts bare names only', () => {
    // objectui#3807's fence check on the sibling input at the same call site.
    // Top-level `fields` is `z.array(z.string())`: there is no member shape to
    // publish, and the renderer's tolerance for `{name}` / `{field}` entries is
    // not a second contract to advertise — the spec rejects those values.
    const element = arrayElement(shapeMember(RecordDetailsProps, 'fields'));
    expect(shapeKeys(element)).toEqual([]);
    expect(RecordDetailsProps.safeParse({ fields: ['phone'] }).success).toBe(true);
    expect(RecordDetailsProps.safeParse({ fields: [{ name: 'phone' }] }).success).toBe(false);

    const description = input('fields')?.description ?? '';
    expect(description).not.toBe('');
    expect(description).not.toContain('{');
  });
});

/**
 * objectui#3818 — the retired `layout` key, pinned on the published surface.
 *
 * `record:details` published `layout: enum ['auto','custom']` with
 * `defaultValue: 'auto'` and the description "auto uses the object
 * highlightFields; custom uses explicit sections". None of that was ever
 * implemented: the renderer's ONLY `schema.layout` read tested `'inline'` |
 * `'compact'` — two values the schema never permitted — so both legal values
 * fell through the same ternary to `'vertical'` and the key selected nothing.
 * A two-value enum whose values do the same thing is a false affordance with
 * zero diagnostics: an author writing `layout: 'custom'` believed it took
 * effect. @objectstack/spec 17.0.0 removed the key (objectstack#6946,
 * ADR-0087 D2) and the maintainer ruling of 2026-08-09 on objectui#3818 is
 * REMOVAL on this side too.
 *
 * Why these pins are not redundant with the derived gate above: a D2 tombstone
 * stays IN the shape (see `isTombstoned`), so every key-presence check kept
 * passing while the input was still published. The gate is now
 * tombstone-aware, and the assertions below name this key so the repair stays
 * legible if that helper is ever loosened.
 */
describe('record:details — `layout` is retired, not merely undocumented (#3818)', () => {
  it('the spec REJECTS `layout`, with the ADR-0087 migration message', () => {
    // The premise, checked first: if upstream ever un-retires the key, this
    // fails before the negative pins below start guarding a dead rule.
    expect(specTopLevelKeys()).toContain('layout'); // tombstone is still declared
    expect(isTombstoned('layout')).toBe(true);
    expect(specAcceptedTopLevelKeys()).not.toContain('layout');

    // A rejection case, so the assertion set is the envelope and not a bare
    // "it failed": path + code + the named migration text. Both formerly
    // published values AND both values the dead renderer branch tested — all
    // four are unauthorable now, which is the whole point.
    for (const value of ['auto', 'custom', 'inline', 'compact']) {
      const parsed = RecordDetailsProps.safeParse({ layout: value });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.map((i) => i.path.join('.'))).toContain('layout');
      expect(parsed.error?.issues.map((i) => i.code)).toContain('invalid_type');
      expect(parsed.error?.issues[0]?.message).toMatch(/removed in @objectstack\/spec 17\.0\.0/);
    }
  });

  it('the published surface offers no `layout` input', () => {
    // Non-empty FIRST — `inputs()` returning `[]` would satisfy every
    // absence assertion below for the wrong reason (the vacuous-green trap
    // the `hideFields` block above documents from objectui#3808's reverse run).
    expect(inputs().length).toBeGreaterThan(0);
    expect(inputs().map((i) => i.name)).toContain('sections');

    expect(inputs().map((i) => i.name)).not.toContain('layout');
    expect(input('layout')).toBeUndefined();
  });

  it('no input description still teaches `layout` as an authorable key', () => {
    // The declaration and its prose died together: `sections` used to end
    // "Required when layout is 'custom'", which would have kept teaching the
    // key from a neighbouring description after the input itself was gone.
    const descriptions = inputs().map((i) => i.description ?? '');
    expect(descriptions.join('')).not.toBe('');
    for (const description of descriptions) {
      expect(description).not.toMatch(/\blayout is\b/i);
      expect(description).not.toMatch(/layout:\s*['"]?(auto|custom)/i);
    }
  });

  it('the renderer contains no `schema.layout` read', () => {
    // Source-text half. The behavioural twin lives in
    // `recordDetailsBodySource.test.tsx` (authoring the key changes no output);
    // this one catches a re-added branch that a render assertion could miss if
    // the branch were re-introduced behind a condition the fixtures never hit.
    const src = readFileSync(join(SRC_DIR, 'renderers/record-details.tsx'), 'utf8');
    expect(src).toContain('RecordDetailsRenderer'); // the file really is the renderer
    expect(src).not.toMatch(/schema\s*\.\s*layout/);
    expect(src).not.toMatch(/['"]compact['"]/);
  });
});
