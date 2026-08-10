import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here — see
// objectui#3494.
import {
  analyze,
  ExtractionError,
  forwardedKeys,
  runtimeReadKeys,
  retiredKeys,
  uiActionViewKeys,
  JUSTIFIED,
  KNOWN_GAPS,
  OPAQUE_SPREADS,
  SURFACES,
  RUNTIME_CONSUMERS,
} from '../check-action-forward-parity.mjs';

/**
 * objectui#4050 — the behaviour test for `scripts/check-action-forward-parity.mjs`.
 *
 * The gate answers "does this renderer forward every authored key the runtime
 * will read off the def it is handed?", which nothing else in the repo can:
 * `actionKeys.pin.test.ts` pins the ActionDef INTERFACE, and the renderers'
 * own tests drive one renderer each. Six keys shipped dropped one at a time —
 * `bodyExtra` (objectstack#6837), `bodyShape` (#6938), `resultDialog`
 * (objectui#3646), `label`/`description` (objectui#4192) — every one of them
 * green, because a dropped key parses, publishes and reads as honoured.
 *
 * Two properties are pinned here, and they fail for different reasons:
 *
 *   1. The VERDICTS, against synthetic repos. Every red the gate can produce is
 *      driven from a fixture rather than from whatever `main` happens to contain
 *      today — so a fix that makes the real tree green cannot also make the rule
 *      unexercised. That is the objectui#4690 anti-pattern this card's ruling
 *      names outright: "extraction failure is red, never a silent pass".
 *
 *   2. NON-VACUITY on the real repo. A gate whose inputs collapse to empty sets
 *      passes everything: if the owed set were empty, or the runtime-read set
 *      were, the whole diff would be `∅ − x = ∅` on every surface forever. The
 *      last describe holds the real measurements above the floor where that
 *      becomes possible.
 *
 * The extraction-failure cases are the ones worth reading before widening the
 * gate. Each is a way the gate could have been made to pass while reading
 * NOTHING — an unresolved spread taken for an empty object, a renamed binding
 * taken for "the runtime reads no keys", a moved `execute()` call taken for "no
 * payload, nothing owed" — and each is asserted to throw rather than return a
 * clean verdict.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The two authorable vocabularies, injected so fixtures need no spec package. */
const SPEC = {
  declared: ['name', 'type', 'target', 'undoable', 'bodyShape', 'objectName'],
  inline: ['name', 'type', 'target'],
};

interface Fixture {
  /** `path -> contents`, relative to the synthetic root. */
  readonly files: Record<string, string>;
}

/** Builds a throwaway tree and runs the REAL `analyze()` over it. */
function withRepo<T>(fixture: Fixture, run: (root: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-action-forward-parity-'));
  try {
    for (const [rel, contents] of Object.entries(fixture.files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents);
    }
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const UI_VIEW = 'packages/types/src/ui-action.ts';
const KEYS_MODULE = 'packages/core/src/actions/actionKeys.ts';
const CONSUMER = 'packages/core/src/actions/ActionRunner.ts';
const RENDERER = 'packages/components/src/renderers/action/action-x.tsx';

/** A synthetic repo whose only variable is the renderer's forward payload. */
function repoWith(
  forwards: string,
  overrides: Partial<Record<'view' | 'keys' | 'consumer', string>> = {},
): Fixture {
  return {
    files: {
      [UI_VIEW]:
        overrides.view ??
        'export interface ActionSchema {\n  name?: string;\n  description?: string;\n}\n',
      [KEYS_MODULE]:
        overrides.keys ?? "export const RETIRED_ACTION_KEYS = {\n  execute: 'renamed to target',\n};\n",
      [CONSUMER]:
        overrides.consumer ??
        [
          'export function run(action: any, list: any[]) {',
          '  const { target } = action;',
          '  if (action.undoable && action.description) return target;',
          '  return list.filter((a) => a.locations).map((a) => a.icon);',
          '}',
        ].join('\n'),
      [RENDERER]: `export const R = () => { void execute(${forwards}); };\n`,
    },
  };
}

const declaredSurface = [{ id: 'action:x', contract: 'declared', file: RENDERER }];
const inlineSurface = [{ id: 'action:x', contract: 'inline', file: RENDERER }];

/** `analyze` over a fixture, with the fixture's own tables. */
function judge(
  fixture: Fixture,
  options: Record<string, unknown> = {},
): { errors: string[]; report: { owed: string[]; forwarded: string[]; unexcused: string[] }[] } {
  return withRepo(fixture, (root) =>
    analyze(root, {
      spec: SPEC,
      surfaces: declaredSurface,
      consumers: [{ file: CONSUMER, binding: 'action' }],
      justified: {},
      knownGaps: {},
      opaqueSpreads: {},
      uiActionView: UI_VIEW,
      actionKeysModule: KEYS_MODULE,
      ...options,
    }),
  );
}

// -- the owed set -------------------------------------------------------------

describe('owed = authorable ∩ runtime-read − retired', () => {
  it('is green when the payload carries every owed key', () => {
    const { errors, report } = judge(repoWith('{ target, undoable, description }'));
    expect(errors).toEqual([]);
    // `name`/`type`/`bodyShape`/`objectName` are authorable but never read here;
    // `locations`/`icon` are read off a DIFFERENT binding. Neither is owed.
    expect(report[0].owed).toEqual(['description', 'target', 'undoable']);
  });

  it('names the surface and the dropped key when one is missing', () => {
    const { errors } = judge(repoWith('{ target, description }'));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('action:x');
    expect(errors[0]).toContain('`undoable`');
    expect(errors[0]).toContain(RENDERER);
  });

  it('counts a key the runtime reads but nobody can author as the runner`s own mechanic', () => {
    // `chain` is read off the def and is in no authorable vocabulary: forwarding
    // it is nobody's job. This is the half objectstack#6975 called underivable —
    // a grep over the consumer would have reported it as owed.
    const fixture = repoWith('{ target, undoable, description }', {
      consumer: [
        'export function run(action: any) {',
        '  if (action.chain) return action.chain;',
        '  const { target } = action;',
        '  return action.undoable && action.description ? target : null;',
        '}',
      ].join('\n'),
    });
    const { errors, report } = judge(fixture);
    expect(report[0].owed).not.toContain('chain');
    expect(errors).toEqual([]);
  });

  it('never owes a retired key, even when it is authorable and still read', () => {
    const fixture = repoWith('{ target, undoable, description }', {
      consumer: [
        'export function run(action: any) {',
        '  const { target } = action;',
        '  if (action.execute) return action.execute;',
        '  return action.undoable && action.description ? target : null;',
        '}',
      ].join('\n'),
      keys: "export const RETIRED_ACTION_KEYS = {\n  execute: 'renamed to target',\n};\n",
    });
    // Authorable in the fixture's declared vocabulary AND read — owed but for the
    // tombstone, which makes authoring it a parse rejection rather than a drop.
    const { errors, report } = judge(fixture, { spec: { ...SPEC, declared: [...SPEC.declared, 'execute'] } });
    expect(report[0].owed).not.toContain('execute');
    expect(errors).toEqual([]);
  });

  it('gives an inline surface the narrower vocabulary — the `element:button` split, derived', () => {
    // The same tree, the same payload. Declared owes `undoable`; inline does not
    // have the key in its vocabulary at all, so it is green without an exemption
    // — objectstack#6975 expected this to need a registered exception.
    const fixture = repoWith('{ target }');
    expect(judge(fixture, { surfaces: declaredSurface }).errors).toHaveLength(1);
    const inline = judge(fixture, { surfaces: inlineSurface });
    expect(inline.errors).toEqual([]);
    expect(inline.report[0].owed).toEqual(['target']);
  });

  it('reads the renderer view as authorable too, not only the spec shape', () => {
    // `description` is declared by `@object-ui/types`' renderer view and by no
    // spec schema — and it is half of objectui#4192. A gate reading only the
    // spec would call it unowed and stay green on the real defect.
    const fixture = repoWith('{ target, undoable }');
    const { errors } = judge(fixture);
    expect(errors[0]).toContain('`description`');
  });
});

// -- binding scope ------------------------------------------------------------

describe('reads are scoped to the binding the def arrives as', () => {
  it('ignores property reads off a different identifier in the same file', () => {
    // The distinction objectstack#6975 measured as impossible: `a.locations` is
    // read off the AUTHORED list (to decide what renders), `action.target` off
    // the FORWARDED def. Only the second is a forwarding contract, and grep sees
    // one set.
    const { union } = withRepo(repoWith('{ target }'), (root) =>
      runtimeReadKeys(root, [{ file: CONSUMER, binding: 'action' }]),
    );
    expect([...union].sort()).toEqual(['description', 'target', 'undoable']);
    expect(union.has('locations')).toBe(false);
    expect(union.has('icon')).toBe(false);
  });

  it('collects destructured reads as well as property access', () => {
    const { union } = withRepo(
      repoWith('{ target }', {
        consumer: 'export function run(action: any) {\n  const { toast: t, openIn } = action;\n  return [t, openIn];\n}\n',
      }),
      (root) => runtimeReadKeys(root, [{ file: CONSUMER, binding: 'action' }]),
    );
    expect([...union].sort()).toEqual(['openIn', 'toast']);
  });
});

// -- the two registries -------------------------------------------------------

describe('JUSTIFIED and KNOWN_GAPS are ratcheted, not free passes', () => {
  const dropping = repoWith('{ target, description }'); // drops `undoable`

  it('a justified omission is excused', () => {
    const { errors } = judge(dropping, {
      justified: { 'action:x:undoable': { reason: 'unreachable behind a guard', issue: 1 } },
    });
    expect(errors).toEqual([]);
  });

  it('a known gap is excused', () => {
    const { errors } = judge(dropping, {
      knownGaps: { 'action:x:undoable': { reason: 'filed, not fixed here', issue: 1 } },
    });
    expect(errors).toEqual([]);
  });

  it('a JUSTIFIED entry that excuses nothing is itself a failure', () => {
    // The registry cannot outlive the code it excuses — objectstack#6975's
    // objection was that the registry becomes the drift-prone list one level up.
    const { errors } = judge(repoWith('{ target, undoable, description }'), {
      justified: { 'action:x:undoable': { reason: 'stale — the key is forwarded now', issue: 1 } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('excuses nothing');
    expect(errors[0]).toContain('action:x:undoable');
  });

  it('a KNOWN_GAPS entry that excuses nothing is itself a failure', () => {
    const { errors } = judge(repoWith('{ target, undoable, description }'), {
      knownGaps: { 'action:x:undoable': { reason: 'stale — closed', issue: 4202 } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('no longer a gap');
    expect(errors[0]).toContain('#4202');
  });

  it('an OPAQUE_SPREADS entry matching no spread is itself a failure', () => {
    const { errors } = judge(repoWith('{ target, undoable, description }'), {
      opaqueSpreads: { 'action:x:ghost': { reason: 'nothing spreads this' } },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('matches no spread');
  });
});

// -- extraction failure is red, never a silent pass ---------------------------

describe('extraction failure throws rather than returning a clean verdict', () => {
  it('an unresolvable spread is not treated as an empty object', () => {
    // The silent-pass shape the ruling forbids: a spread may carry ANY key, so
    // reading it as `{}` would let a renderer forward nothing and pass.
    expect(() => judge(repoWith('{ target, ...mystery }'))).toThrow(ExtractionError);
    expect(() => judge(repoWith('{ target, ...mystery }'))).toThrow(/cannot resolve the spread/);
  });

  it('but an OPAQUE_SPREADS entry declares one whose source cannot carry action keys', () => {
    const { errors } = judge(repoWith('{ target, undoable, description, ...mystery }'), {
      opaqueSpreads: { 'action:x:mystery': { reason: 'the host context bag, not the action' } },
    });
    expect(errors).toEqual([]);
  });

  it('resolves a conditional payload fragment and unions BOTH branches', () => {
    // `action:button` routes params through exactly this shape; counting only one
    // branch would report a forwarded key as dropped.
    const fixture: Fixture = {
      files: {
        ...repoWith('{}').files,
        [RENDERER]:
          'export const R = () => {\n' +
          '  const frag = cond ? { undoable } : { description };\n' +
          '  void execute({ target, ...frag });\n' +
          '};\n',
      },
    };
    const { errors, report } = judge(fixture);
    expect(report[0].forwarded).toEqual(['description', 'target', 'undoable']);
    expect(errors).toEqual([]);
  });

  it('a moved or non-literal forward site is red, not "nothing owed"', () => {
    expect(() => judge(repoWith('payload'))).toThrow(/expected exactly one/);
    expect(() => judge({ files: { ...repoWith('{}').files, [RENDERER]: 'export const R = () => {};\n' } })).toThrow(
      /expected exactly one/,
    );
  });

  it('a split surface with two forward sites is red — each payload needs its own entry', () => {
    const fixture: Fixture = {
      files: {
        ...repoWith('{}').files,
        [RENDERER]: 'export const R = () => {\n  void execute({ target });\n  void execute({ undoable });\n};\n',
      },
    };
    expect(() => judge(fixture)).toThrow(/found 2/);
  });

  it('a renamed binding is red, not a runtime that reads nothing', () => {
    // The whole-gate vacuity case: an empty read set makes every owed set empty
    // and every surface green forever.
    const fixture = repoWith('{ target }', {
      consumer: 'export function run(def: any) {\n  return def.target;\n}\n',
    });
    expect(() => judge(fixture)).toThrow(/no reads of/);
  });

  it('a consumer that moved is red, not a silently smaller owed set', () => {
    expect(() =>
      judge(repoWith('{ target, undoable, description }'), {
        consumers: [
          { file: CONSUMER, binding: 'action' },
          { file: 'packages/app-shell/src/hooks/gone.tsx', binding: 'action' },
        ],
      }),
    ).toThrow(/does not exist/);
  });

  it('a renderer view with no properties is red', () => {
    expect(() => judge(repoWith('{ target }', { view: 'export interface ActionSchema {}\n' }))).toThrow(
      /declares no properties/,
    );
  });

  it('a renamed renderer view is red', () => {
    expect(() => judge(repoWith('{ target }', { view: 'export interface Other { name?: string }\n' }))).toThrow(
      /not found/,
    );
  });

  it('a missing RETIRED_ACTION_KEYS is red — a tombstone would be reported as owed', () => {
    expect(() => judge(repoWith('{ target }', { keys: 'export const OTHER = {};\n' }))).toThrow(
      /RETIRED_ACTION_KEYS/,
    );
  });

  it('an empty owed set is red — a vacuously green surface is the #4690 shape', () => {
    // Authorable and runtime-read do not intersect at all: nothing would ever be
    // checked for this surface again.
    expect(() =>
      judge(repoWith('{ target }', { view: 'export interface ActionSchema {\n  nothingReadsThis?: string;\n}\n' }), {
        spec: { declared: ['norThis'], inline: [] },
      }),
    ).toThrow(/owed set is empty/);
  });
});

// -- the real repository ------------------------------------------------------

describe('the real repository', () => {
  const real = analyze(repoRoot);

  it('is green', () => {
    expect(real.errors).toEqual([]);
  });

  it('measures a non-empty owed set for every surface — nothing is vacuously green', () => {
    expect(real.report).toHaveLength(SURFACES.length);
    for (const r of real.report) {
      expect(r.owed.length, `${r.surface.id} owes nothing`).toBeGreaterThan(5);
      expect(r.forwarded.length, `${r.surface.id} forwards nothing`).toBeGreaterThan(5);
    }
  });

  it('reads a plausible number of keys off the real consumers', () => {
    expect(RUNTIME_CONSUMERS.length).toBeGreaterThan(2);
    expect(real.runtimeRead.size).toBeGreaterThan(20);
    for (const consumer of RUNTIME_CONSUMERS) {
      expect(real.perFile.get(consumer.file)?.size ?? 0, `${consumer.file} read nothing`).toBeGreaterThan(0);
    }
  });

  it('every JUSTIFIED and KNOWN_GAPS entry carries a reason and an issue', () => {
    // An entry without one is indistinguishable from the drift being gated.
    for (const [key, meta] of [...Object.entries(JUSTIFIED), ...Object.entries(KNOWN_GAPS)]) {
      expect(meta.reason.length, `${key} has no reason`).toBeGreaterThan(80);
      expect(typeof meta.issue, `${key} cites no issue`).toBe('number');
    }
    for (const [key, meta] of Object.entries(OPAQUE_SPREADS)) {
      expect(meta.reason.length, `${key} has no reason`).toBeGreaterThan(40);
    }
  });

  it('holds objectui#4192: action:menu owes AND forwards the two keys that title a param dialog', () => {
    const menu = real.report.find((r) => r.surface.id === 'action:menu');
    expect(menu, 'action:menu is no longer a surface').toBeDefined();
    for (const key of ['label', 'description']) {
      expect(menu?.owed, `action:menu no longer owes ${key}`).toContain(key);
      expect(menu?.forwarded, `action:menu dropped ${key} again`).toContain(key);
    }
  });

  it('holds the inline contract: element:button is green on the narrower vocabulary', () => {
    const inline = real.report.find((r) => r.surface.id === 'element:button');
    expect(inline?.owed.length).toBeGreaterThan(5);
    expect(inline?.unexcused).toEqual([]);
    // Derived, not exempted — the point of the surface-class split.
    expect(Object.keys(JUSTIFIED).some((k) => k.startsWith('element:button:'))).toBe(false);
  });

  it('the real extractors read the real files', () => {
    expect(retiredKeys(repoRoot)).toContain('execute');
    expect(uiActionViewKeys(repoRoot)).toContain('description');
    for (const surface of SURFACES) {
      expect(forwardedKeys(repoRoot, surface).size, `${surface.id} forwards nothing`).toBeGreaterThan(5);
    }
  });
});

// -- wiring -------------------------------------------------------------------

describe('the gate is wired to run', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const ci = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');

  it('package.json exposes it as a named script', () => {
    expect(pkg.scripts['check:action-forward-parity']).toBe('node scripts/check-action-forward-parity.mjs');
  });

  it('ci.yml runs it after the install it needs (it resolves @objectstack/spec)', () => {
    const install = ci.indexOf('pnpm install --frozen-lockfile');
    const step = ci.indexOf('run: pnpm check:action-forward-parity');
    expect(step, 'ci.yml does not run `pnpm check:action-forward-parity`').toBeGreaterThan(-1);
    expect(step, 'the check runs before dependencies are installed').toBeGreaterThan(install);
  });

  it('is not hidden from the renderers by ci.yml path filters', () => {
    // ci.yml `paths-ignore`s markdown, content/, docs/, apps/site/ and
    // .changeset/. None can match `packages/components/src/renderers/**`, so a PR
    // that edits a forward whitelist always starts this workflow.
    const ignored = (ci.slice(0, ci.indexOf('jobs:')).match(/^\s+- '.*'$/gm) ?? []).map((line) =>
      line.trim().replace(/^- '/, '').replace(/'$/, ''),
    );
    expect(ignored.length, 'the paths-ignore parse found nothing — this pin would be vacuous').toBeGreaterThan(3);

    /** `**` crosses separators, `*` does not — enough for the five patterns above. */
    const matches = (glob: string, file: string): boolean =>
      new RegExp(
        `^${glob
          .split('**')
          .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
          .join('.*')}$`,
      ).test(file);

    for (const surface of SURFACES) {
      for (const glob of ignored) {
        expect(matches(glob, surface.file), `${glob} hides ${surface.file}`).toBe(false);
      }
      // The matcher itself must be able to say yes, or the loop above proves
      // nothing — the vacuity trap this whole file is about.
      expect(matches('**/*.md', 'content/docs/guide/ci-cd-pipeline.md')).toBe(true);
    }
  });
});
