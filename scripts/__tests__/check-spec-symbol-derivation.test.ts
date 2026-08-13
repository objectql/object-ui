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
  scanFileForClaims,
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

/** The spec export names the fixtures below refer to. `ReactionSchema` is deliberately absent. */
const SPEC_NAMES = new Map<string, Set<string>>([
  ['NavigationConfig', new Set(['@objectstack/spec/ui'])],
  ['NavigationConfigSchema', new Set(['@objectstack/spec/ui'])],
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

  it('an unexported declaration — it publishes no surface to be mistaken for the spec', () => {
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
      ({ 'internal.ts': file }) => expect(scan(file)).toEqual([])
    );
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
