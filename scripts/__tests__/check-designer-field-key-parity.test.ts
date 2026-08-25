import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FieldSchema, ObjectSchema } from '@objectstack/spec/data';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here.
import {
  ExtractionError,
  KNOWN_UNPARSEABLE_KEYS,
  PAYLOAD_SHAPES,
  analyze,
  declaredKeys,
  fieldSchemaAcceptSet,
  objectSchemaAcceptSet,
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

describe('the second oracle — objectui#6223', () => {
  const OBJECT_WIRE = {
    id: 'FixtureObjectPayload',
    file: 'object-payload.ts',
    interface: 'FixtureObjectPayload',
    schema: 'ObjectSchema' as const,
    reach: 'wire' as const,
    writer: 'fixture',
  };
  const OBJECT_UI = {
    id: 'FixtureObjectUi',
    file: 'object-ui.ts',
    interface: 'FixtureObjectUi',
    schema: 'ObjectSchema' as const,
    reach: 'ui' as const,
    writer: 'fixture',
  };

  it('resolves the very same `ObjectSchema` object `@objectstack/spec/data` exports', async () => {
    // Reference identity, exactly as for the field oracle: `plugin-designer`
    // declares its own `ServerObjectSchema` subset type, which is one of this
    // gate's INPUTS and must never be mistaken for its oracle. A structural
    // check could not tell the two apart; `===` can. This also keeps the second
    // oracle on the ESM build for the same dual-package reason.
    const { schema } = await objectSchemaAcceptSet();
    expect(schema).toBe(ObjectSchema);
  });

  it('reads an object accept set that is REAL and DIFFERENT from the field one', async () => {
    // If the two oracles ever resolved to the same schema the object-level
    // check would be vacuous while looking like it ran, so the difference is
    // asserted rather than assumed.
    const { accept: objectKeys } = await objectSchemaAcceptSet();
    const { accept: fieldKeys } = await fieldSchemaAcceptSet();
    expect(objectKeys.has('fields')).toBe(true);
    expect(objectKeys.has('isSystem')).toBe(true);
    expect(objectKeys.has('group')).toBe(false);
    expect(objectKeys.has('zzzDefinitelyNotAKey')).toBe(false);
    expect(objectKeys.size).toBeGreaterThan(20);
    expect(objectKeys.size).not.toBe(fieldKeys.size);
  });

  it('is STRICT — an object document refuses unknown keys rather than stripping them', () => {
    const base = { name: 'account', label: 'Account', fields: { n: { type: 'text', label: 'N' } } };
    const stripped = ObjectSchema.safeParse({ ...base, zzzDefinitelyNotAKey: 1 });
    expect(stripped.success).toBe(false);
    expect(stripped.error?.issues.map((i) => i.code)).toContain('unrecognized_keys');
  });

  it('goes red on an object-level key the OBJECT schema refuses', async () => {
    // The objectui#6223 instance, as a negative control: `group` on an
    // object-level wire shape.
    await withFixture(
      { 'object-payload.ts': 'export interface FixtureObjectPayload {\n  name?: string;\n  label?: string;\n  group?: string;\n}\n' },
      async (dir) => {
        const { violations } = await analyze(dir, { shapes: [OBJECT_WIRE], ledger: {} });
        expect(violations.map((v) => `${v.key}:${v.oracle}`)).toEqual(['group:ObjectSchema']);
      },
    );
  });

  it('the same key really is refused by the real ObjectSchema, with `unrecognized_keys`', async () => {
    // The control above proves the GATE reports it. This one proves the key is
    // genuinely refused, so the gate is not red about something harmless.
    const parsed = ObjectSchema.safeParse({
      name: 'account',
      label: 'Account',
      fields: { n: { type: 'text', label: 'N' } },
      group: 'Sales',
    });
    expect(parsed.success).toBe(false);
    const issue = parsed.error?.issues.find((i) => i.code === 'unrecognized_keys');
    expect((issue as { keys: string[] }).keys).toContain('group');
  });

  it('routes each shape to ITS OWN oracle — `group` is legal on a field and refused on an object', async () => {
    // The one assertion that a single pooled accept set could not satisfy, and
    // the reason the second oracle is a per-shape property rather than a union.
    // `FieldSchema` accepts `group`; `ObjectSchema` does not. A gate that
    // checked every shape against a merged set would have stayed green on
    // exactly the three keys objectui#6223 found.
    expect(FieldSchema.safeParse({ type: 'text', label: 'L', group: 'Details' }).success).toBe(true);
    await withFixture(
      {
        'payload.ts': 'export interface FixturePayload {\n  type?: string;\n  label?: string;\n  group?: string;\n}\n',
        'object-payload.ts': 'export interface FixtureObjectPayload {\n  name?: string;\n  label?: string;\n  group?: string;\n}\n',
      },
      async (dir) => {
        const { violations } = await analyze(dir, { shapes: [WIRE_SHAPE, OBJECT_WIRE], ledger: {} });
        expect(violations.map((v) => `${v.shape}.${v.key}`)).toEqual(['FixtureObjectPayload.group']);
      },
    );
  });

  it('resolves REACH within an oracle, never across one', async () => {
    // `group` on an object UI model is uiOnly — but only because no OBJECT wire
    // shape declares it. A field wire shape declaring the same spelling must
    // not launder it into a violation, nor a violation into a uiOnly.
    await withFixture(
      {
        'payload.ts': 'export interface FixturePayload {\n  type?: string;\n  label?: string;\n  group?: string;\n}\n',
        'object-ui.ts': 'export interface FixtureObjectUi {\n  name?: string;\n  label?: string;\n  group?: string;\n}\n',
      },
      async (dir) => {
        const { violations, uiOnly } = await analyze(dir, { shapes: [WIRE_SHAPE, OBJECT_UI], ledger: {} });
        expect(violations).toEqual([]);
        expect(uiOnly.map((u) => `${u.shape}.${u.key}`)).toEqual(['FixtureObjectUi.group']);
      },
    );
  });

  it('and the object UI key becomes a violation the moment an object WIRE shape declares it', async () => {
    await withFixture(
      {
        'object-payload.ts': 'export interface FixtureObjectPayload {\n  name?: string;\n  label?: string;\n  group?: string;\n}\n',
        'object-ui.ts': 'export interface FixtureObjectUi {\n  name?: string;\n  label?: string;\n  group?: string;\n}\n',
      },
      async (dir) => {
        const { violations, uiOnly } = await analyze(dir, { shapes: [OBJECT_WIRE, OBJECT_UI], ledger: {} });
        expect(uiOnly).toEqual([]);
        expect(violations.map((v) => `${v.shape}.${v.key}`)).toEqual([
          'FixtureObjectPayload.group',
          'FixtureObjectUi.group',
        ]);
      },
    );
  });

  it('scopes a ledger entry to ITS oracle — one level\'s card must not absorb the other level\'s key', async () => {
    // Measured during objectui#6223's ablation, which is why it is pinned here.
    // `sortOrder` is refused at BOTH levels by two different schemas and is two
    // different cards (objectui#6045 field-level, objectui#6223 object-level).
    // With a name-keyed ledger, re-declaring the OBJECT-level key stayed green:
    // the field-level card's entry absorbed it in silence. That is the ledger
    // becoming a hiding place, which the header says it must never be.
    const FIELD_LEDGER = {
      zzzTwoLevelKey: { card: 'objectui#0000', oracle: 'FieldSchema', spec: null, note: 'fixture' },
    };
    await withFixture(
      {
        'payload.ts': 'export interface FixturePayload {\n  type?: string;\n  label?: string;\n  zzzTwoLevelKey?: string;\n}\n',
        'object-payload.ts': 'export interface FixtureObjectPayload {\n  name?: string;\n  label?: string;\n  zzzTwoLevelKey?: string;\n}\n',
      },
      async (dir) => {
        const { violations, staleLedger } = await analyze(dir, {
          shapes: [WIRE_SHAPE, OBJECT_WIRE],
          ledger: FIELD_LEDGER,
        });
        // The field-level occurrence is covered by its card...
        expect(staleLedger).toEqual([]);
        // ...and the object-level one is NOT, because the entry is not scoped to
        // that oracle. Exactly one violation, on the object shape.
        expect(violations.map((v) => `${v.shape}.${v.key}`)).toEqual([
          'FixtureObjectPayload.zzzTwoLevelKey',
        ]);
      },
    );
  });

  it('an entry scoped to an oracle no shape of that oracle declares is stale', async () => {
    // The other direction of the same scope. An ObjectSchema-scoped entry is
    // not kept alive by a FIELD shape that happens to declare the same
    // spelling, or the entry would outlive the refusal it was filed for.
    await withFixture(
      { 'payload.ts': 'export interface FixturePayload {\n  type?: string;\n  label?: string;\n  zzzTwoLevelKey?: string;\n}\n' },
      async (dir) => {
        const { staleLedger } = await analyze(dir, {
          shapes: [WIRE_SHAPE],
          ledger: {
            zzzTwoLevelKey: { card: 'objectui#0000', oracle: 'ObjectSchema', spec: null, note: 'fixture' },
          },
        });
        expect(staleLedger).toEqual([
          { key: 'zzzTwoLevelKey', reason: 'no payload shape declares it any more' },
        ]);
      },
    );
  });

  it('throws when the object oracle cannot be resolved — a missing schema is never a pass', async () => {
    await expect(
      analyze(repoRoot, {
        shapes: [OBJECT_WIRE],
        ledger: {},
        importSpec: async () => ({ FieldSchema }),
      }),
    ).rejects.toThrow(/no longer exports `ObjectSchema`/);
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

  it('carries an object-level oracle over both object wire shapes — objectui#6223', async () => {
    // The gate shipped for objectui#5761 had three field shapes and no object
    // shape, so the parent document those fields are nested in was unchecked.
    // If that ever regresses this assertion says so, rather than the next
    // object-level key being found by a user hitting a save-blocking 422.
    const objectShapes = PAYLOAD_SHAPES.filter((s) => s.schema === 'ObjectSchema');
    expect(objectShapes.map((s) => s.id).sort()).toEqual([
      'ObjectDefinition',
      'ObjectMetadataPayload',
      'ServerObjectSchema',
    ]);
    expect(objectShapes.filter((s) => s.reach === 'wire').map((s) => s.id).sort()).toEqual([
      'ObjectMetadataPayload',
      'ServerObjectSchema',
    ]);
    // Every shape names its oracle explicitly — an entry that forgot to would
    // silently fall back to the field schema and be checked against the wrong
    // accept set.
    for (const shape of PAYLOAD_SHAPES) {
      expect(shape.schema, `${shape.id} names no oracle`).toBeTruthy();
    }
  });

  it('keeps `group`, `sortOrder` and `relationships` on the UI model and off every object wire shape', async () => {
    // The structural claim objectui#6223 landed, asserted on the real tree
    // rather than on a fixture: the Object Manager may hold all three (they are
    // its display category, its display order, and a UI-model relationship
    // list), and no shape that becomes a PUT body may declare any of them.
    const { uiOnly, violations } = await analyze(repoRoot);
    const onObjectDefinition = uiOnly.filter((u) => u.shape === 'ObjectDefinition').map((u) => u.key);
    for (const key of ['group', 'sortOrder', 'relationships']) {
      expect(onObjectDefinition, `${key} left the UI model`).toContain(key);
      expect(violations.map((v) => v.key), `${key} is back on a wire shape`).not.toContain(key);
    }
    for (const id of ['ObjectMetadataPayload', 'ServerObjectSchema']) {
      const shape = PAYLOAD_SHAPES.find((s) => s.id === id)!;
      const { keys } = declaredKeys(repoRoot, shape);
      expect(keys, `${id} declares group`).not.toContain('group');
      expect(keys, `${id} declares sortOrder`).not.toContain('sortOrder');
      expect(keys, `${id} declares relationships`).not.toContain('relationships');
    }
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
      // objectui#6223: with two oracles, an entry that names none silently
      // defaults to the field one and can absorb an object-level key.
      expect(['FieldSchema', 'ObjectSchema'], `${key} names no oracle`).toContain(entry.oracle);
    }
  });
});
