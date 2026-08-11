#!/usr/bin/env node
/**
 * A spec-named symbol must be DERIVED from `@objectstack/spec`, not hand-written.
 *
 * The failure class (objectstack#4115): objectui declares a local type or const
 * under the SAME NAME as a `@objectstack/spec` export, with a doc comment
 * claiming spec canonicity — and the declaration has drifted, or is one spec
 * release away from drifting. Every audited instance had:
 *
 *   ActionType            "canonical definition from @objectstack/spec"  → hand union, missing `form`   (#2231/#2901)
 *   ChartType             (sibling schema re-exported under spec's name) → 7 of 19 members             (objectui#2944)
 *   ActionLocation + 2    "single source of truth… re-export here"       → re-DECLARED union + z.enum   (#4074)
 *   ActionParamFieldType  "aligned with the field types available in spec" → 16 of 49 members           (#4074)
 *
 * What makes this class expensive is specific to agent-driven development: an
 * agent reads the comment, takes it as ground truth, and builds on it. #2901 was
 * filed with a backwards premise because the fork was re-exported under the
 * spec's own symbol name. A wrong canonical-claim is not stale documentation —
 * it is a planted premise for the next session.
 *
 * This guard lands the rule AS THE CHECK, not as an AGENTS.md paragraph. A
 * prose-only rule is precisely the "declared ≠ enforced" landmine the whole
 * thread is about (#4074, objectui#3009 — where a guard file's own header
 * falsely claimed its checks were "the real enforcement" for the entire interval
 * during which nothing compiled them).
 *
 * ── What counts as derived ───────────────────────────────────────────────────
 * Both of the repo's sanctioned forms pass, because both bind the local name to
 * the spec at compile time:
 *
 *   export type { ActionLocation } from '@objectstack/spec/ui';   // re-export
 *   export type ActionType = z.infer<typeof SpecActionType>;      // derivation
 *
 * A declaration is derived only when the spec reference sits in a STRUCTURAL
 * position — a type alias's own type node, an interface's `extends`, a const's
 * initializer. A spec name merely *mentioned* inside a members block does not
 * count, because that is what a hand-written fork looks like:
 *
 *   export interface ActionSchema { locations?: ActionLocation[] }   // NOT derived
 *
 * Consts are stricter still: object and array literals are not descended into.
 * `export const ACTION_LOCATIONS = [...SpecLocations]` is a COPY, and a faithful
 * copy passes every value comparison — reference identity is the only check that
 * distinguishes a re-export from a fork (objectui#3003, and the insight already
 * written down in `spec-subschema-parity.test.ts`).
 *
 * Run:  node scripts/check-spec-symbol-derivation.mjs
 * Exit: 0 = OK, 1 = a spec-named symbol is hand-written, or the allowlist is stale
 */

import ts from "typescript";
import { createRequire } from "module";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Allowlist ────────────────────────────────────────────────────────────────
// Same governance as `check-type-check-coverage.mjs`'s DEBT map: declared,
// reasoned, shrink-only. An entry that no longer matches a real violation is
// stale and fails this guard, so the list cannot outlive the code it excuses.
//
// A same-name symbol that is narrower or wider ON PURPOSE belongs here with that
// purpose written down — at which point the comment is load-bearing instead of
// decorative. A symbol that is *supposed* to be the spec's should be imported
// instead; that is the whole point of the check.
//
// Key format: "<package>:<symbol>".
const ALLOW = {
  "@object-ui/types:ActionSchema": {
    reason:
      "Two deliberate objectui-side shapes, both documented at their declaration. " +
      "`ui-action.ts` is a renderer VIEW over the spec's action — it carries renderer-only " +
      "fields the spec does not model, while importing the spec-owned parts it does share " +
      "(`ActionLocation`, `ActionType`). `crud.ts` is the explicitly @deprecated legacy " +
      "shape kept for backward compatibility and slated for removal in a future major.",
    issue: 4115,
  },
  "@object-ui/types:FormField": {
    reason:
      "Two-LAYER vocabulary, not two dialects of one concept (objectui#3090): the spec's " +
      "FormField is the authored form-VIEW shape (`field` = object-field reference, presentation " +
      "deltas only) while this is the runtime widget config (`name` = form data path, " +
      "self-contained). Not derivable — and the spec's FormField type erases to `any` in its dist " +
      "(objectstack#4171), so a re-export would delete typing outright. The layers meet only in " +
      "`normalizeSectionField` (@object-ui/plugin-form), gated by " +
      "sectionFields.spec-parity.test.ts (per-key behavioral coverage of the spec key set, both " +
      "directions). Misimport of the spec names is banned by the no-restricted-imports entry in " +
      "eslint.config.js.",
    issue: 4115,
  },
  "@object-ui/types:FormFieldSchema": {
    reason:
      "Zod twin of the two-layer FormField split (objectui#3090): validates the RUNTIME " +
      "vocabulary (`name` + widget `type`) that `objectui validate` enforces; the spec's " +
      "FormFieldSchema validates the authored form-view layer. Key set pinned by " +
      "packages/types/src/__tests__/form-field-zod-coverage.test.ts; the spec-shape rejection " +
      "(`{ field: … }` stays invalid here) is pinned there too, and the CLI names the boundary " +
      "in its error output instead of suggesting a lossy rename.",
    issue: 4115,
  },
  "@object-ui/types:SelectOptionSchema": {
    reason:
      "Spec-derived dialect (objectui#3090): spec keys flow in by reference via " +
      "`SpecSelectOptionSchema.shape`, with two pinned divergences (`value` widened to " +
      "string|number|boolean for standalone UI forms; `visibleWhen` kept on the #2212 wire " +
      "contract instead of the spec's envelope-canonicalizing ExpressionInput pipe) and two " +
      "UI-only extensions (`disabled`, `icon`). Drift guard: " +
      "packages/types/src/__tests__/select-option-spec-parity.test.ts — it fails if the spec " +
      "adds a key, retires one, claims an extension name, or widens `value` itself.",
    issue: 4115,
  },
  "@object-ui/types:ListViewSchema": {
    reason:
      "TS twin of the spec-derived `ListViewSchema` zod node (objectql.zod.ts), which DOES " +
      "import the spec's fields by reference at its declaration. This alias cannot carry that " +
      "reference structurally: the spec's `ListViewSchema` is a zod VALUE, so there is no spec " +
      "TYPE to alias or extend, and the objectui node additionally intersects " +
      "`ListViewRuntimeProps` — callbacks and an imperative refresh trigger that are not " +
      "serialisable view metadata and therefore cannot exist in any schema. Divergence from " +
      "the spec is bounded by the zod derivation, not by this declaration; the drift guard is " +
      "packages/types/src/__tests__/list-view-spec-parity.test.ts, which fails when the spec " +
      "grows an untriaged field, retires one objectui aliases (`type`→`viewType`, relaxed " +
      "`columns`, `filter` alongside legacy `filters`), or someone adds a local key outside " +
      "the sanctioned set.",
    issue: 4115,
  },
  "@object-ui/types:BulkActionParam": {
    reason:
      "Renderer-side dialect of the spec's authored param (objectui#3334). The spec's " +
      "BulkActionParamSchema closes `type` over the FieldWidget enum — right for authored " +
      "view metadata that `objectstack build` validates. This interface types what the " +
      "BulkActionDialog RENDERS, which also includes defs promoted at runtime from object " +
      "actions (`resolveBulkActions`, objectui#3002) whose param types are whatever the " +
      "action declared — so `type` stays an open string and a catch-all index signature " +
      "forwards widget-specific config (min/max/step/…) the way the field renderers expect. " +
      "Divergence pinned by packages/types/src/__tests__/bulk-action-spec-parity.test.ts.",
    issue: 3334,
  },
  "@object-ui/types:BulkActionDef": {
    reason:
      "Renderer-side dialect (objectui#3334): carries `actionDef` — the source object " +
      "ActionDef attached at runtime when a `bulkActions: ['<name>']` entry is promoted " +
      "(objectui#3002/#3139) — which the spec's STRICT BulkActionDefSchema rejects by design " +
      "(it validates authored view metadata, and `actionDef` is a resolution artifact that " +
      "must never be authored). `visible` also stays on the pre-normalization " +
      "`string | { dialect?, source }` wire shape the action bridge forwards. Divergences " +
      "pinned by packages/types/src/__tests__/bulk-action-spec-parity.test.ts; " +
      "`BulkActionOperation` and the param/def spec keys are shared, and the operation union " +
      "is imported from the spec at its declaration in objectql.ts.",
    issue: 3334,
  },
  "@object-ui/auth:AuthProvider": {
    reason:
      "A REACT CONTEXT PROVIDER COMPONENT, not a type — `<AuthProvider authUrl=…>` is the " +
      "documented entry point of this package and of every app that mounts it. The spec's " +
      "`AuthProvider` is a `z.ZodEnum` of provider IDENTIFIERS (local | google | github | " +
      "microsoft | ldap | saml); nothing about a JSX element could be mistaken for it, which " +
      "is why this one collision is excused where its own config type was NOT — that config " +
      "was renamed to `AuthProviderOptions` because `AuthProviderConfig` names the spec's " +
      "OAuth registration shape `{ id, clientId, clientSecret, scope? }`, the same domain and " +
      "the same words, and IS readable as canonical by the next session. Renaming the " +
      "component would break the React `<XProvider>` convention and every consumer's JSX for " +
      "no defect. Pinned by packages/auth/src/__tests__/auth-spec-parity.test.ts, which fails " +
      "if the spec's `AuthProvider` ever stops being an enum of provider ids.",
    issue: 4115,
  },
  "@object-ui/types:SelectOption": {
    reason:
      "TS twin of the SelectOptionSchema dialect (objectui#3090): carries every spec key " +
      "(label/value/color/default/visibleWhen) plus the documented UI-only extensions " +
      "(`disabled`, `icon`). Kept an interface because the spec type is sound but the " +
      "objectui `value`/`visibleWhen` divergences are deliberate; the zod twin's parity " +
      "test pins the key set.",
    issue: 4115,
  },
  // Two names the spec started exporting in 17.0.0-rc.1. Both were triaged when
  // the bump landed (objectui#3178) and neither is a dialect of the spec's
  // concept — they are unrelated things that happen to share a name.
  "@object-ui/types:FieldNode": {
    reason:
      "Same name, unrelated concepts. The spec's `FieldNode` is a bare `string` — a field " +
      "NAME — after objectstack#4196 narrowed `QueryAST.fields` to names (the old union's " +
      "nested-select member was produced by nothing and consumed by nothing). This is a NODE " +
      "in objectui's own query AST (`{ type: 'field', table?, name, alias? }`), a sibling of " +
      "`LiteralNode` / `OperatorNode` / `JoinNode`. Deriving would replace a structured node " +
      "with a string; there is nothing to import.",
    issue: 4115,
  },
  "@object-ui/app-shell:InboxNotification": {
    reason:
      "Two LAYERS, like the FormField entry above. The spec's is the notification SERVICE " +
      "contract (`INotificationService.listInbox`): camelCase, `body` and `read` required, " +
      "`actionUrl`/`createdAt`. This is the materialized inbox ROW the popover groups — " +
      "snake_case mirroring `sys_notification` (`action_url`), carrying the read-receipt keys " +
      "the contract has no place for (`notification_id`, `receipt_id`, ADR-0030) and nullable " +
      "where a stored row can be null. A row is not a response.",
    issue: 4115,
  },
  // Two RENDERERS in @object-ui/plugin-list, judged by the AuthProvider rule
  // above and NOT by "components are exempt" — the sibling `ViewTab` in the same
  // package was a hand copy under a spec name and was derived (objectui#3160).
  "@object-ui/plugin-list:ListView": {
    reason:
      "The RENDERER of the spec type, not a second declaration of it. The spec's `ListView` " +
      "is authored view METADATA (`z.infer<typeof ListViewSchema>`, type-only); this is the " +
      "React component that draws it, and its own props bind that metadata at the declaration " +
      "— `ListViewProps.schema` is `ListViewSchema` from `@object-ui/types`, itself the " +
      "declared dialect two entries up. So the two layers are joined here, not confused: there " +
      "is no shape to drift, and `<ListView schema={…}/>` cannot be read as canonical for a " +
      "metadata SHAPE the way `AuthProviderConfig` could. The repo already disambiguates from " +
      "the other side — `@object-ui/types` re-exports the spec's type as `SpecListView` — and " +
      "renaming the package's headline export would rewrite every consumer's JSX for zero " +
      "defect, the AuthProvider judgement exactly. Pinned by " +
      "packages/plugin-list/src/__tests__/spec-symbol-batch6.test.tsx, which fails if the " +
      "spec's `ListView` stops being authored metadata or if this export stops being a " +
      "component that consumes it.",
    issue: 4115,
  },
  "@object-ui/plugin-list:UserFilters": {
    reason:
      "Same judgement as `ListView` directly above, and the same package. The spec's " +
      "`UserFilters` is the ADR-0047 quick-filter CONFIG (`{ element, fields, tabs, … }`, " +
      "type-only); this is the filter bar that renders it, and it takes that config as a prop " +
      "— `UserFiltersProps.config` is `NonNullable<ListViewSchema['userFilters']>`, so the " +
      "spec's shape is what this component is typed against rather than something it restates. " +
      "Nothing here declares a filter shape, so nothing here can drift from one. Pinned by the " +
      "same test file, which asserts `UserFiltersProps['config']` still accepts the spec's " +
      "authored `UserFilters`.",
    issue: 4115,
  },
};

// ── Untriaged collisions (the ledger) ────────────────────────────────────────
// Same governance as `check-type-check-coverage.mjs`'s DEBT map: declared,
// shrink-only. These are the same-name symbols that predate this guard and have
// not been triaged one-by-one yet. This check exists to stop the BLEEDING — a
// new fork fails on the PR that writes it — not to retro-fix every symbol at once.
//
// Named symbols rather than a per-package COUNT, deliberately: a count is a
// budget. It lets the next fork land as long as an unrelated one was fixed in
// the same PR, and it makes the failure message point at whichever collisions
// happen to sort first instead of at the one just written. The list is longer;
// it is also the thing that names the new symbol at the moment it appears.
//
// To burn one down: import/derive it from the spec, rename it to a declared
// local dialect (`ObjectUiLocal…`, with a tripwire test asserting the spec does
// not own the name), or move it to ALLOW with the reason it deliberately
// differs. Then delete it from this list — leaving it here fails the ratchet.
//
// ── Triage first, and do not trust `extends` alone ───────────────────────────
// The obvious way to decide whether a collision is a safe re-export is to ask
// the compiler whether the two types are mutually assignable:
//
//     type A = [Local] extends [Spec] ? true : false
//     type B = [Spec] extends [Local] ? true : false   // A && B → "identical"
//
// That question lies in three ways, and all three occur in this repo. Check for
// them BEFORE acting on an "identical" verdict:
//
//   1. The local declaration resolves to `any` — a recursive zod schema
//      annotated `z.ZodType<any>` (`FilterConditionSchema`,
//      `NavigationItemSchema`). `any` answers every assignability question
//      affirmatively.  Detect: `0 extends (1 & Local) ? true : false`.
//   2. The SPEC export resolves to `any`. Re-exporting such a symbol REPLACES a
//      precise local interface with `any` — a type-safety regression wearing a
//      burn-down's clothes. Detect: the same `0 extends (1 & Spec)` probe — but
//      see 2b and 2c, which that probe does NOT catch.
//
//      History worth keeping, because it is the reason this whole list exists:
//      `NavigationItem`, `JoinNode` and `FormField` were the instances, filed
//      upstream as objectstack#4171. All three are resolved as premises now —
//      `JoinNode` was retired with `query.joins` (framework#4286) and the other
//      two were typed properly in spec 17.0.0-rc.1 — and NEITHER became
//      derivable as a result (objectui#3177). Do not read "no longer `any`" as
//      "safe to bind"; see 2c.
//   2c. The SPEC export is typed but NOT PRECISE, which the `any` and `unknown`
//      probes both report as clean. Two live instances, each pinned with a probe
//      that asks its real blocker (objectui#3177):
//        - `ConditionalValidation.then` / `.otherwise` are
//          `BaseValidationRuleShape` — `type: string` plus `[key: string]:
//          unknown`, i.e. case 3 on the SPEC side. Deriving swaps a
//          discriminated union for a bag. Blocked on objectstack#4075.
//          Detect: `string extends Spec['type']`, and the case-3 probe.
//        - `NavigationItem` / `FormField` are precise but describe a DIFFERENT
//          shape (a nine-variant union vs objectui's flat one) or a different
//          LAYER (spec `field` = an object-field reference; objectui `name` =
//          the form data path, with disjoint required keys). Precision is not
//          equivalence. Detect: per-key, per-tier probes — a structural
//          `extends` permits excess properties and so cannot see a key the spec
//          does not declare.
//      Both sets live in `spec-derived-unions.test.ts` /
//      `validation-rule-spec-parity.test.ts`, written to fail the day the
//      blocker they name lifts.
//   2b. The SPEC export resolves to `unknown` (`JoinedReportBlock`, whose
//      `JoinedReportBlockSchema` the spec declares as `z.ZodTypeAny`). Just as
//      empty as case 2 and just as unburnable, but the `any` probe reports
//      `false` for it, so a triage that only screens for `any` waves it through
//      as "safely derivable". Detect: `[unknown] extends [Spec]`. Pinned in
//      packages/types/src/__tests__/report-chart-query-spec-parity.test.ts
//      (objectui#3155); also filed under objectstack#4171.
//   3. The local declaration carries `[key: string]: any` (`FormField`,
//      `AppSchema`, `PageSchema`, `ThemeSchema`, …) — the objectstack#4075
//      mechanism. An index signature absorbs any extra member, so the two types
//      compare equal while accepting wildly different objects.
//      Detect: `string extends keyof Local ? true : false`.
//
// A zod schema needs one more question than a type does: `_output` equality is
// not enough, because two schemas can agree on output and still accept different
// AUTHORING input. `FormFieldSchema` is exactly that — identical `_output`,
// divergent `_input` — so re-exporting it would silently change what parses.
// Compare `_input` too before touching a schema const.
const DEBT_ISSUE = 4115;
const DEBT = {
  "@object-ui/types": [
    "JoinedReportBlock",
    "NavigationItem",
    "NavigationItemSchema",
  ],
};

// Files under these paths are not objectui's own authored surface.
//   - `ui/` is the Shadcn no-touch zone (AGENTS.md #7): upstream 3rd-party files
//     overwritten by sync scripts, so a collision there is not ours to fix.
//   - `plugin-chatbot/src/elements/` is the same class one package over: Vercel
//     AI Elements (https://elements.ai-sdk.dev, MIT) plus two Shadcn primitives
//     `@object-ui/components` does not ship yet, vendored by the identical
//     copy-into-source model and re-synced from upstream. Every file there
//     carries the banner saying so. Two of its exports collide —
//     `Tool` (a `<Collapsible>` shell for a tool call; the spec's is an agent
//     TOOL DEFINITION) and `MessageContent` (a styled `<div>`; the spec's is an
//     AI message payload) — and neither is renameable: the names ARE the
//     upstream component API, so a rename is reverted by the next re-sync and
//     breaks `<Tool><ToolHeader/></Tool>` for anyone following upstream docs.
//     Skipping the directory rather than ALLOW-ing the two names is deliberate:
//     a future re-sync must not fail an unrelated PR over a third vendored name
//     nobody here is allowed to rename either. The hole that opens — an
//     objectui-AUTHORED file hiding under the skip — is closed by
//     packages/plugin-chatbot/src/__tests__/spec-symbol-batch6.test.ts, which
//     fails if any file there stops carrying the vendored banner.
//     (objectui#3160, objectstack#4115 ledger batch 6.)
const SKIP_PATH_SEGMENTS = ["components/src/ui/", "plugin-chatbot/src/elements/"];

const isSpecModule = (m) => m === "@objectstack/spec" || m.startsWith("@objectstack/spec/");

// ── 1. Enumerate every `@objectstack/spec` export name, per subpath ──────────
// Types AND values: the drifted symbols in the table above are mostly types, and
// a runtime `import()` only sees values. The compiler's own view of each
// subpath's `.d.ts` is the only source that covers both.
function specExportNames() {
  const require = createRequire(import.meta.url);
  let pkgPath;
  try {
    pkgPath = require.resolve("@objectstack/spec/package.json");
  } catch {
    console.error(
      "❌  cannot resolve @objectstack/spec — run `pnpm install` first.\n" +
        "    This guard reads the spec's own type declarations; it cannot fall back to a\n" +
        "    hardcoded name list without becoming the stale copy it exists to prevent."
    );
    process.exit(1);
  }
  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

  const entries = [];
  for (const [sub, cond] of Object.entries(pkg.exports ?? {})) {
    if (typeof cond !== "object" || cond === null) continue;
    const dts = cond?.import?.types ?? cond?.require?.types;
    if (!dts) continue;
    entries.push({ sub: sub === "." ? "@objectstack/spec" : `@objectstack/spec${sub.slice(1)}`, file: resolve(pkgDir, dts) });
  }

  const program = ts.createProgram(
    entries.map((e) => e.file),
    {
      noEmit: true,
      skipLibCheck: true,
      strict: false,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    }
  );
  const checker = program.getTypeChecker();

  const names = new Map(); // name -> Set<subpath>
  for (const entry of entries) {
    const sf = program.getSourceFile(entry.file);
    if (!sf) continue;
    const moduleSymbol = checker.getSymbolAtLocation(sf);
    if (!moduleSymbol) continue;
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const name = exported.getName();
      if (!names.has(name)) names.set(name, new Set());
      names.get(name).add(entry.sub);
    }
  }
  return names;
}

// ── 2. Scan objectui's authored source for exported declarations ─────────────
function sourceFiles() {
  const out = [];
  const pkgsDir = resolve(root, "packages");
  for (const pkg of readdirSync(pkgsDir)) {
    const srcDir = join(pkgsDir, pkg, "src");
    try {
      if (!statSync(srcDir).isDirectory()) continue;
    } catch {
      continue;
    }
    walk(srcDir, out);
  }
  return out;
}

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Tests do not publish a surface, so a local type there cannot be mistaken
      // for the spec's by an importer. Keeps the signal on the public API.
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "__tests__") continue;
      walk(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.d\.ts$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name) || /\.stories\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
}

const packageNameCache = new Map();
function packageNameFor(file) {
  const rel = relative(root, file);
  const pkgDir = rel.split("/").slice(0, 2).join("/");
  if (!packageNameCache.has(pkgDir)) {
    let name = pkgDir;
    try {
      name = JSON.parse(readFileSync(resolve(root, pkgDir, "package.json"), "utf8")).name ?? pkgDir;
    } catch {
      /* keep the directory name */
    }
    packageNameCache.set(pkgDir, name);
  }
  return packageNameCache.get(pkgDir);
}

const hasExportModifier = (node) =>
  node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/**
 * Does this subtree reference a name bound to a spec import?
 *
 * `skipLiterals` stops the walk at object/array literals and type-literal member
 * blocks: a spec name mentioned inside a members block is a hand-written shape
 * that merely USES a spec type, which is exactly what a fork looks like.
 *
 * `exclude` drops the declaration's OWN name node from the walk. Without it a
 * declaration whose name is itself bound to a spec import reads as derived from
 * itself — `import type { X } from spec` next to `export type X = 'a' | 'b'`
 * would be waved through, since the alias's own `X` identifier is in `bindings`.
 * TypeScript rejects that particular pair as a duplicate identifier, so it is
 * not reachable in compiling code, but a guard that depends on the compiler
 * having run first is a guard with a hole in it.
 */
function referencesSpec(node, bindings, skipLiterals, exclude) {
  let found = false;
  const visit = (n) => {
    if (found || !n || n === exclude) return;
    if (skipLiterals) {
      if (ts.isTypeLiteralNode(n) || ts.isObjectLiteralExpression(n) || ts.isArrayLiteralExpression(n)) return;
    }
    if (ts.isIdentifier(n) && bindings.has(n.text)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

function scanFile(file, specNames) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  // Local names bound to a `@objectstack/spec` import in THIS file.
  const specBindings = new Set();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!isSpecModule(stmt.moduleSpecifier.text)) continue;
    const clause = stmt.importClause;
    if (!clause) continue;
    if (clause.name) specBindings.add(clause.name.text);
    const named = clause.namedBindings;
    if (named && ts.isNamespaceImport(named)) specBindings.add(named.name.text);
    if (named && ts.isNamedImports(named)) for (const el of named.elements) specBindings.add(el.name.text);
  }

  const findings = [];
  const record = (name, kind, derived, node) => {
    if (!specNames.has(name) || derived) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ name, kind, file, line: line + 1, subpaths: [...specNames.get(name)] });
  };

  for (const stmt of sf.statements) {
    // `export { X } from '…'` / `export { X }` / `export type { X } from '…'`
    if (ts.isExportDeclaration(stmt)) {
      const fromModule = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : null;
      // `export * from '…'` exports names this AST pass cannot attribute. When it
      // re-exports the spec it is derivation by definition; when it re-exports a
      // sibling, that sibling's own declaration is scanned on its own turn.
      if (!stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) continue;
      // A barrel re-exporting a module this scan already covers — a relative path
      // or a `@object-ui/*` sibling — is not a second finding. Whatever it points
      // at gets judged at its own declaration site; reporting the barrel too would
      // just make one fork look like four, and would make the fix land in the
      // barrel rather than at the declaration.
      if (fromModule && (fromModule.startsWith(".") || fromModule.startsWith("@object-ui/"))) continue;
      for (const el of stmt.exportClause.elements) {
        const exportedName = el.name.text;
        const localName = (el.propertyName ?? el.name).text;
        const derived = fromModule
          ? isSpecModule(fromModule) // re-export straight from the spec
          : specBindings.has(localName); // `import { X } from spec; export { X }`
        record(exportedName, "re-export", derived, el);
      }
      continue;
    }

    if (!hasExportModifier(stmt)) continue;

    if (ts.isTypeAliasDeclaration(stmt)) {
      record(stmt.name.text, "type", referencesSpec(stmt, specBindings, true, stmt.name), stmt);
    } else if (ts.isInterfaceDeclaration(stmt)) {
      // Only `extends` counts — see the header.
      const extendsSpec = (stmt.heritageClauses ?? []).some((h) => referencesSpec(h, specBindings, false));
      record(stmt.name.text, "interface", extendsSpec, stmt);
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      const extendsSpec = (stmt.heritageClauses ?? []).some((h) => referencesSpec(h, specBindings, false));
      record(stmt.name.text, "class", extendsSpec, stmt);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        record(
          decl.name.text,
          "const",
          decl.initializer ? referencesSpec(decl, specBindings, true, decl.name) : false,
          decl
        );
      }
    } else if (ts.isEnumDeclaration(stmt)) {
      // An enum cannot be derived from anything — a spec-named one is a fork.
      record(stmt.name.text, "enum", false, stmt);
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      record(stmt.name.text, "function", false, stmt);
    }
  }
  return findings;
}

// ── 3. Report ────────────────────────────────────────────────────────────────
const specNames = specExportNames();
const files = sourceFiles().filter((f) => !SKIP_PATH_SEGMENTS.some((seg) => f.includes(seg)));

const violations = [];
for (const file of files) violations.push(...scanFile(file, specNames));

const matchedAllowKeys = new Set();
const unallowed = [];
for (const v of violations) {
  const pkg = packageNameFor(v.file);
  const key = `${pkg}:${v.name}`;
  if (ALLOW[key]) {
    matchedAllowKeys.add(key);
    continue;
  }
  unallowed.push({ ...v, pkg, key });
}

const byPackage = new Map();
for (const v of unallowed) {
  if (!byPackage.has(v.pkg)) byPackage.set(v.pkg, []);
  byPackage.get(v.pkg).push(v);
}

// `--ledger` regenerates the DEBT block from the working tree, so the list is
// never hand-maintained (and so burning symbols down is a mechanical edit).
if (process.argv.includes("--ledger")) {
  const lines = [...byPackage.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([pkg, found]) => {
      const names = [...new Set(found.map((v) => v.name))].sort();
      return `  ${JSON.stringify(pkg)}: [\n` + names.map((n) => `    ${JSON.stringify(n)},`).join("\n") + `\n  ],`;
    });
  console.log("const DEBT = {\n" + lines.join("\n") + "\n};");
  process.exit(0);
}

const errors = [];

// 1. A collision that is not in the ledger is NEW. This is the half that stops
//    the bleeding: a fresh fork fails on the PR that writes it, by name.
for (const [pkg, found] of byPackage) {
  const declared = new Set(DEBT[pkg] ?? []);
  const fresh = found.filter((v) => !declared.has(v.name));
  if (fresh.length === 0) continue;
  errors.push(
    `${pkg} declares ${fresh.length} spec-named symbol${fresh.length === 1 ? "" : "s"} the spec already owns:\n` +
      fresh
        .map(
          (v) =>
            `        ${v.kind} \`${v.name}\`  ${relative(root, v.file)}:${v.line}  ` +
            `(exported by \`${v.subpaths.join("`, `")}\`)`
        )
        .join("\n") +
      `\n      Import it (\`export type { X } from '@objectstack/spec/…'\`), derive it\n` +
      `      (\`export type X = z.infer<typeof SpecX>\`), or — if it deliberately differs — rename it\n` +
      `      to a declared dialect (\`ObjectUiLocalX\`, with a tripwire test asserting the spec does\n` +
      `      not own the name) or add an ALLOW entry with the reason.`
  );
}

// 2. Ratchet — a ledger entry whose symbol is fixed (or gone) must be deleted.
//    Left in, it reserves the name: the next fork under it would land silently.
for (const [pkg, names] of Object.entries(DEBT)) {
  const live = new Set((byPackage.get(pkg) ?? []).map((v) => v.name));
  const stale = names.filter((n) => !live.has(n));
  if (stale.length === 0) continue;
  errors.push(
    `${pkg} lists ${stale.length} symbol${stale.length === 1 ? "" : "s"} in DEBT that no longer collide` +
      ` — \`${stale.join("`, `")}\`.\n` +
      `      Delete them from scripts/check-spec-symbol-derivation.mjs (\`--ledger\` regenerates the\n` +
      `      block) so the names cannot be re-forked silently` +
      `${DEBT_ISSUE ? ` (and close #${DEBT_ISSUE} once the ledger is empty)` : ""}.`
  );
}

// 3. Ratchet — an ALLOW entry that excuses nothing is stale and must go, or it
//    silently keeps a name reserved for a future fork.
for (const key of Object.keys(ALLOW)) {
  if (!matchedAllowKeys.has(key)) {
    errors.push(
      `${key} is in ALLOW but no longer collides with a spec export name — the symbol was\n` +
        `      renamed, removed, or is now imported from the spec. Delete the entry so the\n` +
        `      exemption cannot be inherited by a future fork under the same name.`
    );
  }
}

const outstanding = Object.values(DEBT).reduce((sum, names) => sum + names.length, 0);

if (errors.length === 0) {
  console.log(
    `✅  spec symbol derivation: ${files.length} files scanned against ${specNames.size} spec export names; ` +
      `${Object.keys(ALLOW).length} declared dialect${Object.keys(ALLOW).length === 1 ? "" : "s"}, ` +
      `${outstanding} untriaged collision${outstanding === 1 ? "" : "s"} in ${Object.keys(DEBT).length} packages.`
  );
  process.exit(0);
}

console.error("❌  a spec-named symbol is hand-written, not derived:\n");
for (const message of errors) console.error(`    • ${message}\n`);
console.error(
  "A local declaration under a spec export's name is read by the next agent as the spec's own\n" +
    "definition — that is how #2901 was filed with a backwards premise. See\n" +
    "https://github.com/objectstack-ai/objectstack/issues/4115 for the four symbols that had\n" +
    "already drifted when this guard was written."
);
process.exit(1);
