/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * THE UNIVERSAL container-declaration census, ratcheted to zero (objectui#6779).
 *
 * ## Why a THIRD file on this fact, and what makes it different
 *
 * The same defect has now been found three times independently, one registration
 * at a time: objectui#3900 (`page-header`, closed), objectui#6740 (`flex`,
 * PR #6762) and objectui#6764 (8 more, PR #6774). Each was filed as a one-off
 * because nothing in the tree asked the question of the tree.
 *
 * Its two existing pins are ENUMERATIVE, and that is precisely how the class
 * regenerated past them:
 *
 *   - `__tests__/layout-containers-declare-containment.test.tsx` covers a literal
 *     4-element array (`flex`/`grid`/`card`/`container`);
 *   - `renderers/__tests__/container-declaration-census.test.tsx` covers the 8
 *     that PR #6774 declared.
 *
 * Both stay: they pin WHY those twelve were declared, which this file does not.
 * What this file adds is the coverage set — the WHOLE REGISTRY instead of a
 * literal array — so the 4th rediscovery is a red test rather than a card.
 *
 * ## The instrument, and why it is a RUNTIME one
 *
 * objectui#6779 measured four reasons the source-side spelling of this question
 * cannot be built (option D, refused by name in the ruling):
 *
 *   1. `scripts/component-registrations.mjs`, the tree's own reader, refuses
 *      computed keys by design — and 41 of the 53 register from a loop variable,
 *      so it cannot even NAME them;
 *   2. file granularity mis-reads `layout/page.tsx` as compliant: it holds two
 *      `isContainer` tokens, both in a manifest-builder helper, while all five of
 *      its registrations lack the flag;
 *   3. WHICH registration is live is a whole-program import-order fact, with two
 *      recorded casualties in this tree (`ui:kbd`, `ui:table` — objectui#5125);
 *   4. "children or body" is not a distinction a source predicate keeps — that
 *      spelling over-reports by 10.
 *
 * So the predicate here is behavioural and executed: render the tag through the
 * real `SchemaRenderer` with one authored child and ask whether that child
 * reached the DOM. It is objectui#6740's mechanism with the array taken out.
 *
 * ⭐ THE EXCEPTION SHAPES NEED NO EXCLUSION LIST — the predicate excludes them.
 * The ruling names three populations a naive predicate would sweep in wrongly:
 * `tabs` (renders `items[].content`), the void tags `img`/`hr`/`br` (same loop
 * factory as 34 tags that DO render children), and the `schema.body` readers
 * (`badge`, `alert`, the `sidebar-*` family). Measured here: every one of them
 * puts NO authored child on the page, so the runtime predicate scores them as
 * non-containers by construction, with nothing skipped by name. That is a
 * property of this predicate and not of the population, so it is PINNED below —
 * rewrite the predicate as "renders children OR body" and those pins go red
 * instead of 10-plus tags silently becoming containers.
 *
 * ## MEASURED on main@d06059f24, over the live registry
 *
 *   - 293 registry keys, of which 131 are bare authoring tags;
 *   - 58 render `schema.children` (the child text reached the DOM);
 *   - 13 of those declare the flag: objectui#6764's 5-tag control set
 *     (`flex`/`grid`/`card`/`container`/`stack`) plus PR #6774's 8;
 *   - 45 do NOT, and every one drew `not-a-container` on a list it then rendered;
 *   - 73 render no children and correctly keep the diagnostic;
 *   - 0 failed to render, so nothing was scored on an exception.
 *
 * The 45 are the stock. `button` is excluded by ruling and pinned separately — that
 * exclusion was made PERMANENT and reasoned by objectui#6804 (2026-08-30); see the
 * `button` block below. The other 44 are `scripts/container-declaration-baseline.json`,
 * which is a RATCHET TO ZERO and not an exemption list: red when an unlisted tag
 * violates, and red again when a listed tag stops violating, so the file can only
 * shrink.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, waitFor } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, AdapterCtx } from '@object-ui/react';
import { manifestFromConfigs, validateTree } from '@object-ui/sdui-parser';
import type { Diagnostic, SchemaElement } from '@object-ui/sdui-parser';

// Module scope, not a hook: this import IS the registration (AGENTS.md
// §测试纪律 — an unbounded module load must not be billed to a bounded window).
import '../index';

const CONTAINMENT = 'not-a-container';
const MARK = 'ratchet-child';

/** Long enough for 131 sequential renders under a loaded CI box. */
const CENSUS_TIMEOUT = 120_000;

/**
 * The repo root, derived from THIS FILE's own location — never from the cwd
 * (objectui#7799).
 *
 * TWO premises stood here and BOTH were false.
 *
 * 1. "The cwd is the repo root by construction: `scripts/
 *    vitest-invocation-guard.mjs` refuses any invocation whose vitest root is
 *    not the repo root." The guard is real, but it is a DIFFERENT invariant:
 *    `--root` moves VITEST's root and moves nothing about `process.cwd()`. This
 *    package's own `test` script — `vitest run --root ../.. packages/components/`,
 *    which is what `pnpm --filter @object-ui/components test` and
 *    `turbo run test` both run — sets that root correctly and leaves cwd at
 *    `packages/components/`. Measured with cwd as the only variable: 13 passed
 *    from the repo root, 6 failed / 7 passed from the package directory.
 * 2. "NOT `import.meta.url`: under vite that is an `http://` module URL, not a
 *    `file://` one." Measured on objectui#7799 in this very project (`dom`) and
 *    under both cwds, bare `import.meta.url` is
 *    `file:///…/packages/components/src/renderers/__tests__/<this file>`. What
 *    Vite rewrites is the TWO-ARGUMENT form `new URL(rel, import.meta.url)`,
 *    which does evaluate to a `http://localhost:3000/@fs/…` dev-server URL — so
 *    only the bare form is read below, and it is taken apart by hand rather than
 *    passed to `fileURLToPath`. That is the spelling landed for objectui#7791
 *    (PR #7796), copied here rather than invented again.
 *
 * The `globalThis` indirection went with the cwd read: this package's
 * `src/global.d.ts` declares a BROWSER `process` shim that its type-check
 * resolves ahead of the node global, so neither the bare `process` global nor
 * `import process from 'node:process'` compiles with `.cwd()`. Deriving the root
 * from `import.meta.url` reads no `process` at all, so the dance is simply gone.
 * That shim's own compile pin is not weakened by this: it lives in
 * `packages/components/src/__tests__/browser-process-shim-scope.test.ts`, which
 * still makes the `process.cwd()` call deliberately, for exactly that purpose.
 */
const SELF_DEPTH_BELOW_REPO_ROOT = 6; // packages / components / src / renderers / __tests__ / this file
const REPO_ROOT = decodeURIComponent(new URL(import.meta.url).pathname)
  .split('/')
  .slice(0, -SELF_DEPTH_BELOW_REPO_ROOT)
  .join('/');

const BASELINE_PATH = join(REPO_ROOT, 'scripts/container-declaration-baseline.json');

interface Baseline {
  note: string[];
  excluded: Record<string, { reason: string; issue: string; since: string }>;
  undeclared: Record<string, { since: string; issue: string }>;
}

const readBaseline = (): Baseline => {
  // The existence check comes first so a moved or renamed ledger fails LOUDLY,
  // rather than as a confusing JSON parse error or — worse — as a green run
  // against an empty object.
  expect(existsSync(BASELINE_PATH), `baseline not found at ${BASELINE_PATH}`).toBe(true);
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
};

/**
 * The manifest the running app validates against, built the way the app builds
 * it — keyed by every KNOWN registry tag rather than by `getAllConfigs()`, whose
 * `.type` is always the namespaced form. Mirrors `getJsxManifest()` in
 * `renderers/layout/page.tsx`. Key it off `getAllConfigs()` instead and the bare
 * tag an author writes is absent from the manifest, so every assertion below
 * would pass on `unknown-component` without reaching the containment check.
 */
const diagnose = (schema: unknown): Diagnostic[] => {
  const configs = ComponentRegistry.getKnownTypes().map((t) => {
    const meta = ComponentRegistry.getMeta(t);
    return { type: t, namespace: meta?.namespace, isContainer: meta?.isContainer, inputs: meta?.inputs };
  });
  const manifest = manifestFromConfigs(configs as unknown as Parameters<typeof manifestFromConfigs>[0]);
  return validateTree(schema as SchemaElement, manifest).diagnostics;
};

const withChildren = (type: string) => ({ type, children: [{ type: 'text', content: MARK }] });

/** Does this registration put an AUTHORED child list on the page? */
const rendersChildren = async (type: string): Promise<boolean> => {
  const { container, unmount } = render(
    <AdapterCtx.Provider value={null as never}>
      <SchemaRenderer schema={withChildren(type) as never} />
    </AdapterCtx.Provider>,
  );
  try {
    await waitFor(() => expect(container.textContent).toBeDefined());
    return (container.textContent || '').includes(MARK);
  } finally {
    unmount();
  }
};

interface Row {
  type: string;
  rendersChildren: boolean;
  isContainer: boolean;
  containment: boolean;
  unknown: boolean;
  isPublic: boolean;
}

/** Every BARE authoring tag — the namespaced twins are the same registration. */
const bareTags = (): string[] =>
  ComponentRegistry.getKnownTypes()
    .filter((t) => !t.includes(':'))
    .sort();

const publicTags = (): Set<string> =>
  new Set((ComponentRegistry.getPublicConfigs() as Array<{ type: string }>).map((c) => c.type));

/**
 * Run once for the whole file. Memoised as a PROMISE rather than done in a
 * `beforeAll`, because `hookTimeout` (10s) is NARROWER than `testTimeout` and
 * 131 renders under a loaded box do not reliably fit in it (AGENTS.md §测试纪律
 * — moving an unbounded cost into a hook only relocates the race).
 */
let censusPromise: Promise<Row[]> | undefined;

const census = (): Promise<Row[]> =>
  (censusPromise ??= (async () => {
    const isPublic = publicTags();
    const rows: Row[] = [];
    for (const type of bareTags()) {
      const codes = diagnose(withChildren(type)).map((d) => d.code);
      rows.push({
        type,
        rendersChildren: await rendersChildren(type),
        isContainer: ComponentRegistry.getMeta(type)?.isContainer === true,
        containment: codes.includes(CONTAINMENT),
        unknown: codes.includes('unknown-component'),
        isPublic: isPublic.has(type),
      });
    }
    return rows;
  })());

/** The violation this file exists to stop: renders a child list, declares none. */
const violators = (rows: Row[]): string[] =>
  rows.filter((r) => r.rendersChildren && !r.isContainer).map((r) => r.type);

describe('the census is a reading, not a broken scan (objectui#6779)', () => {
  it(
    'reproduces the objectui#6764 control set and resolves every tag it scored',
    async () => {
      const rows = await census();

      // CONTROL ONE — the named five. objectui#6764 established that the tags
      // declaring the flag are exactly `flex`/`grid`/`card`/`container`/`stack`;
      // reproducing them is what makes the ZEROES elsewhere a reading rather
      // than evidence that this scan resolves nothing. Asserted as a subset
      // rather than an equality because PR #6774 legitimately added 8 more, and
      // paying off the ratchet is SUPPOSED to add more still.
      const declared = new Set(rows.filter((r) => r.isContainer).map((r) => r.type));
      for (const control of ['flex', 'grid', 'card', 'container', 'stack']) {
        expect(declared.has(control), `control tag \`${control}\` no longer declares`).toBe(true);
      }

      // CONTROL TWO — reachability before absence. A tag the manifest does not
      // resolve reports `unknown-component` and never reaches the containment
      // branch, so it would score as "no violation" for the wrong reason.
      expect(rows.filter((r) => r.unknown).map((r) => r.type)).toEqual([]);

      // CONTROL THREE — the diagnostic still fires. Every tag that renders NO
      // children must still draw `not-a-container`; if the check were deleted or
      // `isContainer` defaulted on, this file would otherwise go green having
      // measured nothing at all.
      const silent = rows.filter((r) => !r.rendersChildren && !r.containment).map((r) => r.type);
      expect(silent, 'a childless tag stopped drawing the containment diagnostic').toEqual([]);

      // CONTROL FOUR — the census has a population. Guards against a registry
      // that failed to load, which would make every list below vacuously empty.
      expect(rows.length).toBeGreaterThan(100);
    },
    CENSUS_TIMEOUT,
  );
});

describe('the ratchet: no NEW undeclared container (objectui#6779)', () => {
  it(
    'every tag that renders children while omitting `isContainer` is already on the list',
    async () => {
      const rows = await census();
      const baseline = readBaseline();
      const known = new Set([
        ...Object.keys(baseline.undeclared),
        ...Object.keys(baseline.excluded),
      ]);

      // THE LOAD-BEARING ASSERTION. A registration that renders an authored
      // child list while declaring it takes none makes `validateTree` LIE, and a
      // warning that lies is worse than a missing one because it trains authors
      // — AI authors especially — to discount the TRUE `not-a-container` reports
      // (objectui#3900's reasoning). Adding your tag to the baseline is NOT the
      // fix: declare `isContainer: true` on its registration.
      const unexpected = violators(rows).filter((t) => !known.has(t));
      expect(
        unexpected,
        'new undeclared container(s) — declare `isContainer` on the registration, do not list them',
      ).toEqual([]);
    },
    CENSUS_TIMEOUT,
  );

  it(
    'every listed tag still violates — a fixed entry is dead weight and fails too',
    async () => {
      const rows = await census();
      const baseline = readBaseline();
      const violating = new Set(violators(rows));

      // The OTHER direction, and the half that makes this a ratchet rather than
      // an exemption list: once a tag is fixed, its line has to go. Without this
      // the file would accumulate stale entries and quietly stop describing
      // anything, which is how an exemption list is born.
      const stale = Object.keys(baseline.undeclared).filter((t) => !violating.has(t));
      expect(
        stale,
        'these no longer violate — delete their lines from the baseline (the list may only shrink)',
      ).toEqual([]);
    },
    CENSUS_TIMEOUT,
  );

  it(
    'nothing on the list is public, so paying one off deletes no injected identifier',
    async () => {
      const rows = await census();
      const baseline = readBaseline();
      const byType = new Map(rows.map((r) => [r.type, r]));

      // The premise the ruling's cost estimate rests on, pinned rather than
      // trusted: `renderers/layout/react-page.tsx` builds the JSX scope of every
      // `kind:'react'` page with `if (!tag || cfg.isContainer) continue;` over
      // `getPublicConfigs()`, so declaring the flag on a PUBLIC tag also removes
      // its injected wrapper. For all 44 listed tags it provably removes
      // nothing, which is why they are mechanically fixable one at a time.
      const publicOnList = Object.keys(baseline.undeclared).filter((t) => byType.get(t)?.isPublic);
      expect(
        publicOnList,
        'a listed tag became public — declaring it now deletes a react-page identifier; re-triage before fixing',
      ).toEqual([]);

      // Direction control. Without it "none of them is public" is
      // indistinguishable from "the public tier is empty / this reader broke".
      const isPublic = publicTags();
      expect(isPublic.size).toBeGreaterThan(0);
      expect(isPublic.has('button')).toBe(true);
    },
    CENSUS_TIMEOUT,
  );
});

describe('`button` is EXCLUDED by ruling — permanently, and with its ground (objectui#6804)', () => {
  it(
    'still renders children, still undeclared, still the only public one of the 45',
    async () => {
      const rows = await census();
      const baseline = readBaseline();
      const button = rows.find((r) => r.type === 'button');

      // objectui#6779's ruling (2026-08-29) carved `button` out of the ratchet
      // list and ordered a separate card. objectui#6804 IS that card, and its
      // 2026-08-30 ruling SETTLED the question: `button` does not declare
      // `isContainer`, permanently. The ground — recorded in full in the
      // baseline's `reason` field, which is where a reader who opens the ledger
      // will look — is that `isContainer` means LAYOUT CONTAINMENT, while
      // `button` reads `children` only as a fallback for `schema.label`, so
      // declaring it would make one predicate mean two different things; that it
      // is the only public-tier member of the 45, so the declaration would also
      // delete `Button` from the JSX scope of every `kind:'react'` page; and
      // that the pull the other way measured zero.
      //
      // ⇒ The `issue` field points at the card that RULED it (#6804), not at the
      // one that deferred it (#6779, named in the reason as provenance): a
      // reader following this pointer wants the decision, not the deferral.
      //
      // The ruling covers 14 tags — `button` plus the 13 `schema.body` readers —
      // but only `button` is LISTED here, and that is not an omission: the other
      // 13 do not violate today, and listing a non-violator trips the OTHER
      // direction of the baseline's red. They are pinned as non-violators by the
      // `schema.body` readers block below instead.
      expect(Object.keys(baseline.excluded)).toEqual(['button']);
      expect(baseline.excluded.button.issue).toBe('objectui#6804');

      // Pinned as a live description rather than as prose, so the exclusion
      // cannot outlive its reason. These three are exactly the facts the ruling
      // rests on; if any one of them stops being true, this goes RED and the
      // exception must be RE-RULED rather than quietly re-based on a premise
      // that no longer holds. That is what keeps a REASONED exception
      // distinguishable from an oversight — and their indistinguishability is
      // the mechanism behind this class's three independent rediscoveries
      // (objectui#3900 / objectui#6740 / objectui#6764).
      expect(button?.rendersChildren, '`button` no longer renders children').toBe(true);
      expect(button?.isContainer, '`button` now declares `isContainer` — resolve the exclusion').toBe(
        false,
      );
      expect(button?.isPublic, '`button` left the public tier — the reason for the exclusion is gone').toBe(
        true,
      );

      // And it is NOT on the ratchet list — the ruling put it outside, so a
      // later hand that quietly moves it in would be overriding the ruling.
      expect(Object.keys(baseline.undeclared)).not.toContain('button');
    },
    CENSUS_TIMEOUT,
  );
});

describe('the predicate is RUNTIME, so the exception shapes need no skip-list (objectui#6779)', () => {
  // Every assertion in this block is a pin on the PREDICATE, not on the tags.
  // The ruling requires that `tabs`, the void tags and the `schema.body` readers
  // are not swept in; measured here, the runtime predicate already excludes all
  // of them because none puts an authored child on the page. Replace it with the
  // source-side "renders children OR body" spelling and these go red — which is
  // the whole point of keeping them.

  it('`tabs` renders `items[].content`, so a child list under it is genuinely unrendered', async () => {
    // `not-a-container` on `tabs` is TRUE and must survive. It is also public,
    // so sweeping it in would delete `<Tabs>` from every react page as well.
    expect(await rendersChildren('tabs')).toBe(false);
    expect(diagnose(withChildren('tabs')).map((d) => d.code)).toContain(CONTAINMENT);
  });

  it.each(['img', 'hr', 'br'])('the void tag `%s` stays a non-container', async (type) => {
    // These come out of the SAME `basic/html-elements.tsx` loop factory as 34
    // tags that do render children, and the factory skips `renderChildren` for
    // them by design (`VOID_TAGS`). A census at file granularity — the
    // granularity a static reader can reach — would declare all 37 together and
    // tell authors that `<br>` accepts children.
    expect(await rendersChildren(type)).toBe(false);
    expect(diagnose(withChildren(type)).map((d) => d.code)).toContain(CONTAINMENT);
  });

  it('the `schema.body` readers stay non-containers — `body` is a key the check never inspects', async () => {
    // The other 13 of objectui#6804's 14, and the population a "children or
    // body" predicate would collapse: these render `renderChildren(schema.body)`
    // and never touch `schema.children`. That 2026-08-30 ruling gives them the
    // SAME answer as `button` — no `isContainer` — but they get no baseline
    // entry while they do not violate, because listing a non-violator is the
    // other direction of that file's red. If objectui#6771's retirement of the
    // `body` dialect gives one of them a `children` read, that is when it earns
    // a reasoned entry of its own. ⚠️ Two of them are PUBLIC — `badge` and
    // `alert` — so that change would be moving published contract, not a
    // mechanical fix. That is a measurement, so it is pinned rather than
    // asserted in prose: see the block below.
    // `validateTree`'s containment branch is guarded by `node.children?.length`
    // ALONE, so no author writing `body` on them has ever drawn a false
    // diagnostic. Measured: 13 bare keys, not the 10 objectui#6779 estimated —
    // the `sidebar-` family is 11 keys, not 8.
    const bodyReaders = ['badge', 'alert', ...bareTags().filter((t) => t.startsWith('sidebar'))];
    expect(bodyReaders.length).toBe(13);
    for (const type of bodyReaders) {
      expect(await rendersChildren(type), `\`${type}\` started rendering children`).toBe(false);
      expect(diagnose(withChildren(type)).map((d) => d.code), type).toContain(CONTAINMENT);
    }
  }, CENSUS_TIMEOUT);
});

describe('the public tier of the ruled 14 is THREE, not one (objectui#6804)', () => {
  // The baseline's ⚠️ paragraph tells whoever implements objectui#6771 that two of
  // the 13 tags they are about to give a `children` read are PUBLISHED CONTRACT.
  // That is a measurement, and this file's convention — set by the 44's own
  // paragraph, "measured; the pin asserts it" — is that a measured claim in the
  // ledger names the pin holding it. Unpinned, the warning goes quietly false the
  // day `badge` or `alert` leaves the public tier, in the one sentence written to
  // stop an unmeasured public-tier change. That is this card's own defect shape one
  // level up: a claim nothing can distinguish from a stale one.
  //
  // Read off the LIVE REGISTRY rather than off `PUBLIC_BLOCKS`, because the list is
  // the INPUT and the registry is the FACT, and this is precisely a population
  // where the two differ: `getPublicConfigs()` keys the contract by the curated tag
  // it was listed under, so the namespaced `page:sidebar` enters the public set
  // under THAT spelling while the bare `sidebar` registration never does. Grepping
  // the list would score all 12 sidebar keys off one entry that belongs to none of
  // them.
  it('`badge` and `alert` are public; the 11 bare `sidebar-*` keys are not', async () => {
    const rows = await census();
    const byType = new Map(rows.map((r) => [r.type, r]));
    const isPublic = publicTags();

    // DIRECTION CONTROL, first and for the same reason the 44's block carries one:
    // without it, "the sidebar keys are not public" is indistinguishable from "this
    // reader returned nothing", and every absence below would pass vacuously.
    // `button` is the known positive — it is the fact the exclusion above rests on.
    expect(isPublic.size).toBeGreaterThan(0);
    expect(isPublic.has('button'), 'the public reader resolved nothing — every absence below is vacuous').toBe(
      true,
    );

    // (1) The two public body readers. `button` is the only public tag among the 45
    // VIOLATIONS, but not the only public tag among the ruled 14 — that is the
    // distinction the baseline note now draws and this holds it.
    for (const type of ['badge', 'alert']) {
      expect(
        byType.get(type)?.isPublic,
        `\`${type}\` left the public tier — the baseline's ⚠️ public-tier paragraph is now false, fix it`,
      ).toBe(true);
    }

    // (2) …and the eleven that are not, so "three" is a count and not a guess.
    const sidebars = bareTags().filter((t) => t.startsWith('sidebar'));
    expect(sidebars.length, 'the `sidebar-*` family changed size — re-measure the note').toBe(11);
    expect(
      sidebars.filter((t) => byType.get(t)?.isPublic),
      'a bare `sidebar-*` key became public — declaring it would now delete a react-page identifier',
    ).toEqual([]);
    expect(['button', 'badge', 'alert'].filter((t) => byType.get(t)?.isPublic).length).toBe(3);

    // (3) And why that is not the whole sidebar story: the sidebar that IS public is
    // the namespaced registration, and it already declares the flag — so it is not
    // in this containment story at all, and a reader who finds `page:sidebar` in
    // `PUBLIC_BLOCKS` must not conclude the bare family is public too.
    expect(isPublic.has('page:sidebar')).toBe(true);
    expect(
      ComponentRegistry.getMeta('page:sidebar')?.isContainer,
      '`page:sidebar` stopped declaring containment — it is now part of this story',
    ).toBe(true);
  }, CENSUS_TIMEOUT);
});

describe('the baseline file is a ratchet, and says so (objectui#6779)', () => {
  it('carries the shrink-only contract in its own note', () => {
    // A reader who opens the file must not be able to mistake it for an
    // exemption list — that is the single misreading the ruling wrote two
    // sentences to prevent, and prose is the only place it can be prevented.
    const note = readBaseline().note.join(' ');
    expect(note).toContain('RATCHET TO ZERO, NOT AN EXEMPTION LIST');
    expect(note).toContain('red in BOTH directions');
  });

  it('dates every entry, so the list carries its own history', () => {
    // The ruling asked for a dated column: an entry dated later than this
    // card is one somebody admitted afterwards, and needs a ruling of its own.
    const baseline = readBaseline();
    const entries = Object.entries(baseline.undeclared);
    expect(entries.length).toBeGreaterThan(0);
    for (const [type, entry] of entries) {
      expect(entry.since, `\`${type}\` has no \`since\` date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.issue, `\`${type}\` has no owning issue`).toMatch(/^objectui#\d+$/);
    }
  });
});
