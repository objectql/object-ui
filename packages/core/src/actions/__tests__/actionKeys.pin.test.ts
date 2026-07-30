/**
 * Pins the key inventory in `actionKeys.ts` to the two things it mirrors —
 * `ActionDef`'s own declarations and `@objectstack/spec`'s `ActionSchema`
 * (objectstack#4075 step 1).
 *
 * Why a test rather than a comment: a hand-maintained list that silently drifts
 * from the interface it claims to mirror is the exact "declared ≠ enforced"
 * failure this work is about. `ActionDef` cannot be enumerated at runtime — its
 * `[key: string]: any` widens `keyof` to `string | number` — so the list is data,
 * and this file is what makes the data true. Adding a field to `ActionDef`
 * without adding it here fails, by name.
 *
 * Discrimination proof for the guard below: with `ACTION_DEF_KEYS` complete these
 * pass; dropping any single entry (e.g. `target`) fails with
 * "ActionDef declares keys the inventory is missing: target".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import * as SpecUI from '@objectstack/spec/ui';
import {
  ACTION_DEF_KEYS,
  SPEC_ACTION_KEYS,
  NAVIGATION_ALIAS_KEYS,
  RETIRED_ACTION_KEYS,
  KNOWN_ACTION_KEYS,
  classifyActionKeys,
  warnOnUnknownActionKeys,
  resetActionKeyWarnings,
} from '../actionKeys';

const RUNNER = join(dirname(fileURLToPath(import.meta.url)), '..', 'ActionRunner.ts');

/** `ActionDef`'s declared property names, read off the interface itself. */
function declaredActionDefKeys(): string[] {
  const sf = ts.createSourceFile(RUNNER, readFileSync(RUNNER, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const stmt of sf.statements) {
    if (!ts.isInterfaceDeclaration(stmt) || stmt.name.text !== 'ActionDef') continue;
    return stmt.members
      .filter(ts.isPropertySignature)
      .map((m) => (m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : null))
      .filter((n): n is string => n !== null);
  }
  throw new Error('ActionDef interface not found in ActionRunner.ts');
}

/**
 * The spec's `ActionSchema` keys. `ActionSchema` is a lazy proxy that does not
 * forward `.shape`, so this walks zod internals to reach the object shape —
 * acceptable HERE (a test pins a fact) and deliberately not done in shipped code.
 */
function specActionKeys(): string[] {
  const seen = new Set<unknown>();
  const walk = (schema: unknown, depth = 0): string[] | null => {
    if (!schema || depth > 8 || seen.has(schema)) return null;
    seen.add(schema);
    const s = schema as Record<string, unknown>;
    const shapeOf = (v: unknown): string[] | null =>
      v && typeof v === 'object' ? Object.keys(v as object) : null;
    if (s.shape) return shapeOf(s.shape);
    const def = (s._def ?? s.def) as Record<string, unknown> | undefined;
    if (!def) return null;
    if (def.shape) return shapeOf(def.shape);
    for (const key of ['in', 'out', 'innerType', 'schema', 'left', 'right']) {
      const found = def[key] ? walk(def[key], depth + 1) : null;
      if (found) return found;
    }
    return null;
  };
  const keys = walk(SpecUI.ActionSchema);
  if (!keys) throw new Error('could not resolve @objectstack/spec/ui ActionSchema shape');
  return keys;
}

describe('action key inventory (objectstack#4075 step 1)', () => {
  it('ActionDef still has the index signature this inventory compensates for', () => {
    // The day this fails, step 3 has landed: `tsc` catches unknown keys itself
    // and the dev-mode warning (plus `executeScript`'s rename branch) can retire.
    expect(readFileSync(RUNNER, 'utf8')).toContain('[key: string]: any');
  });

  it('lists every key ActionDef declares', () => {
    const declared = declaredActionDefKeys();
    const missing = declared.filter((k) => !(ACTION_DEF_KEYS as readonly string[]).includes(k));
    const stale = (ACTION_DEF_KEYS as readonly string[]).filter((k) => !declared.includes(k));
    expect({ missing, stale }).toEqual({ missing: [], stale: [] });
  });

  it('lists every key the spec ActionSchema declares', () => {
    const spec = specActionKeys();
    const missing = spec.filter((k) => !(SPEC_ACTION_KEYS as readonly string[]).includes(k));
    const stale = (SPEC_ACTION_KEYS as readonly string[]).filter((k) => !spec.includes(k));
    // `missing` means the spec grew a key objectui does not know about; `stale`
    // means it dropped one. Either way the inventory has to be re-derived, and
    // the diff names exactly which key moved.
    expect({ missing, stale }).toEqual({ missing: [], stale: [] });
  });

  it('`execute` is still a live spec tombstone, so it must not count as known', () => {
    const parsed = SpecUI.ActionSchema.safeParse({
      name: 'mark_done',
      label: 'Mark Done',
      type: 'script',
      execute: 'markDone',
    });
    expect(parsed.success).toBe(false);
    expect(RETIRED_ACTION_KEYS).toHaveProperty('execute');
    expect(KNOWN_ACTION_KEYS.has('execute')).toBe(false);
  });

  it('keeps the navigation alias out of the spec vocabulary it is not part of', () => {
    // If the spec ever adopts one of these, it stops being objectui dialect and
    // this fails — naming the alias to retire, the same tripwire shape as
    // `ObjectUiLocalActionType`.
    const spec = specActionKeys();
    expect(NAVIGATION_ALIAS_KEYS.filter((k) => spec.includes(k))).toEqual([]);
  });
});

describe('unknown-key warning', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetActionKeyWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('says nothing about an action built only from recognized keys', () => {
    warnOnUnknownActionKeys({ name: 'save', type: 'api', target: '/api/v1/save', locations: ['record_header'] });
    expect(warn).not.toHaveBeenCalled();
  });

  it('names a typo that the compiler cannot see', () => {
    // `targt` type-checks today: ActionDef's index signature accepts it. Nothing
    // reads it, so the action runs and does nothing — #2169's shape.
    warnOnUnknownActionKeys({ name: 'save', type: 'script', targt: 'saveRecord' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('`targt`');
  });

  it('gives a retired key its rename prescription, not a bare "unknown"', () => {
    warnOnUnknownActionKeys({ name: 'mark_done', type: 'script', execute: 'markDone' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('rename the key to `target`');
  });

  it('warns once per action, not once per click', () => {
    for (let i = 0; i < 5; i++) warnOnUnknownActionKeys({ name: 'save', type: 'script', targt: 'x' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('still names a SECOND action carrying the same typo', () => {
    // Keying the warn-once memo on the keys alone would report `save` and stay
    // silent about `remove` — sending the author to fix the first symptom only.
    warnOnUnknownActionKeys({ name: 'save', type: 'script', targt: 'x' });
    warnOnUnknownActionKeys({ name: 'remove', type: 'script', targt: 'y' });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('"remove"');
  });

  it('is silent in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      warnOnUnknownActionKeys({ name: 'save', type: 'script', targt: 'x' });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('classifies unknown and retired keys separately', () => {
    expect(classifyActionKeys({ type: 'script', execute: 'a', targt: 'b' })).toEqual({
      unknown: ['targt'],
      retired: ['execute'],
    });
  });
});
