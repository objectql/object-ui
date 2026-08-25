#!/usr/bin/env node
/**
 * Every key a designer's statically declared payload shape can emit must be a
 * key the installed spec schema that judges that shape accepts by name.
 *
 * Two oracles, because the designers PUT a two-level document. A field shape is
 * judged by `FieldSchema`, the parent object document by `ObjectSchema`, and
 * each shape in {@link PAYLOAD_SHAPES} names the one that judges it. The gate
 * shipped for objectui#5761 carried only the field oracle, so nothing checked
 * the document those fields are nested in — and objectui#6223 then found three
 * object-level keys (`group`, `sortOrder`, `relationships`) that `ObjectSchema`
 * refuses by name, sitting on the wire the whole time the gate was green.
 *
 * The failure class (objectui#5761): a designer offers a control that
 * writes a key the spec refuses BY NAME. The author sees the control work
 * — and, in metadata-admin, sees the preview render it — then
 * `PUT /api/v1/meta/object/:name` returns a hard 422 `INVALID_METADATA` that
 * blocks EVERY subsequent save of that object until the key is stripped. The
 * author has no way to tell which key did it from the UI they were using.
 *
 * This repo has filed that same shape three times, and each instance took a
 * DIFFERENT correct resolution — which is what makes it a class rather than a
 * coincidence:
 *
 *   indexed          objectui#4644 — control retired + strip-on-load
 *   distance_metric  objectui#4687 — declaration removed (zero readers/writers)
 *   placeholder      objectui#4676 — producer moved: declared UPSTREAM,
 *                    objectstack#9019 / PR objectstack#9113, shipped in
 *                    `@objectstack/spec` 17.1.0
 *
 * What existed before this gate was three per-key tombstones, each keyed to one
 * literal: two independently maintained `RETIRED_FIELD_KEYS = ['indexed']` sets
 * (`packages/app-shell/src/views/metadata-admin/previews/object-fields-io.ts`
 * and `packages/plugin-designer/src/MetadataFieldsPage.tsx`) plus prose
 * tombstones in four more files. Every one of them was written AFTER an
 * instance was found in production. Nothing detected the next one, so instance
 * four would again be found by a user hitting a save-blocking 422 rather than
 * by CI.
 *
 * `scripts/check-spec-symbol-derivation.mjs` is NOT this guard and does not
 * overlap it: that one checks symbol NAME collisions between a local
 * declaration and a `@objectstack/spec` export. This one never looks at symbol
 * names — it compares KEY SETS, and the shapes it reads are deliberately named
 * nothing like the spec's.
 *
 * ── WHAT THIS GATE COVERS, AND WHAT IT DOES NOT ─────────────────────────────
 * Read this section before concluding that a key is safe because the gate is
 * green. The gate covers a SUBSET of the designer write path, and a guard that
 * reads as complete while covering a subset is the same declared-≠-actual
 * defect this file exists to close.
 *
 * COVERED — the statically declared payload shapes in {@link PAYLOAD_SHAPES}.
 * A key is visible to this gate when it is written as a property signature on
 * one of those interfaces. That is enough to have caught all three instances
 * above: `indexed` was a declared property of the designer field definition,
 * `distance_metric` a declared property, `placeholder` a declared property.
 *
 * NOT COVERED — four ways a key can reach the payload without ever appearing as
 * a declared property:
 *
 *   1. `patchDef({...})` spreads. `ObjectFieldInspector` writes through many
 *      conditional `patchDef({ ... })` calls onto a `Record<string, unknown>`
 *      def. A key that reaches the payload ONLY through such a spread is
 *      OUTSIDE THIS GATE'S REACH — nothing declares it, so there is no property
 *      signature to read. Enumerating that set is not mechanical, which is the
 *      honest limit objectui#5761 states rather than hides.
 *   2. Index signatures. `ServerFieldSchema` declares `[key: string]: unknown`
 *      and `fromDesignerField` spreads `prev` verbatim to preserve unknown
 *      keys, so any key the SERVER sent round-trips back out untyped. The gate
 *      records the presence of an index signature (see `indexSignature` in the
 *      analysis) precisely so this hole is visible in its own output, but it
 *      cannot enumerate what flows through one.
 *   3. Untyped `Record<string, unknown>` field defs. `object-fields-io.ts`'s
 *      `readFields`/`writeFields` carry raw defs with no declared shape at all.
 *      Its round-trip is covered instead by an executable parity test — see
 *      `object-fields-io.field-schema-parity.test.ts`, which parses real
 *      round-tripped output through the real `FieldSchema` and carries the
 *      negative controls this gate's self-test carries.
 *   4. Value-level rejections. This gate is a check on key NAMES only. A key in
 *      the accept set whose VALUE `FieldSchema` refuses (wrong type, failed
 *      refinement) is green here and still a 422 in production.
 *
 * ── The accept set is read from the schema, never listed here ───────────────
 * `FieldSchema` and `ObjectSchema` are strict zod objects: they refuse unknown
 * keys with `unrecognized_keys` rather than stripping them (objectstack#4001
 * closed the silent-drop shape). Each accept set is read off the schema's own
 * `shape` at run time.
 *
 * It is read through a dynamic `import()`, NOT `createRequire`, and that is
 * load-bearing rather than stylistic. `@objectstack/spec` is a dual-package
 * build: `require` lands on `dist/data/index.js`, `import` on
 * `dist/data/index.mjs`. Those are two different module instances of the same
 * schema, so a CJS-resolving gate cannot be proven — by identity — to be
 * reading the build the app bundles against, and the two could drift with
 * nothing to notice. Importing makes the self-test's `===` against a plain
 * `import { FieldSchema } from '@objectstack/spec/data'` a real proof of
 * provenance, which is the assertion that rules out the whole
 * wrong-symbol failure mode. This is why the exported functions are async. A hardcoded copy would be the stale second definition this whole
 * family of gates exists to prevent, and — worse for a parity check — a wrongly
 * resolved or loosened schema produces a CONFIDENT GREEN over everything. So
 * extraction failure is an ERROR, never a pass: {@link ExtractionError} is
 * thrown when the spec cannot be resolved, when the shape cannot be walked, or
 * when a shape file no longer declares the interface this gate reads.
 *
 * The self-test (`scripts/__tests__/check-designer-field-key-parity.test.ts`)
 * carries the non-vacuity controls as executable assertions: a fixture
 * declaring an un-stripped `indexed` must be reported, a fixture declaring a
 * bogus key must be reported, and the resolved schema must be the INSTALLED
 * `@objectstack/spec` `FieldSchema` rather than a local structural look-alike
 * (`plugin-designer`'s own `ServerFieldSchema` is such a look-alike — it is one
 * of this gate's INPUTS, never its oracle).
 *
 * ── The ledger, and why the gate is a ratchet rather than a bug report ──────
 * The first run over `main` surfaced live offenders. Fixing them is NOT this
 * gate's job and was explicitly out of scope when it was built: the three
 * instances above took three different correct resolutions, so choosing one for
 * a given key is an adjudication a tooling card does not carry. Each surfaced
 * key is instead filed as its own card and recorded in
 * {@link KNOWN_UNPARSEABLE_KEYS} with that card's number.
 *
 * The ledger ratchets in BOTH directions, which is what keeps it from becoming
 * a place to hide:
 *
 *   - a refused key on a wire-bound shape that is NOT in the ledger is red, so
 *     no NEW instance can land;
 *   - a ledger entry whose key is no longer refused, or no longer declared, is
 *     ALSO red, so a fixed key cannot leave a stale entry behind that would
 *     silently re-admit the same spelling later.
 */

import ts from "typescript";
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { isEntrypoint } from "./invoked-as.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

/** A gate that cannot read its inputs. Never a pass — see the header. */
export class ExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExtractionError";
  }
}

const fail = (message) => {
  throw new ExtractionError(message);
};

const readFile = (root, rel) => readFileSync(resolve(root, rel), "utf8");
const parse = (root, rel) =>
  ts.createSourceFile(rel, readFile(root, rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/**
 * The statically declared field payload shapes the designers write through.
 *
 * `reach` is what makes a finding actionable, and it is a claim about the
 * CODE, not a severity dial:
 *
 *   wire — the interface types a value that is handed to
 *          `client.meta.saveItem('object', …)`, i.e. it becomes the body of
 *          `PUT /api/v1/meta/object/:name`. A refused key declared here is a
 *          live 422 the moment the property is populated.
 *   ui   — the designer's in-memory model. Its keys reach the wire only
 *          through converters (`toFieldPayload`, `fromDesignerField`) whose
 *          RETURN TYPE is one of the `wire` shapes above, so a key declared
 *          here and on no `wire` shape cannot reach the payload through any
 *          statically declared path. Such keys are reported as `uiOnly` —
 *          visible, but not a violation. The moment one of them is added to a
 *          `wire` shape the `wire` scan catches it, so the classification is
 *          computed on every run rather than asserted once.
 */
export const PAYLOAD_SHAPES = [
  {
    id: "FieldMetadataPayload",
    file: "packages/app-shell/src/services/MetadataService.ts",
    interface: "FieldMetadataPayload",
    schema: "FieldSchema",
    reach: "wire",
    // `toFieldPayload` builds it; `saveFields` PUTs `fields.map(toFieldPayload)`
    // and `saveObject` PUTs it through `toObjectPayload`.
    writer: "MetadataService.saveFields / saveObject",
  },
  {
    id: "ServerFieldSchema",
    file: "packages/plugin-designer/src/MetadataFieldsPage.tsx",
    interface: "ServerFieldSchema",
    schema: "FieldSchema",
    reach: "wire",
    // `fromDesignerField` builds it; `MetadataFieldsPage` PUTs the assembled
    // `fields` map. Carries an index signature — see coverage note 2.
    writer: "MetadataFieldsPage.handleFieldsChange",
  },
  {
    id: "DesignerFieldDefinition",
    file: "packages/types/src/designer.ts",
    interface: "DesignerFieldDefinition",
    schema: "FieldSchema",
    reach: "ui",
    writer: "FieldDesigner (in-memory model)",
  },
  {
    id: "ObjectMetadataPayload",
    file: "packages/app-shell/src/services/MetadataService.ts",
    interface: "ObjectMetadataPayload",
    schema: "ObjectSchema",
    reach: "wire",
    // `toObjectPayload` builds it; `saveObject` PUTs it whole to
    // `PUT /api/v1/meta/object/:name`, fields nested inside.
    writer: "MetadataService.saveObject",
  },
  {
    id: "ServerObjectSchema",
    file: "packages/plugin-designer/src/MetadataObjectsPage.tsx",
    interface: "ServerObjectSchema",
    schema: "ObjectSchema",
    reach: "wire",
    // `handleObjectsChange` merges the manager's edits onto the raw server
    // payload and PUTs the result. Carries an index signature — coverage
    // note 2 applies here too, and with more force: this shape is BUILT by
    // spreading the server's own document.
    writer: "MetadataObjectsPage.handleObjectsChange",
  },
  {
    id: "ObjectDefinition",
    file: "packages/types/src/designer.ts",
    interface: "ObjectDefinition",
    schema: "ObjectSchema",
    reach: "ui",
    writer: "ObjectManager (in-memory model)",
  },
];

/**
 * Keys this gate surfaced on the tree it landed on, each with the card that
 * owns its resolution. NOT a suppression list: see the header's ratchet note —
 * an entry that stops applying is as red as a key that is missing one.
 *
 * `oracle` scopes the entry to the schema that refuses the key, defaulting to
 * `FieldSchema`. It is load-bearing, not decoration: `sortOrder` is refused at
 * BOTH levels by two different schemas, and they are two different cards with
 * two different resolutions. Without the scope, one card's entry would absorb
 * the other level's occurrence and the gate would stay green over it.
 *
 * `spec` records the accepted spelling where the spec has one, because that is
 * the fact a resolver needs first and the fact most likely to be wrong in a
 * hurry. It is documentation for the card, never an instruction to rename:
 * objectui#4687 shows that "delete the declaration" is sometimes the right
 * answer even when a near-spelling exists.
 */
export const KNOWN_UNPARSEABLE_KEYS = {
  // objectui#6043 `formula` was resolved and its entry removed. The resolution
  // was NOT the rename this ledger's `spec` column recorded as available, which
  // is the header's point about `spec` being documentation and never an
  // instruction: `FieldSchema` accepts `expression` without parsing the CEL in
  // it, so renaming would have shipped the retired control's `price * quantity`
  // placeholder — bare field refs that evaluate to null under the `record`
  // scope — under a valid key name. The control was removed instead; the field
  // TYPE `formula` is unaffected and remains a valid spec `FieldType`.
  sortOrder: {
    card: "objectui#6045",
    // Scoped to the FIELD oracle deliberately. `sortOrder` is refused at BOTH
    // levels and the two are different cards with different resolutions
    // (objectui#6223 removed the object-level one). An unscoped entry would let
    // this card's entry absorb an object-level reappearance in silence, which
    // is the ledger becoming the hiding place the header says it must not be.
    oracle: "FieldSchema",
    spec: null, // the spec has `sortable` (a boolean), and no field-level ordering key
    note: "Latent: declared and written by `toFieldPayload`, but nothing populates it, so JSON drops the undefined. One reorder feature away from live.",
  },
  enabled: {
    card: "objectui#6238",
    oracle: "ObjectSchema",
    // `ObjectSchema` DOES have `enable` — but it is `ObjectCapabilities`, a
    // system-features module object, not a boolean on/off flag. Recorded here
    // so the next reader does not mistake the near-spelling for a rename.
    spec: null,
    note: "Object-level, surfaced by the ObjectSchema oracle added in objectui#6223. `ObjectMetadataPayload` declares it and `deleteObject` / `deleteMetadataItem` write `{ enabled: false, _deleted: true }` directly, so the SOFT-DELETE path — not `toObjectPayload` — is what puts it on the wire. Not a rename: the spec's `enable` is a capabilities object, so what a soft delete should write is its own question.",
  },
};

/** The oracle names a shape may name, in the order they are reported. */
export const ORACLES = ["FieldSchema", "ObjectSchema"];

/**
 * The keys the INSTALLED schema named by `exportName` accepts, read off the
 * schema itself.
 *
 * Resolved through `@objectstack/spec/data` — the published subpath, the same
 * one the runtime parses with — so this is the schema that actually judges a
 * `PUT`, not a local look-alike. Extraction failure throws; see the header.
 */
export async function schemaAcceptSet(exportName, importSpec = (id) => import(id)) {
  let data;
  try {
    data = await importSpec("@objectstack/spec/data");
  } catch (err) {
    fail(
      "cannot resolve @objectstack/spec/data — run `pnpm install` first.\n" +
        "    This gate reads the spec's own schema; it has no hardcoded fallback by design.\n" +
        `    (${err && err.message})`
    );
  }
  const schema = data[exportName];
  if (!schema) {
    fail(
      `@objectstack/spec/data no longer exports \`${exportName}\` — the accept set cannot be derived.\n` +
        "    Re-point this gate at the schema that judges that payload; do NOT hardcode a key list."
    );
  }
  const keys = shapeKeys(schema);
  if (!keys || keys.length === 0) {
    fail(
      `could not resolve \`${exportName}\`'s shape from @objectstack/spec/data.\n` +
        "    The schema's internal representation changed. Fix the walk — falling back to a\n" +
        "    hardcoded key list would make this gate the stale copy it exists to prevent."
    );
  }
  return { schema, accept: new Set(keys), origin: specOrigin() };
}

/** {@link schemaAcceptSet} pinned to the field oracle. */
export async function fieldSchemaAcceptSet(importSpec = (id) => import(id)) {
  return schemaAcceptSet("FieldSchema", importSpec);
}

/** {@link schemaAcceptSet} pinned to the object oracle. */
export async function objectSchemaAcceptSet(importSpec = (id) => import(id)) {
  return schemaAcceptSet("ObjectSchema", importSpec);
}

/**
 * The file the accept set was read from, for the run log. `createRequire` is
 * used ONLY here — `import.meta.resolve` is not available in every Node this
 * repo runs on, and this string never feeds a comparison, only the output.
 */
function specOrigin() {
  try {
    return createRequire(import.meta.url).resolve("@objectstack/spec/package.json").replace(/package\.json$/, "");
  } catch {
    return "(unresolved)";
  }
}

/** Walk a zod schema's wrappers down to the object `shape` it carries. */
function shapeKeys(node, depth = 0, seen = new Set()) {
  if (!node || depth > 8 || seen.has(node)) return null;
  seen.add(node);
  const shapeOf = (v) => (v && typeof v === "object" ? Object.keys(v) : null);
  if (node.shape) return shapeOf(node.shape);
  const def = node._def ?? node.def ?? node._zod?.def;
  if (!def) return null;
  if (def.shape) return shapeOf(def.shape);
  for (const key of ["in", "out", "innerType", "schema", "left", "right"]) {
    const found = def[key] ? shapeKeys(def[key], depth + 1, seen) : null;
    if (found) return found;
  }
  return null;
}

/**
 * Property-signature names declared on one interface, plus whether it carries
 * an index signature (the untyped hole recorded in coverage note 2).
 *
 * The interface is searched for anywhere in the file, not only at top level:
 * `ServerFieldSchema` is a module-local, non-exported declaration in a `.tsx`,
 * and a top-level-statements-only walk would silently return nothing for it —
 * which for a parity gate reads as "this shape declares no bad keys".
 */
export function declaredKeys(root, shape) {
  const rel = shape.file;
  if (!existsSync(resolve(root, rel))) {
    fail(
      `${rel} does not exist — the payload shape \`${shape.interface}\` moved or was deleted.\n` +
        "    Re-point this gate at it; a missing input is never a pass."
    );
  }
  const sf = parse(root, rel);
  let decl = null;
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === shape.interface) decl = node;
    if (!decl) ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!decl) {
    fail(
      `\`interface ${shape.interface}\` not found in ${rel}.\n` +
        "    The payload shape moved or was renamed; re-point this gate at it."
    );
  }
  const keys = decl.members
    .filter(ts.isPropertySignature)
    .map((m) => (m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : null))
    .filter((n) => n !== null);
  if (keys.length === 0) {
    fail(`\`${shape.interface}\` in ${rel} declares no properties — extraction failed.`);
  }
  const indexSignature = decl.members.some((m) => ts.isIndexSignatureDeclaration(m));
  return { keys, indexSignature };
}

/** The oracle a shape names, defaulting to the field one for older entries. */
const oracleOf = (shape) => shape.schema ?? "FieldSchema";

/**
 * Compare every declared payload key against the accept set OF THE ORACLE THAT
 * JUDGES ITS SHAPE.
 *
 * Returns `{ accept, accepts, origin, shapes, violations, uiOnly, staleLedger }`.
 * `violations` is what makes the gate red; `uiOnly` and `staleLedger` are
 * reported too — `staleLedger` is red as well (see the header's
 * both-directions ratchet).
 *
 * Reach is resolved WITHIN an oracle, never across one. A key is `uiOnly` when
 * no wire shape *judged by the same schema* declares it: `group` is a legal
 * `FieldSchema` key and a refused `ObjectSchema` key at the same time, so a
 * single pooled wire-key set would have let an object-level key hide behind a
 * field-level shape that legitimately declares the same spelling.
 */
export async function analyze(root = REPO_ROOT, options = {}) {
  const shapes = options.shapes ?? PAYLOAD_SHAPES;
  const ledger = options.ledger ?? KNOWN_UNPARSEABLE_KEYS;
  const needed = [...new Set(shapes.map(oracleOf))];

  /** oracle name -> accept set. `acceptSet` (singular) applies to every oracle. */
  const accepts = new Map();
  let origin = "(injected)";
  for (const name of needed) {
    if (options.acceptSets && options.acceptSets[name]) {
      accepts.set(name, options.acceptSets[name]);
    } else if (options.acceptSet) {
      accepts.set(name, options.acceptSet);
    } else {
      const resolved = await schemaAcceptSet(name, options.importSpec);
      accepts.set(name, resolved.accept);
      origin = resolved.origin;
    }
  }

  const read = shapes.map((shape) => ({ shape, ...declaredKeys(root, shape) }));

  /** oracle name -> every key declared on a wire shape judged by that oracle. */
  const wireKeysByOracle = new Map(
    needed.map((name) => [
      name,
      new Set(read.filter((r) => r.shape.reach === "wire" && oracleOf(r.shape) === name).flatMap((r) => r.keys)),
    ])
  );

  const violations = [];
  const uiOnly = [];
  const ledgered = new Set();

  for (const { shape, keys } of read) {
    const oracle = oracleOf(shape);
    const accept = accepts.get(oracle);
    for (const key of keys) {
      if (accept.has(key)) continue;
      if (shape.reach === "ui" && !wireKeysByOracle.get(oracle).has(key)) {
        uiOnly.push({ shape: shape.id, file: shape.file, key, oracle });
        continue;
      }
      const entry = Object.prototype.hasOwnProperty.call(ledger, key) ? ledger[key] : null;
      if (entry && (entry.oracle ?? "FieldSchema") === oracle) {
        ledgered.add(`${key}\u0000${oracle}`);
        continue;
      }
      violations.push({ shape: shape.id, file: shape.file, writer: shape.writer, key, oracle });
    }
  }

  // Both-directions ratchet: an entry that no longer applies must not survive.
  const ledgerOracle = (key) => ledger[key].oracle ?? "FieldSchema";
  /** key -> the oracles whose shapes still declare it. */
  const declaredUnder = new Map();
  for (const r of read) {
    for (const key of r.keys) {
      if (!declaredUnder.has(key)) declaredUnder.set(key, new Set());
      declaredUnder.get(key).add(oracleOf(r.shape));
    }
  }

  const acceptedBy = (key) =>
    [...new Set(read.filter((r) => r.keys.includes(key)).map((r) => oracleOf(r.shape)))].filter((name) =>
      accepts.get(name).has(key)
    );
  const staleLedger = Object.keys(ledger)
    .filter((key) => !ledgered.has(`${key}\u0000${ledgerOracle(key)}`))
    .map((key) => {
      // Scoped to the entry's own oracle: a key still declared somewhere, but
      // no longer on any shape THIS entry could apply to, is exactly as stale
      // as one nothing declares at all.
      if (!declaredUnder.get(key)?.has(ledgerOracle(key))) {
        return { key, reason: "no payload shape declares it any more" };
      }
      const accepting = acceptedBy(key);
      // Every shape that still declares it is judged by a schema that now
      // accepts it — the objectui#4676 shape, where the producer moved upstream.
      const stillRefused = read.some(
        (r) =>
          r.keys.includes(key) &&
          oracleOf(r.shape) === ledgerOracle(key) &&
          !accepts.get(oracleOf(r.shape)).has(key)
      );
      if (accepting.length > 0 && !stillRefused) {
        return { key, reason: `\`${accepting.join("` / `")}\` now accepts it` };
      }
      return { key, reason: "it is no longer reachable from a wire-bound shape" };
    });

  // `accept` is kept as the field oracle's set for callers that predate the
  // second oracle; `accepts` is the full map.
  return {
    accept: accepts.get("FieldSchema") ?? accepts.get(needed[0]),
    accepts,
    origin,
    shapes: read,
    violations,
    uiOnly,
    staleLedger,
  };
}

async function main() {
  let result;
  try {
    result = await analyze();
  } catch (err) {
    if (err instanceof ExtractionError) {
      console.error("designer-field-key-parity: EXTRACTION FAILED\n");
      console.error(`    ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const { accepts, origin, shapes, violations, uiOnly, staleLedger } = result;
  for (const [name, accept] of accepts) {
    console.log(`designer-field-key-parity: ${name} accepts ${accept.size} keys`);
  }
  console.log(`  oracle: ${origin}`);
  for (const { shape, keys, indexSignature } of shapes) {
    console.log(
      `  ${shape.id.padEnd(24)} ${String(keys.length).padStart(2)} declared  [${shape.reach}] vs ${(shape.schema ?? "FieldSchema").padEnd(12)}` +
        (indexSignature ? "  (+ index signature — see coverage note 2)" : "")
    );
  }
  if (uiOnly.length) {
    console.log("\n  UI-only keys (declared on no wire-bound shape of the same oracle, so out of reach of a PUT):");
    for (const u of uiOnly) console.log(`    ${u.key.padEnd(16)} (${u.shape}, vs ${u.oracle})`);
  }
  const ledgerKeys = Object.keys(KNOWN_UNPARSEABLE_KEYS);
  if (ledgerKeys.length) {
    console.log("\n  Ledgered — refused, filed, resolution owned by its card:");
    for (const key of ledgerKeys) {
      const e = KNOWN_UNPARSEABLE_KEYS[key];
      console.log(
        `    ${key.padEnd(14)} ${e.card}  [${e.oracle ?? "FieldSchema"}]` +
          (e.spec ? `  (spec spells it \`${e.spec}\`)` : "  (no spec equivalent)")
      );
    }
  }

  if (staleLedger.length) {
    console.error("\ndesigner-field-key-parity: STALE LEDGER ENTRIES\n");
    for (const s of staleLedger) {
      console.error(`    ${s.key} — ${s.reason}`);
    }
    console.error(
      "\n    Remove the entry. A ledger entry that no longer applies silently re-admits\n" +
        "    that spelling the next time someone declares it.\n"
    );
  }

  if (violations.length) {
    console.error("\ndesigner-field-key-parity: KEYS THE SPEC REFUSES BY NAME\n");
    // Grouped by KEY, not by site: one key declared on three shapes is one
    // decision to make, and reading it three times obscures that.
    const byKey = new Map();
    for (const v of violations) {
      if (!byKey.has(v.key)) byKey.set(v.key, []);
      byKey.get(v.key).push(v);
    }
    for (const [key, sites] of byKey) {
      console.error(`    ${key}`);
      for (const v of sites) {
        console.error(`        declared on ${v.shape} (${v.file})`);
        console.error(`        written by  ${v.writer}`);
        console.error(`        refused by  ${v.oracle}`);
      }
    }
    console.error(
      "\n    Each of these makes `PUT /api/v1/meta/object/:name` return 422 INVALID_METADATA,\n" +
        "    which blocks EVERY subsequent save of the object until the key is cleared.\n" +
        "    The three prior instances took three different correct resolutions (retire the\n" +
        "    control, delete the declaration, move the producer upstream) — so file a card and\n" +
        "    record it in KNOWN_UNPARSEABLE_KEYS rather than picking one here.\n"
    );
  }

  if (violations.length || staleLedger.length) process.exit(1);
  console.log("\ndesigner-field-key-parity: OK");
}

if (isEntrypoint(import.meta.url)) {
  await main();
}
