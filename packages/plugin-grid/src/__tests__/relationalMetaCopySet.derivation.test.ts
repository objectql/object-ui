/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6875 — the gate that DERIVES `ObjectGrid`'s relational copy set from
 * its consumers instead of trusting a hand-kept literal.
 *
 * ## What went wrong, and why a longer literal would not have fixed it
 *
 * `RELATIONAL_META_KEYS` was governed by a rule stated only in prose — *every
 * key here has to have a measured reader on this grid's own render path*. The
 * repo enforced that rule in one direction: objectui#6711 and objectui#6874
 * each removed a key that had NO reader, and each left a behavioural pin
 * behind. Nothing enforced the other direction, so five keys that DO have
 * readers on this path were never copied, and the list's own spellings had gone
 * inconsistent — `lookupFilters` (camel) sat in it while `displayField` and
 * `descriptionField` did not, though all three come off the same kind of
 * chain in the same files.
 *
 * Adding the missing spellings by hand would restore the invariant for exactly
 * as long as nobody touches a consumer. This file is the invariant itself: it
 * re-extracts the read set from the consumer sources on every run and requires
 * `RELATIONAL_META_READ_SET` to match it EXACTLY, in both directions. A new
 * spelling in any chain is unclassified → red. A key deleted from a chain is an
 * orphan in the table → red.
 *
 * ## The three consumers, and how each is read
 *
 * `generateColumns()` hands `fieldMeta` to `CellRenderer` as the `field` prop.
 * `getCellRenderer` dispatches a relational column to `LookupCellRenderer`
 * (`@object-ui/fields/src/index.tsx`), which reads its keys through
 * `(field as { k?: T }).k` casts — the untyped-read shape this seam uses. The
 * inline editor renders `LookupField` (receiver `fieldMeta`) and `UserField`
 * (receiver `meta`), which use optional-chained member reads.
 *
 * ⚠️ Those two are swept, but they are NOT fed this bag — `renderCellEditor`
 * spreads the schema def into them directly (objectui#7154, measured in
 * `lookupPickerKeys-7154.test.tsx`). So a key that only they read is
 * classified here without ever being a candidate for copying, and the verdict
 * column is where that decision is recorded.
 *
 * ⚠️ `UserField` is swept even though it forwards its whole meta into
 * `LookupField` via a spread. A delegating consumer is exactly where a false
 * zero hides: a key it read and did NOT forward would be invisible in
 * `LookupField`'s own source. Its extracted set being a subset is a RESULT
 * here, not an assumption.
 *
 * ## ⛔ THE LIMIT THAT MATTERS MOST — this gate cannot judge a COPY
 *
 * The read set below is a UNION over three consumers, and only the FIRST is fed
 * the copied bag. So a key's presence in it means "some consumer reads this
 * key" and never "this bag is how that consumer gets it". A copy-set entry
 * asserts the second. objectui#6875 read the first as the second and shipped
 * two keys onto a bag their only reader never consults; objectui#7166 measured
 * that and retired three (`descriptionField`, `lookupColumns`, `lookupFilters`).
 *
 * ⚠️ Every one of them is STILL in the extracted read set, so every derived
 * assertion here passes whichever verdict they carry — this gate would not go
 * red if they were put back. Their absence is pinned by a hand-written
 * assertion below and, behaviourally, by
 * `relationalMetaCopySet-7166.test.tsx`. Re-scoping the derivation around the
 * cell alone (editor widgets classified separately) is what would make this
 * mechanical; that is a design change to objectui#6875's mechanism, filed
 * rather than made.
 *
 * ## ⛔ The extractor is bounded, and says so
 *
 * It reads member accesses off named receivers. A key that reaches a consumer
 * some other way — destructuring, a computed `meta[expr]`, a helper that takes
 * the whole bag — is outside its reach. That is the honest limit; the five
 * spellings objectui#6875 measured were all plain member reads, and so is every
 * key the three chains use today. `assertExtractorFoundKnownChains` is the
 * positive control that keeps a silently-empty extraction from reading as a
 * clean bill of health.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { FieldSchema } from '@objectstack/spec/data';

import { RELATIONAL_META_READ_SET, RELATIONAL_META_KEYS } from '../relationalMetaKeys';

const FIELDS_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fields/src',
);

function read(rel: string): string {
  return readFileSync(path.join(FIELDS_SRC, rel), 'utf8');
}

/**
 * The body of `LookupCellRenderer`, bounded by its declaration and the first
 * column-0 `}` after it. Bounding matters: `fields/src/index.tsx` holds every
 * cell renderer, and the unrelated ones read `field.min`, `field.pattern`,
 * `field.required_message` and friends off the same identifier.
 */
function lookupCellRendererBody(): string {
  const src = read('index.tsx');
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.startsWith('export function LookupCellRenderer('));
  if (start < 0) throw new Error('LookupCellRenderer declaration not found — extractor is stale');
  const end = lines.findIndex((l, i) => i > start && l === '}');
  if (end < 0) throw new Error('LookupCellRenderer end brace not found — extractor is stale');
  return lines.slice(start, end + 1).join('\n');
}

/** `recv?.key` / `recv.key` member reads off one named receiver. */
function memberReads(src: string, receiver: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(`\\b${receiver}\\s*\\??\\.\\s*([A-Za-z_$][\\w$]*)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[1]);
  return out;
}

/** `(recv as { key?: T }).key` cast reads — how `LookupCellRenderer` reads. */
function castReads(src: string, receiver: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(`\\(\\s*${receiver}\\s+as\\s+\\{\\s*([A-Za-z_$][\\w$]*)\\s*\\??:`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[1]);
  return out;
}

interface Extraction {
  readonly all: Set<string>;
  readonly perConsumer: Readonly<Record<string, Set<string>>>;
}

function extractReadSet(): Extraction {
  const cell = lookupCellRendererBody();
  const perConsumer = {
    'index.tsx#LookupCellRenderer': castReads(cell, 'field'),
    'widgets/LookupField.tsx': memberReads(read('widgets/LookupField.tsx'), 'fieldMeta'),
    'widgets/UserField.tsx': memberReads(read('widgets/UserField.tsx'), 'meta'),
  };
  const all = new Set<string>();
  for (const set of Object.values(perConsumer)) for (const k of set) all.add(k);
  return { all, perConsumer };
}

/**
 * Positive control. An extractor that silently matched nothing would make every
 * "no unclassified key" assertion below pass vacuously — the classic shape of a
 * green gate over an empty measurement. These five spellings are quoted from
 * the three consumers by hand; if the extractor stops finding them it is broken,
 * whatever the copy set says.
 */
function assertExtractorFoundKnownChains(x: Extraction): void {
  expect(x.perConsumer['index.tsx#LookupCellRenderer']).toContain('display_field');
  expect(x.perConsumer['index.tsx#LookupCellRenderer']).toContain('displayField');
  expect(x.perConsumer['widgets/LookupField.tsx']).toContain('lookup_columns');
  expect(x.perConsumer['widgets/LookupField.tsx']).toContain('lookupColumns');
  expect(x.perConsumer['widgets/UserField.tsx']).toContain('reference_field');
}

const specProps = new Set(Object.keys((FieldSchema as any).shape));

describe('objectui#6875 — the copy set is derived from the consumers, not restated', () => {
  it('the extractor reaches all three consumers (CONTROL)', () => {
    const x = extractReadSet();
    assertExtractorFoundKnownChains(x);
    // Every consumer contributes; a zero from any one of them is a broken sweep,
    // not a consumer that reads nothing.
    for (const [name, set] of Object.entries(x.perConsumer)) {
      expect(set.size, `${name} contributed no reads`).toBeGreaterThan(0);
    }
  });

  it('classifies every key the consumers read — no unclassified spelling', () => {
    const { all } = extractReadSet();
    const unclassified = [...all].filter((k) => !(k in RELATIONAL_META_READ_SET)).sort();
    expect(
      unclassified,
      'A consumer reads these off the field meta and the table does not classify them. '
        + 'Add each to RELATIONAL_META_READ_SET with a verdict — that decision is the fix '
        + 'objectui#6875 exists to make unforgettable.',
    ).toEqual([]);
  });

  it('carries no orphan — every classified key is still read by a consumer', () => {
    const { all } = extractReadSet();
    const orphans = Object.keys(RELATIONAL_META_READ_SET).filter((k) => !all.has(k)).sort();
    expect(
      orphans,
      'These are classified but no consumer reads them any more. A key written from the '
        + 'schema def on every column build and read by nothing is what objectui#6711 and '
        + 'objectui#6874 retired.',
    ).toEqual([]);
  });

  it('proves each `no-producer` verdict against the installed spec, not against prose', () => {
    const claimed = Object.entries(RELATIONAL_META_READ_SET)
      .filter(([, e]) => e.verdict === 'no-producer')
      .map(([k]) => k);
    expect(claimed.length).toBeGreaterThan(0);
    // Control first: the assertion below is "absent from a 71-prop strict
    // schema", and an empty/misresolved shape would satisfy it for every key.
    expect(specProps.size).toBeGreaterThan(60);
    expect(specProps.has('displayField')).toBe(true);
    for (const key of claimed) {
      expect(specProps.has(key), `${key} is classified no-producer but FieldSchema declares it`).toBe(false);
    }
  });

  it('proves each `spec` verdict against the installed spec', () => {
    for (const [key, e] of Object.entries(RELATIONAL_META_READ_SET)) {
      if (e.verdict !== 'spec') continue;
      expect(specProps.has(key), `${key} is classified spec but FieldSchema does not declare it`).toBe(true);
    }
  });

  it('records the `legacy-alias` asymmetry mechanically — none of them is authorable', () => {
    // These are copied for back-compat and cannot be produced by a
    // spec-compliant author. Asserting it here keeps the docblock's claim from
    // going stale silently if a future spec version declares one of them — at
    // which point the verdict should become `spec`.
    for (const [key, e] of Object.entries(RELATIONAL_META_READ_SET)) {
      if (e.verdict !== 'legacy-alias') continue;
      expect(specProps.has(key), `${key} is now spec-declared — reclassify it as 'spec'`).toBe(false);
    }
  });

  it('the copy set is exactly the copied verdicts, and still carries the one key objectui#6875 delivered', () => {
    const expected = Object.entries(RELATIONAL_META_READ_SET)
      .filter(([, e]) => e.verdict === 'spec' || e.verdict === 'adapter-stamped' || e.verdict === 'legacy-alias')
      .map(([k]) => k);
    expect([...RELATIONAL_META_KEYS].sort()).toEqual(expected.sort());
    // objectui#6875 shipped three keys; ONE of them is genuinely delivered on
    // this bag, and it is the one that arrived with a rendering test.
    // `lookupDisplayFieldSpelling-6875.test.tsx` renders the difference it makes.
    expect(RELATIONAL_META_KEYS).toContain('displayField');
    // The two named keys that are NOT reachable stay out — copying them would
    // write a member no producer can fill (objectui#6711's reasoning).
    for (const key of ['reference_field', 'lookup_columns']) {
      expect(RELATIONAL_META_KEYS).not.toContain(key);
    }
  });

  it('proves each `deferred` verdict is spec-declared — the class is "reaches the editor anyway", not "unproducible"', () => {
    const deferred = Object.entries(RELATIONAL_META_READ_SET)
      .filter(([, e]) => e.verdict === 'deferred')
      .map(([k]) => k);
    // Control: the bucket is populated, so the loop below is a reading.
    expect(deferred.length).toBeGreaterThan(0);
    for (const key of deferred) {
      expect(
        specProps.has(key),
        `${key} is classified deferred but FieldSchema does not declare it — a key no producer `
          + 'can emit belongs under `no-producer`, whose verdict carries the opposite proof.',
      ).toBe(true);
    }
  });

  it('⛔ objectui#7166 — the three retired keys stay OUT of the copy set, and the derivation cannot enforce that', () => {
    const retired = ['descriptionField', 'lookupColumns', 'lookupFilters'];
    // Control: the copy set is populated, so "not contained" is a reading.
    expect(RELATIONAL_META_KEYS.length).toBeGreaterThan(5);
    expect(RELATIONAL_META_KEYS).toContain('displayField');
    for (const key of retired) {
      expect(
        RELATIONAL_META_KEYS,
        `${key} is back on the copy set. objectui#7166 measured it having NO reader on this bag: `
          + 'its only reader is an editor widget, which `renderCellEditor` feeds from the schema '
          + 'def. Put it back and you write a member nothing on the cell path reads.',
      ).not.toContain(key);
    }

    // ⭐ THE POINT OF THIS ASSERTION, and why it is hand-written rather than
    // derived. All three are STILL in the extracted read set — the editor
    // widgets do read them — so every derived assertion in this file passes
    // whichever verdict they carry. Read-set membership means "a consumer reads
    // this key"; it never meant "this bag is how that consumer gets it", and
    // only the second claim justifies a copy. Mistaking the first for the
    // second is what put two of these three here (objectui#6875).
    const readSet = [...extractReadSet().all];
    for (const key of retired) {
      expect(readSet, `${key} left the read set — then this pin is stale, not load-bearing`).toContain(key);
    }
  });

  it('every entry carries a note — a verdict with no reason is not a decision', () => {
    for (const [key, e] of Object.entries(RELATIONAL_META_READ_SET)) {
      expect(e.note.length, `${key} has no note`).toBeGreaterThan(20);
    }
  });
});
