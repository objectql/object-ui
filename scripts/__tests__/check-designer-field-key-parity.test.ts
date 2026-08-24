import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FieldSchema } from '@objectstack/spec/data';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here.
import {
  ExtractionError,
  KNOWN_UNPARSEABLE_KEYS,
  PAYLOAD_SHAPES,
  analyze,
  declaredKeys,
  fieldSchemaAcceptSet,
} from '../check-designer-field-key-parity.mjs';

/**
 * objectui#5761. The gate this file tests compares the keys a field designer's
 * statically declared payload shapes can emit against the keys the INSTALLED
 * `FieldSchema` accepts. Its whole value is that it goes red on a key the spec
 * refuses by name — and a parity check is the one gate shape that can be
 * catastrophically, invisibly vacuous:
 *
 *   - resolve the wrong symbol (a local structural look-alike rather than the
 *     spec's schema) and everything passes;
 *   - resolve a LOOSENED schema (non-strict zod object, `.passthrough()`) and
 *     everything passes;
 *   - fail to find the interface in a renamed file and, without the throw,
 *     "zero declared keys" reads as "zero bad keys".
 *
 * All three produce a confident green over a broken instrument. So this file
 * carries the negative controls as EXECUTABLE assertions rather than as prose,
 * exactly as the card required: an un-stripped `indexed` must be reported with
 * `unrecognized_keys`, a bogus key must be reported, and the resolved schema
 * must be provably the installed `@objectstack/spec` one.
 */

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, '..', '..');

/** Writes fixture sources to a throwaway dir and runs the REAL extractor over them. */
async function withFixture<T>(files: Record<string, string>, run: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'designer-field-parity-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      const full = path.join(dir, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents);
    }
    return await run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const WIRE_SHAPE = {
  id: 'FixturePayload',
  file: 'payload.ts',
  interface: 'FixturePayload',
  reach: 'wire' as const,
  writer: 'fixture',
};

const fixtureShape = (body: string) => ({
  files: { 'payload.ts': `export interface FixturePayload {\n${body}\n}\n` },
  shapes: [WIRE_SHAPE],
});

describe('the instrument is the installed FieldSchema, not a look-alike', () => {
  it('resolves the very same schema object `@objectstack/spec/data` exports', async () => {
    // Reference identity, not a structural comparison. The card measured that
    // `packages/plugin-designer` declares its own `ServerFieldSchema` subset
    // type — a look-alike that is one of this gate's INPUTS and must never be
    // mistaken for its oracle. A structural check could not tell them apart;
    // `===` can.
    //
    // This assertion is also what keeps the gate on the ESM build. It failed
    // when the gate resolved the spec through `createRequire`: `@objectstack/spec`
    // is dual-package, so `require` and `import` hand back two different module
    // instances of the same schema, and the gate was reading a build the app
    // never bundles. Structural equality would have been green for that.
    const { schema } = await fieldSchemaAcceptSet();
    expect(schema).toBe(FieldSchema);
  });

  it('reads the accept set off the schema itself, and it is a real subset of all strings', async () => {
    const { accept } = await fieldSchemaAcceptSet();
    // Non-vacuity in the other direction: a schema that accepted everything
    // would make every parity comparison trivially green.
    expect(accept.has('label')).toBe(true);
    expect(accept.has('placeholder')).toBe(true);
    expect(accept.has('indexed')).toBe(false);
    expect(accept.has('zzzDefinitelyNotAKey')).toBe(false);
    expect(accept.size).toBeGreaterThan(20);
  });

  it('is a STRICT schema — it refuses unknown keys rather than stripping them', async () => {
    // If `FieldSchema` ever became non-strict this gate would still be green
    // while the thing it guards stopped being true, so pin the behaviour that
    // makes key-level parity meaningful at all (objectstack#4001 closed the
    // silent-drop shape).
    const stripped = FieldSchema.safeParse({ type: 'text', label: 'L', zzzDefinitelyNotAKey: 1 });
    expect(stripped.success).toBe(false);
    expect(stripped.error?.issues.map((i) => i.code)).toContain('unrecognized_keys');
  });
});

describe('negative controls — the gate must go red on a refused key', () => {
  it('reports an un-stripped `indexed`, the objectui#4644 instance', async () => {
    const { files, shapes } = fixtureShape('  type?: string;\n  label?: string;\n  indexed?: boolean;');
    await withFixture(files, async (dir) => {
      const { violations } = await analyze(dir, { shapes, ledger: {} });
      expect(violations.map((v) => v.key)).toEqual(['indexed']);
    });
  });

  it('the same payload really is what the spec refuses, with `unrecognized_keys`', async () => {
    // The control above proves the GATE reports the key. This one proves the
    // key is genuinely refused by the real schema — otherwise the gate could be
    // red about something harmless.
    const parsed = FieldSchema.safeParse({ type: 'text', label: 'L', indexed: true });
    expect(parsed.success).toBe(false);
    const issue = parsed.error?.issues.find((i) => i.code === 'unrecognized_keys');
    expect(issue).toBeDefined();
    expect((issue as { keys: string[] }).keys).toContain('indexed');
  });

  it('reports a bogus key', async () => {
    const { files, shapes } = fixtureShape('  label?: string;\n  zzzDefinitelyNotAKey?: string;');
    await withFixture(files, async (dir) => {
      const { violations } = await analyze(dir, { shapes, ledger: {} });
      expect(violations.map((v) => v.key)).toEqual(['zzzDefinitelyNotAKey']);
    });
  });

  it('stays green on a shape whose every key the spec accepts', async () => {
    const { files, shapes } = fixtureShape('  type?: string;\n  label?: string;\n  placeholder?: string;');
    await withFixture(files, async (dir) => {
      expect((await analyze(dir, { shapes, ledger: {} })).violations).toEqual([]);
    });
  });
});

describe('reach classification — a UI-only key is not a wire violation', () => {
  const UI_SHAPE = { id: 'FixtureUi', file: 'ui.ts', interface: 'FixtureUi', reach: 'ui' as const, writer: 'fixture' };

  it('a refused key declared only on the UI model is reported as uiOnly, not as a violation', async () => {
    await withFixture(
      {
        'payload.ts': 'export interface FixturePayload {\n  label?: string;\n}\n',
        'ui.ts': 'export interface FixtureUi {\n  label?: string;\n  zzzUiOnlyKey?: string;\n}\n',
      },
      async (dir) => {
        const { violations, uiOnly } = await analyze(dir, { shapes: [WIRE_SHAPE, UI_SHAPE], ledger: {} });
        expect(violations).toEqual([]);
        expect(uiOnly.map((u) => u.key)).toEqual(['zzzUiOnlyKey']);
      },
    );
  });

  it('the SAME key becomes a violation the moment a wire shape declares it too', async () => {
    // This is what makes the uiOnly bucket safe to have: it is recomputed every
    // run from the wire shapes, never asserted once and trusted.
    await withFixture(
      {
        'payload.ts': 'export interface FixturePayload {\n  label?: string;\n  zzzUiOnlyKey?: string;\n}\n',
        'ui.ts': 'export interface FixtureUi {\n  label?: string;\n  zzzUiOnlyKey?: string;\n}\n',
      },
      async (dir) => {
        const { violations, uiOnly } = await analyze(dir, { shapes: [WIRE_SHAPE, UI_SHAPE], ledger: {} });
        expect(uiOnly).toEqual([]);
        expect(violations.map((v) => `${v.shape}.${v.key}`)).toEqual([
          'FixturePayload.zzzUiOnlyKey',
          'FixtureUi.zzzUiOnlyKey',
        ]);
      },
    );
  });
});

describe('the ledger ratchets in both directions', () => {
  const LEDGER = { zzzLedgeredKey: { card: 'objectui#0000', spec: null, note: 'fixture' } };

  it('a ledgered key is not a violation', async () => {
    const { files, shapes } = fixtureShape('  label?: string;\n  zzzLedgeredKey?: string;');
    await withFixture(files, async (dir) => {
      const { violations, staleLedger } = await analyze(dir, { shapes, ledger: LEDGER });
      expect(violations).toEqual([]);
      expect(staleLedger).toEqual([]);
    });
  });

  it('an entry whose key no shape declares any more is itself red', async () => {
    // Without this half the ledger becomes a place to hide: a key gets fixed,
    // the entry survives, and the same spelling is silently re-admitted the
    // next time someone declares it.
    const { files, shapes } = fixtureShape('  label?: string;');
    await withFixture(files, async (dir) => {
      const { staleLedger } = await analyze(dir, { shapes, ledger: LEDGER });
      expect(staleLedger).toEqual([
        { key: 'zzzLedgeredKey', reason: 'no payload shape declares it any more' },
      ]);
    });
  });

  it('an entry whose key the spec now accepts is red, naming that reason', async () => {
    // The objectui#4676 resolution shape: `placeholder` was refused, the
    // producer moved upstream, and the spec started accepting it. The entry
    // must not outlive the refusal.
    const { files, shapes } = fixtureShape('  label?: string;\n  placeholder?: string;');
    await withFixture(files, async (dir) => {
      const { staleLedger } = await analyze(dir, {
        shapes,
        ledger: { placeholder: { card: 'objectui#4676', spec: null, note: 'fixture' } },
      });
      expect(staleLedger).toEqual([{ key: 'placeholder', reason: '`FieldSchema` now accepts it' }]);
    });
  });
});

describe('extraction failure is an error, never a silent pass', () => {
  it('throws when the shape file does not exist', async () => {
    await withFixture({ 'unrelated.ts': '' }, async (dir) => {
      await expect(analyze(dir, { shapes: [WIRE_SHAPE], ledger: {} })).rejects.toThrow(ExtractionError);
    });
  });

  it('throws when the interface was renamed away — zero keys must not read as zero bad keys', async () => {
    await withFixture({ 'payload.ts': 'export interface SomethingElse {\n  indexed?: boolean;\n}\n' }, async (dir) => {
      await expect(analyze(dir, { shapes: [WIRE_SHAPE], ledger: {} })).rejects.toThrow(/not found in payload\.ts/);
    });
  });

  it('throws when the interface declares no properties', async () => {
    await withFixture({ 'payload.ts': 'export interface FixturePayload {}\n' }, async (dir) => {
      await expect(analyze(dir, { shapes: [WIRE_SHAPE], ledger: {} })).rejects.toThrow(/declares no properties/);
    });
  });
});

describe('the real shapes, on the real tree', () => {
  it('finds every declared shape and reads a non-trivial key set from each', async () => {
    for (const shape of PAYLOAD_SHAPES) {
      const { keys } = declaredKeys(repoRoot, shape);
      expect(keys.length, `${shape.id} declared no keys`).toBeGreaterThan(5);
      expect(keys, `${shape.id} is missing \`label\``).toContain('label');
    }
  });

  it('sees the index signature on `ServerFieldSchema` — coverage note 2 must stay true', async () => {
    // The gate's docblock claims a key reaching the payload only through a
    // spread is outside its reach. That claim is only honest while the spread
    // hole is real and visible; if the index signature ever goes away the
    // docblock needs rewriting, not this assertion relaxing.
    const server = PAYLOAD_SHAPES.find((s) => s.id === 'ServerFieldSchema');
    expect(server).toBeDefined();
    expect(declaredKeys(repoRoot, server!).indexSignature).toBe(true);
  });

  it('is green — every refused key on the tree is filed and ledgered', async () => {
    const { violations, staleLedger } = await analyze(repoRoot);
    expect(violations).toEqual([]);
    expect(staleLedger).toEqual([]);
  });

  it('every ledger entry names the card that owns its resolution', async () => {
    const entries = Object.entries(KNOWN_UNPARSEABLE_KEYS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, entry] of entries) {
      expect(entry.card, `${key} has no card`).toMatch(/^objectui#\d+$/);
      expect(entry.note, `${key} has no note`).toBeTruthy();
    }
  });
});
