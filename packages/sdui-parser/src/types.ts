/**
 * ObjectUI — SDUI JSX-source parser (ADR-0080)
 *
 * Types shared by the constrained JSX-source compiler. The parser turns a
 * constrained JSX *text* into the existing SDUI `SchemaNode`
 * tree. It PARSES — it never executes. No `import`, no `eval`, no JS.
 */

/** A node in the compiled SDUI tree. Mirrors `@object-ui/types` BaseSchema. */
export type SchemaNode = SchemaElement | string;

export interface SchemaElement {
  type: string;
  children?: SchemaNode[];
  [prop: string]: unknown;
}

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  severity: Severity;
  /** stable machine code, e.g. 'forbidden-tag' */
  code: string;
  message: string;
  /** byte offset into the source where the issue starts */
  start?: number;
  /** the tag/component involved, when relevant */
  tag?: string;
}

export interface ParseOptions {
  /**
   * Whitelist of allowed tag names (= registry `type` set, from the manifest).
   * When provided, any tag outside it is a `forbidden-tag` error — this is the
   * sanitization boundary. When omitted, all tags are accepted (lexing only).
   */
  allowedTags?: Set<string>;
}

export interface ParseResult {
  /** the compiled tree, or null when the source has no valid root */
  tree: SchemaElement | null;
  diagnostics: Diagnostic[];
}

/* ------------------------------------------------------------------ *
 * Manifest — the serialized public-tier contract from the registry.
 * Produced by serializing `ComponentRegistry.getAllConfigs()` (ADR-0080 §3/§6).
 * ------------------------------------------------------------------ */

export type ManifestInputType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object'
  | 'color'
  | 'date'
  | 'code'
  | 'file'
  | 'slot';

export interface ManifestInput {
  name: string;
  /**
   * The input's coarse type: ONE kind, or an ARRAY of kinds when the key's
   * contract is a union (objectui#3832).
   *
   * A value passes {@link validateTree}'s coarse check when ANY arm accepts it,
   * and is reported when none does — the array widens what is legal, it does
   * not switch the check off.
   *
   * The single-kind form is unchanged and stays the canonical spelling for a
   * one-arm key: `manifestFromConfigs` collapses a one-element array back to
   * the bare string, so a manifest gains arrays only where a union was really
   * declared and every already-published entry serializes byte-identically.
   */
  type: ManifestInputType | ManifestInputType[];
  /**
   * The coarse kind of the input's MEMBERS — array elements, or the values of
   * an object used as a map — as ONE kind or an ARRAY of kinds for a member
   * contract that is a union (objectui#8067).
   *
   * Absent means "not declared", which is what every input published before
   * this key existed says: {@link validateTree} checks no member and the
   * codegen emits the unnarrowed element type, exactly as before. So a
   * manifest gains this key only where a member kind was really declared, and
   * every already-published entry serializes byte-identically.
   *
   * Read the arms through `inputTypeArms(input.of)` — the same accessor
   * `type`'s arms go through, since the two fields carry the same shape and a
   * reader that forgets the array form is silently inert on it.
   */
  of?: ManifestInputType | ManifestInputType[];
  required?: boolean;
  /** allowed values for `enum` inputs */
  enum?: Array<string | { value: unknown; label?: string }>;
  /**
   * Marks a data-binding input the server must resolve (ADR-0080 §6.3):
   * `binding: 'object'` says the input NAMES an object, so the server-side
   * binding check knows what to resolve it against. Unrelated to
   * `type: 'object'`, the coarse control kind — a record-shaped value and an
   * object-naming input are two different facts.
   *
   * ## The vocabulary is exactly `'object'` — `'field'` is retired on this face too
   *
   * `'field'` stood beside it from the first draft of ADR-0080 and was never
   * written. It was retired on the serializer's INPUT boundary
   * (`RegistryConfigLike` in `index.ts`) under ADR-0049 enforce-or-remove by
   * the maintainer ruling of 2026-09-07 (decision batch #69), and on THIS
   * face by objectui#8315 — the residue that ruling did not name, which left
   * one published package narrow on one face and wide on the other.
   *
   * ⚠️ The argument for leaving this face wide was ANSWERED, not overlooked.
   * It runs: producer → reader is a subset relation, so a reader accepting a
   * value no producer emits is permissive rather than wrong. Three measured
   * facts decided against it (objectui#8315):
   *
   *   1. **This is not a pure reader face.** `manifestFromConfigs` RETURNS a
   *      `Manifest`, so `ManifestInput` is also this package's OUTPUT type,
   *      and this key is fed straight from the already-narrowed boundary. A
   *      union wider than the producer's is imprecision on the way out, not
   *      permissiveness on the way in.
   *   2. **Its sibling is a pure producer face.**
   *      `ManifestValidationResult.bindings[].kind` is written by
   *      `validateTree` by copying this key, so the subset relation runs the
   *      other way there — see that declaration. The two are COUPLED by that
   *      assignment: narrowing one alone needs a cast at the only conversion
   *      site, which is the lenient fallback AGENTS.md #0.1 bans. So "both
   *      narrow" and "both wide" were the only self-consistent states, and
   *      only one of them can be justified on the producer face.
   *   3. **The permissiveness protected nothing.** `binding: 'field'` has
   *      zero writers here and zero in the objectstack copy of this package
   *      (measured 2026-09-09 on both heads, each with a firing
   *      `binding: 'object'` control), and the only manifest producer in
   *      either tree is `manifestFromConfigs`, whose input face is narrow.
   *
   * The reopen route is the ruling's own: a MEASURED need for field bindings
   * is filed as a widening with the vocabulary decided then — not
   * pre-declared here for a producer that does not exist.
   */
  binding?: 'object';
  description?: string;
}

export interface ManifestComponent {
  type: string;
  /** plugin namespace — provenance that drives `requires` */
  namespace?: string;
  inputs: ManifestInput[];
  isContainer?: boolean;
}

export interface Manifest {
  /** keyed by component `type` */
  components: Record<string, ManifestComponent>;
}

/**
 * Result of validating a compiled tree against the MANIFEST.
 *
 * Named `ManifestValidationResult`, not `ValidationResult` (objectui#3161,
 * objectstack#4115 ledger batch 7), following the convention registered on
 * objectstack#4115 for this name: **`<what was validated>Validation<Error |
 * Result>`**. `ValidationResult` is exported twice by the spec — `kernel` and
 * `contracts`, both `{ valid, errors?: [{ field, message, code? }], warnings? }`
 * for PLUGIN MANIFEST validation — and `@object-ui/core` took
 * `SchemaNodeValidationResult` under the same convention in batch 4
 * (objectui#3188). Three results, three subjects: a plugin, a schema node, and
 * this one, which carries no `valid` flag at all — it returns `diagnostics`
 * (severity lives per entry), the `requires` set the compiled page needs, and
 * the binding sites the server must resolve. Nothing here is assignable to
 * anything there in either direction.
 */
export interface ManifestValidationResult {
  diagnostics: Diagnostic[];
  /** unique plugin namespaces referenced — the page's `requires` */
  requires: string[];
  /**
   * Binding sites the server must resolve against object schema.
   *
   * `kind` is a PRODUCER face, not a reader face: `validateTree` writes it,
   * copying {@link ManifestInput.binding} at the one site that builds this
   * array. So the subset relation that licenses a permissive READER runs the
   * other way here — a wider union accepts nothing extra, it obliges every
   * consumer to handle an arm this package cannot emit. That is why the
   * retired `'field'` arm (objectui#6950 on the input boundary, objectui#8315
   * here) is gone from this end as well; the measurements are on
   * {@link ManifestInput.binding}.
   */
  bindings: Array<{ tag: string; input: string; kind: 'object'; value: unknown }>;
}
