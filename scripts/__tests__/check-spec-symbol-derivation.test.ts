import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here.
import {
  CLAIM_ALLOW,
  CLAIM_PATTERNS,
  CLAIM_WINDOW,
  findClaim,
  normalizeDoc,
  scanFile,
  scanFileForClaims,
  scanFileForMemberCitations,
} from '../check-spec-symbol-derivation.mjs';

/**
 * objectui#4592. `check:spec-symbols` matches BY NAME, so a hand copy that was
 * RENAMED away from the spec's symbol has nothing for it to match.
 * `ViewNavigationConfig` (objectui#4588) was exactly that — the spec's six
 * navigation keys, hand-written, drifted on `mode`, under the comment "Aligned
 * with @objectstack/spec ListView.navigation" — and it passed every CI run
 * until a manual census found it.
 *
 * Rule 2 is the cheap instrument that sees it: the CLAIM in the doc comment,
 * with nothing structural behind it. This file is that rule's discrimination
 * proof — the shape it must catch, and the five shapes it must NOT.
 *
 * The structural alternative ("does this local type mirror a spec object's key
 * set, whatever it is called") was measured and rejected in the same card: 38
 * sites at >= 0.80 key overlap on the tree, nearly all legitimately distinct
 * layers. False-positive honesty matters more than catch rate here, which is
 * why the green cases below outnumber the red one five to one.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Writes fixture sources to a throwaway dir and runs the REAL scanner over them. */
function withFixture<T>(files: Record<string, string>, run: (paths: Record<string, string>) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-symbol-claims-'));
  try {
    const paths: Record<string, string> = {};
    for (const [name, contents] of Object.entries(files)) {
      const full = path.join(dir, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents);
      paths[name] = full;
    }
    return run(paths);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The spec export names the fixtures below refer to, faithful to the pinned
 * 17.0.0-rc.6: every name a fixture CITES and the spec really exports is here,
 * and the retired ones (`ReactionSchema`, `FeedItemSchema`, …) are deliberately
 * absent.
 *
 * Faithfulness became load-bearing in objectui#4607 and was not before. Until
 * then `specNames` was consulted only to decorate the message of a declaration
 * that had ALREADY failed the tie test, so a name missing from this map changed
 * nothing; now it decides whether the tie test applies at all. `ListView` is the
 * instance — cited by two green fixtures below, really exported by
 * `@objectstack/spec/ui`, and absent from this map until #4607 measured it.
 * Omitting a live name here makes a green fixture red for a reason that exists
 * nowhere but this map.
 */
const SPEC_NAMES = new Map<string, Set<string>>([
  ['NavigationConfig', new Set(['@objectstack/spec/ui'])],
  ['NavigationConfigSchema', new Set(['@objectstack/spec/ui'])],
  ['ListView', new Set(['@objectstack/spec/ui'])],
  // Kept when the 16.0.0 major removed the rest of the feed surface — the live
  // half of the objectui#4607 specimen.
  ['FeedItemType', new Set(['@objectstack/spec/data'])],
  ['FeedFilterMode', new Set(['@objectstack/spec/data'])],
]);

const scan = (file: string) => scanFileForClaims(file, SPEC_NAMES);

// ── The shape rule 1 cannot see ──────────────────────────────────────────────

describe('rule 2 catches a renamed hand-copy through its own alignment claim', () => {
  /**
   * objectui#4588's declaration, renamed. `mode` is REQUIRED here while the spec
   * publishes it input-optional (`NavigationModeSchema.default('page')`) — the
   * drift the comment's canonical claim hides.
   */
  const RENAMED_COPY = `
/**
 * Navigation configuration for row/item click behavior.
 * Aligned with @objectstack/spec ListView.navigation.
 */
export interface ViewNavigationConfig {
  mode: 'page' | 'drawer' | 'modal' | 'split' | 'popover' | 'new_window' | 'none';
  view?: string;
  preventNavigation?: boolean;
  openNewTab?: boolean;
  size?: 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  width?: string | number;
}
`;

  it('flags it, and names the declaration and the claim phrase', () => {
    withFixture({ 'objectql.ts': RENAMED_COPY }, ({ 'objectql.ts': file }) => {
      const found = scan(file);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('ViewNavigationConfig');
      expect(found[0].phrase.toLowerCase()).toBe('aligned with');
      expect(found[0].line).toBe(6);
    });
  });

  it('reports a claimed spec symbol the spec does not actually export', () => {
    withFixture(
      {
        'views.ts': `
/**
 * Reaction — An emoji reaction on a feed item.
 * Aligned with @objectstack/spec ReactionSchema.
 */
export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}
`,
      },
      ({ 'views.ts': file }) => {
        const found = scan(file);
        expect(found).toHaveLength(1);
        // The purest form of the planted premise: a canonical-sounding pointer
        // to a symbol that does not exist. No key-set comparison can see this,
        // because there is nothing on the other side to compare against.
        expect(found[0].dangling).toContain('ReactionSchema');
      }
    );
  });

  it('sees a claim split across doc-comment lines', () => {
    withFixture(
      {
        'wrapped.ts': `
/**
 * Navigation configuration for row/item click behavior, aligned
 * with @objectstack/spec ListView.navigation.
 */
export interface WrappedClaimConfig {
  mode: string;
  view?: string;
}
`,
      },
      ({ 'wrapped.ts': file }) => {
        expect(scan(file).map((f) => f.name)).toEqual(['WrappedClaimConfig']);
      }
    );
  });
});

// ── The shapes it must NOT flag ──────────────────────────────────────────────

describe('rule 2 stays green on everything that is not the defect', () => {
  it('a genuine z.infer derivation', () => {
    withFixture(
      {
        'derived.ts': `
import type { z } from 'zod';
import { NavigationConfigSchema } from '@objectstack/spec/ui';

/**
 * Navigation configuration for row/item click behavior.
 * Aligned with @objectstack/spec ListView.navigation.
 */
export type ViewNavigationConfig = z.infer<typeof NavigationConfigSchema>;
`,
      },
      ({ 'derived.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a SpecAuthoredInput derivation', () => {
    // `SpecAuthoredInput` is recognised by NAME (it is the repo's own helper for
    // binding a local type to a spec schema's authoring input), so the module it
    // comes from does not change the verdict. Spelled as the relative import a
    // file inside the react package would really use, and deliberately not as a
    // bare workspace specifier: `scripts-type-check.test.ts` pins that no file in
    // the scripts tsconfig program imports an `@object-ui` package, and it looks
    // for that import TEXT — so a fixture string carrying one trips it and would
    // move a CI step below the workspace build for no real dependency.
    withFixture(
      {
        'authored.ts': `
import type { SpecAuthoredInput } from '../spec-input';
import { NavigationConfigSchema } from '@objectstack/spec/ui';

/** Mirrors @objectstack/spec NavigationConfigSchema, on its authoring input. */
export type AuthoredNavigation = SpecAuthoredInput<typeof NavigationConfigSchema>;
`,
      },
      ({ 'authored.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('an interface that merely USES a spec type on a member', () => {
    // Deliberately weaker than rule 1, which requires a structural position.
    // Rule 2 asks only whether the declaration has ANY compile-time tie to what
    // it claims — a spec type on a member is a tie a spec change can break.
    withFixture(
      {
        'uses.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** List view node. Aligned with @objectstack/spec ListView. */
export interface ListViewNode {
  navigation?: NavigationConfig;
  columns?: string[];
}
`,
      },
      ({ 'uses.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a similarly shaped local type that claims nothing', () => {
    withFixture(
      {
        'resolved.ts': `
/** Fully resolved navigation state after defaults are applied. */
export interface ResolvedNavigationConfig {
  mode: 'page' | 'drawer' | 'modal';
  view?: string;
  preventNavigation?: boolean;
  openNewTab?: boolean;
  width?: string | number;
}
`,
      },
      ({ 'resolved.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a claim phrase that belongs to a DIFFERENT sentence than the spec mention', () => {
    // `ChartDataSeries` (packages/types/src/data-display.ts) is the live case: a
    // model citizen that documents its own rename, which a bare co-occurrence
    // test flags. The measured run confirmed both halves — proximity alone was
    // not enough, and the sentence test is what makes it green.
    withFixture(
      {
        'chart.ts': `
/**
 * One inline-data series — a display name plus the literal numbers to plot,
 * positionally aligned with the chart's \`categories\`. Renamed off
 * \`ChartSeries\`: \`@objectstack/spec/ui\` owns that name for a dataset-bound
 * series descriptor, which carries no \`data\` at all.
 */
export interface ChartDataSeries {
  name: string;
  data: number[];
  color?: string;
}
`,
      },
      ({ 'chart.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a renderer — a component is not a second declaration of the shape it draws', () => {
    // The judgement the rule-1 ALLOW entries for `AuthProvider` / `ListView` /
    // `UserFilters` already make, applied to prose.
    withFixture(
      {
        'ReactionPicker.tsx': `
/**
 * ReactionPicker — Emoji reaction selector and display.
 * Aligned with @objectstack/spec ReactionSchema.
 */
export function ReactionPicker() {
  return null;
}

/** Reaction badge. Aligned with @objectstack/spec ReactionSchema. */
export const ReactionBadge = () => null;
`,
      },
      ({ 'ReactionPicker.tsx': file }) => expect(scan(file)).toEqual([])
    );
  });

  it("a file licence banner cannot supply the claim for the file's first declaration", () => {
    withFixture(
      {
        'banner.ts': `
/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Types in this module are aligned with @objectstack/spec where they say so.
 */

export interface UnrelatedLocalShape {
  id: string;
  label?: string;
}
`,
      },
      ({ 'banner.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  // ── Rewritten deliberately, not deleted (objectui#6291) ──────────────────
  // This slot held the INVERSE pin — *"an unexported declaration — it publishes
  // no surface to be mistaken for the spec"* — asserting `scan()` returns `[]`
  // for the fixture below. It was a designed assertion, and its premise was
  // measured false (objectui#5899, census in PR #6284): a spec-alignment claim
  // is read by the next agent editing the FILE, not by an importer, so the
  // package boundary was never what made it dangerous. The three module-local
  // mirrors in `packages/react/src/spec-bridge/bridges/form-view.ts`
  // (objectui#5652) had drifted on three keys and INVERTED one arm — admitting
  // only the value the contract rejects — with this gate green throughout.
  //
  // The old fixture is kept verbatim below because it makes the point sharper
  // than any new one could: it re-exported the declaration on the very next
  // line (`export type { InternalNavigationConfig }`), so it DID publish a
  // surface. `hasExportModifier` never saw it, because the export was a
  // separate statement. The pin's own fixture contradicted the pin's own name.
  it('a module-local declaration carrying a claim IS flagged (objectui#6291)', () => {
    withFixture(
      {
        'internal.ts': `
/** Internal. Aligned with @objectstack/spec ListView.navigation. */
interface InternalNavigationConfig {
  mode: string;
  view?: string;
}
export const NAVIGATION_MODES = ['page', 'drawer'] as const;
export type { InternalNavigationConfig };
`,
      },
      ({ 'internal.ts': file }) => {
        const found = scan(file);
        expect(found.map((f: { name: string }) => f.name)).toEqual(['InternalNavigationConfig']);
        expect(found[0].phrase.toLowerCase()).toContain('aligned with');
      }
    );
  });

  // The half the retired pin was really holding: rule 2 must stay quiet on
  // module-local shapes, but for its OWN reasons — the renderer skip, the tie
  // test, and the absence of a claim — never because of an `export` keyword.
  // Each of the three below is module-local, and each is green on a different
  // precision rule. If dropping the export filter had widened the rule beyond
  // its stated boundary, these would have turned red with it.
  it('…and the precision rules, not the export keyword, are what keep locals green', () => {
    withFixture(
      {
        'locals.tsx': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** Local nav row. Aligned with @objectstack/spec ListView. */
interface LocalTiedShape {
  navigation?: NavigationConfig;
}

/** Local picker. Aligned with @objectstack/spec ReactionSchema. */
const LocalReactionPicker = () => null;

/** Fully resolved navigation state after defaults are applied. */
interface LocalNoClaim {
  mode: 'page' | 'drawer';
}

export type { LocalTiedShape, LocalNoClaim };
export { LocalReactionPicker };
`,
      },
      ({ 'locals.tsx': file }) => expect(scan(file)).toEqual([])
    );
  });
});

// ── The tie is judged against the symbols the claim CITES (objectui#4607) ────

/**
 * The tie test above is symbol-AGNOSTIC: it asks whether the declaration
 * references ANY spec-bound identifier. So a claim about symbol X passed on an
 * incidental reference to unrelated symbol Y — and the more spec-integrated a
 * declaration was, the weaker the check on its prose became.
 *
 * `FeedItem` (packages/types/src/views.ts) was the live specimen: it cited
 * `FeedItemSchema`, removed from `@objectstack/spec/data` in the 16.0.0 major,
 * and never appeared in a single gate run because one member is typed
 * `FeedItemType` — the one feed symbol the removal kept. Measured on
 * origin/main@92876f097 before this change, the scanner returned `0 findings`
 * for the fixture below; it returns the finding asserted here after it.
 */
describe('a claim citing only symbols the spec does not export is flagged despite a live tie', () => {
  /** The objectui#4607 specimen: dangling citation, live tie to a DIFFERENT symbol. */
  const FEED_ITEM_SPECIMEN = `
import type { FeedItemType } from '@objectstack/spec/data';

/**
 * FeedItem — A single item in the unified activity feed.
 * Aligned with @objectstack/spec FeedItemSchema.
 */
export interface FeedItem {
  id: string;
  type: FeedItemType;
  body?: string;
  createdAt: string;
}
`;

  it('(a) flags the specimen, and names the symbol the spec has dropped', () => {
    withFixture({ 'views.ts': FEED_ITEM_SPECIMEN }, ({ 'views.ts': file }) => {
      const found = scan(file);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('FeedItem');
      expect(found[0].phrase.toLowerCase()).toBe('aligned with');
      expect(found[0].dangling).toEqual(['FeedItemSchema']);
    });
  });

  it('(a) the tie itself is real — only the CITATION differs from a green declaration', () => {
    // The discrimination proof's other half, and the reason this rule is not
    // just "flag anything with a retired name in the comment": the fixture is
    // byte-identical to the one above except that the claim cites the symbol the
    // declaration is actually tied to. Same import, same member, same claim
    // phrase — green.
    withFixture(
      { 'views.ts': FEED_ITEM_SPECIMEN.replace('FeedItemSchema', 'FeedItemType') },
      ({ 'views.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('(c) a claim citing a LIVE symbol the declaration is tied to stays green', () => {
    withFixture(
      {
        'tied.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** Navigation node. Aligned with @objectstack/spec NavigationConfig. */
export interface TiedNavigationNode {
  navigation?: NavigationConfig;
  columns?: string[];
}
`,
      },
      ({ 'tied.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('(d) a claim citing a LIVE symbol while tied to a DIFFERENT live one stays green', () => {
    // The KNOWN NON-GOAL recorded on objectui#4607. This is a claim-vs-tie
    // MISMATCH, not a dangling citation: both symbols exist, so the claim points
    // at something real and the reader can check it. Judging these needs a
    // name-relatedness allowance for the legitimate `type: FeedItemType` shape,
    // where citation and tie are genuinely different-but-related symbols — a
    // different instrument, deliberately not built here.
    withFixture(
      {
        'mismatch.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** List view node. Aligned with @objectstack/spec ListView. */
export interface MismatchedListViewNode {
  navigation?: NavigationConfig;
  columns?: string[];
}
`,
      },
      ({ 'mismatch.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a claim naming no symbol at all is still governed by the tie test', () => {
    withFixture(
      {
        'unnamed.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** Navigation node, aligned with @objectstack/spec. */
export interface UnnamedClaimNode {
  navigation?: NavigationConfig;
}
`,
      },
      ({ 'unnamed.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('with no spec export set to check against, the rule stays out of the way', () => {
    // "Dangling" is a statement about the installed spec. Given no export set,
    // every citation would read as dangling and the rule would flag every claim
    // in the repo at once — a verdict manufactured from ignorance of the spec.
    withFixture({ 'views.ts': FEED_ITEM_SPECIMEN }, ({ 'views.ts': file }) => {
      expect(scanFileForClaims(file, new Map())).toEqual([]);
    });
  });
});

// ── The retirement-record idiom must never re-trigger the gate (#4597/#4606) ─

describe('(b) an honest provenance note is not a claim', () => {
  /**
   * PR #4606 rewrote eight comments that cited retired spec symbols so they
   * RECORD the retirement instead of vouching for the symbol. That idiom names
   * the dead symbol on purpose — it is the provenance a reader needs — so a rule
   * that turned on it would punish exactly the fix it is meant to produce. What
   * makes these green is that they claim nothing: no alignment phrase sits next
   * to a `@objectstack/spec` mention, so there is no claim to have anything
   * behind.
   */
  it('the @object-ui/i18n idiom — "authored against the protocol\'s X, retired in …"', () => {
    withFixture(
      {
        'spec-formatters.ts': `
/**
 * Plural forms for a single translation key, in CLDR categories.
 *
 * Local shape — authored against the protocol's \`PluralRuleSchema\`, retired in
 * 17.0.0-rc.6 (see the module doc), so there is nothing upstream to derive from.
 */
export interface SpecPluralRule {
  key: string;
  zero?: string;
  one?: string;
  other: string;
}
`,
      },
      ({ 'spec-formatters.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('the @object-ui/types idiom — "its cited X went with the 16.0.0 feed removal"', () => {
    withFixture(
      {
        'views.ts': `
import type { FeedItemType } from '@objectstack/spec/data';

/**
 * FeedItem — A single item in the unified activity feed.
 *
 * Local shape; its cited \`FeedItemSchema\` went with the 16.0.0 feed removal
 * (see the section banner). Only \`type\` is still protocol-bound, through the
 * \`FeedItemType\` import above.
 */
export interface FeedItem {
  id: string;
  type: FeedItemType;
  createdAt: string;
}
`,
      },
      ({ 'views.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  /**
   * The fixtures above are a copy of the idiom; these two are the REAL FILES.
   * A copy can drift from what shipped, and the guarantee #4607 owes #4606 is
   * about the tree, not about a paraphrase of it: the sharpened rule must be
   * green on the very comments that card wrote.
   *
   * If one of these ever fails, read it as a defect in the RULE first. The
   * rewordings are the honest retirement record the guard exists to produce, so
   * a rule that flags them has turned on its own remedy.
   */
  const REWORDED_BY_4606 = [
    '../../packages/types/src/views.ts',
    '../../packages/i18n/src/utils/spec-formatters.ts',
  ];

  it.each(REWORDED_BY_4606)('stays green on the real tree: %s', (rel) => {
    expect(scan(path.join(here, rel))).toEqual([]);
  });

  it('and those files still carry the provenance the pin is about', () => {
    // Deleting the comments outright would satisfy the pin above while throwing
    // away the record. Pin the idiom's load-bearing phrases too.
    const views = fs.readFileSync(path.join(here, REWORDED_BY_4606[0]), 'utf8');
    const i18n = fs.readFileSync(path.join(here, REWORDED_BY_4606[1]), 'utf8');
    expect(views).toContain('went with the 16.0.0 feed removal');
    expect(views).toContain('`FeedItemType` and `FeedFilterMode` were deliberately KEPT');
    expect(i18n).toContain('authored against the protocol');
    expect(i18n).toContain('retired in');
  });
});

// ── The claim detector itself ────────────────────────────────────────────────

describe('findClaim', () => {
  it('requires an @objectstack/spec mention — a bare claim phrase is not a spec claim', () => {
    expect(findClaim('/** Aligned with the column order used by the grid. */')).toBeNull();
  });

  it('requires the claim and the mention to be within CLAIM_WINDOW of each other', () => {
    const near = findClaim('/** Aligned with @objectstack/spec ListView.navigation */');
    expect(near).not.toBeNull();
    expect(near!.distance).toBeLessThanOrEqual(CLAIM_WINDOW);

    const filler = 'x'.repeat(CLAIM_WINDOW + 20);
    expect(findClaim(`/** Aligned with ${filler} @objectstack/spec ListView */`)).toBeNull();
  });

  it('reads the claim when the mention comes FIRST', () => {
    const claim = findClaim('/** Uses @objectstack/spec types and mirrors their key set */');
    expect(claim).not.toBeNull();
    expect(claim!.phrase.toLowerCase()).toBe('mirrors');
  });

  it('matches case-insensitively across the documented phrase family', () => {
    const phrases = [
      'Aligned with @objectstack/spec X',
      'aligns with @objectstack/spec X',
      'Spec-aligned X (mirrors @objectstack/spec XSchema)',
      'Mirrors `X` from @objectstack/spec/cloud',
      'matches `@objectstack/spec` `XSchema`',
      'identical to @objectstack/spec X',
      'kept in sync with @objectstack/spec X',
      'the canonical definition from @objectstack/spec',
      'the single source of truth in @objectstack/spec',
      'a copy of @objectstack/spec X',
      'conforms to @objectstack/spec X',
    ];
    for (const p of phrases) expect(findClaim(`/** ${p} */`), p).not.toBeNull();
  });

  it('every documented pattern is case-insensitive', () => {
    for (const pattern of CLAIM_PATTERNS) expect(pattern.flags, String(pattern)).toContain('i');
  });

  it("takes cited symbols from the mention's own sentence, not the next one", () => {
    // Live case: `ActionDef` (packages/core/src/actions/ActionRunner.ts) reads
    // "…mirroring `@objectstack/spec`'s `ActionSchema`. Open key set on a data
    // bag is correct". `Open` opens the NEXT sentence and is prose, not a
    // citation. This was harmless while `symbols` only decorated the failure
    // message; since objectui#4607 it decides whether the tie test applies, so a
    // scraped prose word could make a green declaration read as citing nothing
    // but symbols the spec does not export.
    const claim = findClaim(
      "/** A declared metadata contract mirroring `@objectstack/spec`'s `ActionSchema`. Open key set on a data bag is correct. */"
    );
    expect(claim).not.toBeNull();
    expect(claim!.symbols).toEqual(['ActionSchema']);
  });

  it('still reads a symbol followed by a dotted member path', () => {
    // The truncation must not fire on `ListView.navigation` — the `.` there is a
    // member separator, not a sentence end, which is why the test is
    // "terminator followed by whitespace or end", the same shape the
    // claim/mention sentence test uses.
    expect(findClaim('/** Aligned with @objectstack/spec ListView.navigation. */')!.symbols).toEqual(['ListView']);
  });

  it('KNOWN LIMITATION: a sentence that never terminates still donates prose words', () => {
    // `PageNodeSchema` (packages/types/src/layout.ts) is the live instance: the
    // claim line ends without punctuation and the next line continues "This is
    // the SDUI NODE, not the authored page DOCUMENT", so `normalizeDoc` joins
    // them into ONE sentence and the window scrapes three prose words.
    //
    // Pinned rather than fixed, and it costs nothing today: the claim also cites
    // `PageSchema`, which the spec DOES export, so the declaration is governed
    // by the tie test exactly as before. It would only matter for a comment that
    // cites no real symbol at all AND has an incidental live tie — measured at
    // zero instances repo-wide (objectui#4607). Tightening it further means
    // deciding what a citation LOOKS like, which is a different instrument.
    const claim = findClaim(
      '/**\n * Aligned with @objectstack/spec PageSchema\n *\n * This is the SDUI NODE, not the authored page DOCUMENT\n */'
    );
    expect(claim!.symbols).toEqual(['PageSchema', 'This', 'SDUI', 'NODE']);
  });
});

describe('normalizeDoc', () => {
  it('collapses comment syntax so a wrapped sentence reads as one line', () => {
    expect(normalizeDoc('/**\n * Aligned with\n * @objectstack/spec X.\n */')).toBe('Aligned with @objectstack/spec X.');
  });
});

// ── Governance, mirroring rule 1's ALLOW map ─────────────────────────────────

describe('CLAIM_ALLOW governance', () => {
  it('every entry is keyed package:symbol and carries a reason and an issue', () => {
    for (const [key, entry] of Object.entries(CLAIM_ALLOW)) {
      expect(key, key).toMatch(/^@[\w-]+\/[\w-]+:[A-Za-z_][\w]*$/);
      expect(entry.reason.length, key).toBeGreaterThan(80);
      expect(typeof entry.issue, key).toBe('number');
    }
  });

  it('stays small — a large allowlist is a second copy of the codebase, not a guard', () => {
    // The STOP condition recorded on objectui#4592: an instrument that needs
    // more than a handful of standing exemptions is bigger than the disease.
    expect(Object.keys(CLAIM_ALLOW).length).toBeLessThanOrEqual(10);
  });
});

describe('the guard file itself', () => {
  it('documents every claim pattern it matches in its header', () => {
    const source = fs.readFileSync(path.join(here, '../check-spec-symbol-derivation.mjs'), 'utf8');
    const header = source.slice(0, source.indexOf('import ts from'));
    for (const fragment of ['aligned with', 'mirrors', 'canonical', 'source of truth', 'conforms to']) {
      expect(header.toLowerCase(), fragment).toContain(fragment);
    }
  });
});


// ── Rule 1's module-local boundary and its two narrowings (objectui#6291) ────

/**
 * Rule 1 skipped every non-exported declaration until objectui#6291. The
 * measured cost of that filter (objectui#5899's census, PR #6284, re-taken on
 * the implementing commit): 25 module-local declarations under spec export
 * names, of which the four different-concept collisions got reasoned ALLOW
 * entries and 15 findings under 14 names went to the DEBT ledger.
 *
 * Dropping it is only safe because two structural narrowings landed with it, and
 * a narrowing is a statement about what this guard may NOT see. These cases are
 * that statement's proof — one red per widening, and one green per narrowing,
 * with the RED case for each narrowing's near neighbour sitting beside it. The
 * No fixture below re-exports its declaration. That is deliberate and worth a
 * line: a bare `export { X }` over a local import carries no module specifier,
 * so the barrel skip in `scanFile` (which fires only on
 * `export { X } from './x'`) misses it and records a SECOND finding at the
 * barrel. That hole predates objectui#6291 — it is why
 * `@object-ui/plugin-list:ListView` still matches an ALLOW entry while its two
 * renderer siblings' entries were deleted — and it is filed, not fixed here.
 * Re-exporting in a fixture would measure that hole instead of these narrowings.
 *
 * The near neighbours are the point: `rendersJsx` must not become "functions are
 * exempt" (that would silence `isContextToken` and `normalizeFilterOperator`,
 * both real mirrors), and `isPureAlias` must not become "type aliases are
 * exempt" (that would silence every hand-written union under a spec name).
 */
describe("rule 1 sees module-local declarations, and the narrowings say which it may not", () => {
  const RULE1_SPEC_NAMES = new Map<string, Set<string>>([
    ['ListView', new Set(['@objectstack/spec/ui'])],
    ['NavigationConfig', new Set(['@objectstack/spec/ui'])],
    ['isContextToken', new Set(['@objectstack/spec/data'])],
  ]);
  const scan1 = (file: string) =>
    (scanFile(file, RULE1_SPEC_NAMES) as { name: string; kind: string }[]).map((f) => ({
      name: f.name,
      kind: f.kind,
    }));

  it('a module-local hand-written declaration under a spec export name IS flagged', () => {
    // The objectui#5652 shape: an `interface` the spec owns the name of, never
    // exported, read by the next agent editing the file and drifting there.
    withFixture(
      {
        'local.ts': `
interface NavigationConfig {
  mode: string;
  view?: string;
}
`,
      },
      ({ 'local.ts': file }) =>
        expect(scan1(file)).toEqual([{ name: 'NavigationConfig', kind: 'interface' }])
    );
  });

  it('a module-local component that RENDERS the spec shape is not a second declaration of it', () => {
    withFixture(
      {
        'renderer.tsx': `
function ListView({ schema }: { schema: unknown }) {
  return <div data-schema={String(schema)} />;
}
const NavigationConfig = () => <span />;
`,
      },
      ({ 'renderer.tsx': file }) => expect(scan1(file)).toEqual([])
    );
  });

  it('…but a module-local FUNCTION that renders nothing is still a fork', () => {
    // The near neighbour that keeps `rendersJsx` from decaying into
    // `isRendererLike`. `isContextToken` (@object-ui/core) and
    // `normalizeFilterOperator` (@object-ui/data-objectstack) are the live
    // instances: non-exported functions under spec export names, both real
    // mirrors, both DEBT entries today. A blanket "functions are renderers"
    // would have made them invisible instead — silently, and for good.
    withFixture(
      {
        'predicate.ts': `
function isContextToken(token: string): boolean {
  return ['current_user_id', 'current_org_id'].includes(token);
}
`,
      },
      ({ 'predicate.ts': file }) =>
        expect(scan1(file)).toEqual([{ name: 'isContextToken', kind: 'function' }])
    );
  });

  it('a pure alias to a single identifier is derivation by delegation', () => {
    // `type FlowNode = FlowDesignerNode` restates nothing, and whatever it names
    // is judged at its own declaration site — the judgement this scanner already
    // makes for barrels, and the change the tree made in objectui#3202.
    withFixture(
      {
        'alias.ts': `
import type { CanvasNavigation } from './canvas.js';

type NavigationConfig = CanvasNavigation;
`,
      },
      ({ 'alias.ts': file }) => expect(scan1(file)).toEqual([])
    );
  });

  it('…but an alias that WIDENS, or restates anything, is not', () => {
    // The near neighbour that keeps `isPureAlias` from decaying into "type
    // aliases are exempt". `DashboardWidget = DashboardWidgetSchema & { id }`
    // (app-shell) is the live widening — it carries an ALLOW entry with its
    // reason rather than a structural pass, which is the governance this map
    // exists for.
    withFixture(
      {
        'widen.ts': `
import type { CanvasNavigation } from './canvas.js';

type NavigationConfig = CanvasNavigation & { id: string };
type ListView = 'table' | 'kanban' | 'calendar';
`,
      },
      ({ 'widen.ts': file }) =>
        expect(scan1(file)).toEqual([
          { name: 'NavigationConfig', kind: 'type' },
          { name: 'ListView', kind: 'type' },
        ])
    );
  });
});


// ── Rule 4 at MEMBER granularity (objectui#7513) ─────────────────────────────

/**
 * The AUTHORED key sets the fixtures below are judged against, measured on
 * `@objectstack/spec@17.2.0` with the same family union the guard uses (`N` /
 * `NSchema` / `NInput` / `NParsed`, authoring side).
 *
 * Trimmed to the keys the fixtures exercise, and the trim is one-directional on
 * purpose: every key a fixture cites AND expects green is listed, because
 * omitting one makes that fixture red for a reason that exists nowhere but this
 * map — the hazard `SPEC_NAMES` above records for symbol names, at member
 * granularity. Absences are the real measurements and are named in place:
 *
 *   SelectOption   5 keys, none of them `description`   — the option schema is
 *                  `.strict()`, so `description` on an option 422s the whole field
 *   Field          71 keys, none of them `rows`
 *   Dashboard      20 keys; the display name is `label`, never `title`
 */
const SPEC_MEMBERS = new Map<string, { authored: Set<string>; surface: Set<string> }>([
  [
    'SelectOption',
    {
      authored: new Set(['label', 'value', 'color', 'default', 'visibleWhen']),
      // Zod hangs `.description` on every schema. That it is HERE and not in
      // `authored` is the whole point of the ordering proof below.
      surface: new Set(['parse', 'safeParse', 'shape', 'description', 'default', 'optional']),
    },
  ],
  [
    'Field',
    {
      authored: new Set(['name', 'label', 'type', 'description', 'options', 'required', 'visibleWhen']),
      surface: new Set(['parse', 'safeParse', 'shape', 'description']),
    },
  ],
  [
    'Dashboard',
    {
      authored: new Set(['name', 'label', 'description', 'header', 'widgets', 'dateRange']),
      surface: new Set(['parse', 'safeParse', 'shape', 'description']),
    },
  ],
  // `NavigationMode` is a `ZodEnum` with a `.default('page')`, cited in prose as
  // a CALL. Its authored set is what the enum admits, never `default`.
  ['NavigationMode', { authored: new Set(['page', 'drawer', 'modal']), surface: new Set(['default', 'parse']) }],
  // A symbol that really declares `shape` as an authored key — the control that
  // proves the Zod vocabulary cannot override a real key.
  ['ChartAxis', { authored: new Set(['shape', 'label']), surface: new Set(['parse', 'safeParse', 'shape']) }],
]);

/** The guard's own resolver contract: family stem, or `null` when unknowable. */
const MEMBERS_OF = (name: string) =>
  SPEC_MEMBERS.get(name.replace(/(?:Schema|Input|Parsed)$/, '')) ?? null;

const citations = (file: string) =>
  scanFileForMemberCitations(file, MEMBERS_OF).map(
    (c: { symbol: string; member: string; line: number }) => `${c.symbol}.${c.member}@${c.line}`
  );

/**
 * ⭐ The bite leg. These are the VERBATIM comments the three measured specimens
 * carried before they were repaired (PR #7510 for the two in `field-types.ts`,
 * PR #7520 for `DashboardView.tsx`), copied out of those PRs' removed lines.
 *
 * A ratchet added with only a green assertion on today's tree proves nothing
 * about the tightening — the tree is green either way, including with the rule
 * deleted. These fixtures are the only thing in this file that can tell the
 * difference, which is why they are pinned as text rather than described.
 */
describe('rule 4 at member granularity goes RED on the pre-repair text', () => {
  it('flags `SelectOptionSchema.description` — the key a `.strict()` option schema refuses', () => {
    withFixture(
      {
        'field-types.ts': `
export interface SelectOptionMetadata {
  label: string;
  value: string;
  /**
   * Supporting text for the option. \`LookupField\` has always searched it and its
   * \`recordToOption\` emits the same key for fetched records — while this type
   * never declared it, so the behaviour was real for a key no annotated
   * literal could carry. Aligns \`@objectstack/spec\`
   * \`SelectOptionSchema.description\`; renderers may show it as supporting
   * text.
   */
  description?: string;
  color?: string;
}
`,
      },
      ({ 'field-types.ts': file }) => expect(citations(file)).toEqual(['SelectOptionSchema.description@5'])
    );
  });

  it('flags `FieldSchema.rows` on a MEMBER docblock, which no declaration-scoped scan reaches', () => {
    // Both of `field-types.ts`'s pre-repair citations, on two different member
    // docblocks. Rule 2 reads `attachedDoc(stmt)` on TOP-LEVEL statements only,
    // so it sees neither — and widening rule 2 to member docs is objectui#7513's
    // deferred B, deliberately not what makes these visible here.
    withFixture(
      {
        'field-types.ts': `
export interface MarkdownFieldMetadata {
  /**
   * Height of the editor, in text rows. The running widget honoured a key an
   * annotated literal rejected. Aligns the \`TextareaFieldMetadata\` precedent
   * and \`@objectstack/spec\` \`FieldSchema.rows\` (a positive integer, authorable
   * on exactly the multiline editor types textarea/markdown/html/richtext).
   */
  rows?: number;
}

export interface HtmlFieldMetadata {
  /**
   * Height of the INLINE editor, in text rows. \`RichTextField\` reads it for all
   * three registry keys it
   * serves, and \`@objectstack/spec\` \`FieldSchema.rows\` declares it for the
   * multiline editor types.
   */
  rows?: number;
}
`,
      },
      ({ 'field-types.ts': file }) =>
        expect(citations(file)).toEqual(['FieldSchema.rows@3', 'FieldSchema.rows@13'])
    );
  });

  it('flags `DashboardSchema.title` inside a FUNCTION BODY, with no claim phrase anywhere', () => {
    // The specimen that settles two design questions at once: the comment is not
    // attached to any declaration, and "Per @objectstack/spec, X is …" matches no
    // CLAIM_PATTERN. A rule that needed either would have missed it.
    withFixture(
      {
        'DashboardView.tsx': `
export function DashboardView() {
  const dashboard = load();
  // Per @objectstack/spec, DashboardSchema.title is "the dashboard
  // title displayed in the header". We prefer it when present, then
  // fall back to \`label\` (the metadata display name) and finally to
  // the raw \`name\`.
  return dashboard.title ?? dashboard.label ?? dashboard.name;
}
`,
      },
      ({ 'DashboardView.tsx': file }) => expect(citations(file)).toEqual(['DashboardSchema.title@4'])
    );
  });

  it('…and GREEN on the repaired wording that replaced each of them', () => {
    // The other half of the pair. Both replacements keep the spec mention and
    // keep naming the key — they just stop claiming the spec DECLARES it, which
    // is precisely the distinction the rule has to be able to draw.
    withFixture(
      {
        'repaired.ts': `
export interface SelectOptionMetadata {
  /**
   * Supporting text. \`@objectstack/spec\`'s \`SelectOptionSchema\` is \`.strict()\`
   * and declares \`label\`, \`value\`, \`color\`, \`default\` and \`visibleWhen\` — a
   * \`description\` on an option earns a 422 from the save route, so this key is
   * renderer-side only.
   */
  description?: string;
}

export function DashboardView() {
  // \`title\` is NOT a spec key — it is the LEGACY objectui spelling. Measured on
  // \`@objectstack/spec\` 17.2.0, \`DashboardSchema.label\` is the display name and
  // the document root refuses \`title\` by name.
  return 1;
}
`,
      },
      ({ 'repaired.ts': file }) => expect(citations(file)).toEqual([])
    );
  });
});

describe('rule 4 at member granularity — the precision rules, each against its near neighbour', () => {
  const one = (source: string, name = 'probe.ts') =>
    withFixture({ [name]: source }, (paths) => citations(paths[name]));

  it('a key the spec really declares is green', () => {
    expect(
      one(`
/** Aligns with \`@objectstack/spec\` \`DashboardSchema.label\` — the display name. */
export type X = string;
`)
    ).toEqual([]);
  });

  it('⭐ `.description` is NOT excused as Zod API, though Zod puts it on every schema', () => {
    // The near-miss that decided the exclusion's shape. A structural "any
    // property of the Zod type" predicate reads `SelectOptionSchema.description`
    // as Zod's own `.description` and waves through the citation this entire
    // rule was built for. Same for `.default`, `.type`, `.options`, `.readonly`.
    expect(
      one(`
/** Aligns \`@objectstack/spec\` \`SelectOptionSchema.description\`. */
export type X = string;
`)
    ).toEqual(['SelectOptionSchema.description@2']);
  });

  it('Zod API in CALL form is excused, which is how the shared names stay safe', () => {
    // `default` is a real spec key AND a real Zod method, so it can never go in
    // the vocabulary. The parentheses are what make this one an invocation.
    expect(
      one(`
/** The spec declares \`mode: NavigationModeSchema.default('page')\` — see \`@objectstack/spec\`. */
export type X = string;
`)
    ).toEqual([]);
  });

  it('…while a parenthetical AFTER a citation is still a citation', () => {
    // "\`FieldSchema.rows\` (a positive integer)" — a backtick and a space before
    // the paren is prose, not a call. One of the three specimens is written
    // exactly this way, so this is the difference between a bite and a no-op.
    expect(
      one(`
/** \`@objectstack/spec\` \`FieldSchema.rows\` (a positive integer). */
export type X = string;
`)
    ).toEqual(['FieldSchema.rows@2']);
  });

  it('bare Zod introspection vocabulary is excused', () => {
    expect(
      one(`
/** \`@objectstack/spec\`: \`FieldSchema.safeParse\` on a section returns \`unrecognized_keys\`. */
export type X = string;
`)
    ).toEqual([]);
  });

  it('…but the AUTHORED set answers first, so a real `shape` key is never excused by it', () => {
    // The ordering proof. `ChartAxis` declares `shape` as an authored key, so
    // `ChartAxis.shape` is green on the strength of the SHAPE, not the
    // vocabulary — and `ChartAxis.parse` stays excused beside it.
    expect(
      one(`
/** \`@objectstack/spec\` \`ChartAxis.shape\` and \`ChartAxis.parse\`. */
export type X = string;
`)
    ).toEqual([]);
    expect(
      one(`
/** \`@objectstack/spec\` \`ChartAxis.widget\`. */
export type X = string;
`)
    ).toEqual(['ChartAxis.widget@2']);
  });

  it('a FILE PATH is not a citation', () => {
    // `ui/TimelineConfig.json` is a file the comment points at; `json` is an
    // extension. Measured: four sites in the tree read this way.
    expect(
      one(`
/** \`scale\` is \`@objectstack/spec\` \`ui/DashboardSchema.json\`'s spelling. */
export type X = string;
`)
    ).toEqual([]);
  });

  it('a citation far from the spec mention is not a spec citation', () => {
    // `ListView.resolveTimelineDateBinding` (app-shell) is a method on this
    // repo's own component, 755 characters from an unrelated spec mention.
    expect(
      one(`
/**
 * This page reads \`@objectstack/spec\` metadata. Padding. Padding. Padding. Padding. Padding. Padding. Padding. Padding. Padding. Padding. Padding. Padding. 
 * \`DashboardSchema.resolveTimelineDateBinding\` is the single read-site.
 */
export type X = string;
`)
    ).toEqual([]);
  });

  it('…and neither is one on the far side of a sentence boundary', () => {
    expect(
      one(`
/** Renamed off \`@objectstack/spec\`. \`DashboardSchema.title\` is ours. */
export type X = string;
`)
    ).toEqual([]);
  });

  it('a comment that never mentions the spec is out of jurisdiction', () => {
    expect(
      one(`
/** Our own \`DashboardSchema.title\`, nothing to do with the protocol. */
export type X = string;
`)
    ).toEqual([]);
  });

  it('an unknowable member set keeps the rule out of the way entirely', () => {
    // The same judgement rule 4 makes with no spec export set at all: a verdict
    // fabricated from ignorance of the spec would flag every citation at once.
    expect(
      one(`
/** \`@objectstack/spec\` \`HttpRequestSchema.body\` carries it. */
export type X = string;
`)
    ).toEqual([]);
  });
});
