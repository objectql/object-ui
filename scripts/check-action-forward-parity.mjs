#!/usr/bin/env node
/**
 * An action renderer must forward every authored key the runtime will read.
 *
 * The failure class (objectui#4050, carried from objectstack#6975): each action
 * renderer hands the `ActionRunner` an explicit key WHITELIST rather than the
 * action itself. That is deliberate — a key no renderer honours must not look
 * wired — but its cost is that a NEW key stays invisible until five separate
 * lists are edited, and **nothing fails while they are not**. The key parses,
 * publishes, and reads as honoured:
 *
 *   bodyExtra    objectstack#6837, objectui PR #3924 — payload dropped one hop
 *                before the runner; the action POSTed nothing.
 *   bodyShape    objectstack#6938, objectui PR #3932 — a declared
 *                `{ wrap: 'data' }` sent a flat body.
 *   resultDialog objectui#3646 — the one-shot reveal (2FA code, fresh OAuth
 *                secret) fell back to a toast and the value was lost.
 *   openIn / locations / undoable — each carries an in-comment note at its
 *                forward site recording its own instance.
 *   label / description  objectui#4192 — `action:menu`'s param dialog titled
 *                itself "Action parameters" instead of naming the action. THIS
 *                gate found the same omission on `action:icon` and
 *                `action:group`, which #4192 had not measured.
 *
 * Six of the seven were found by a human reading the lists side by side. This
 * is the gate that reads them instead (maintainer ruling, objectui#4050,
 * 2026-08-10: "Diff each action renderer's forward whitelist against the keys
 * the runtime actually reads … A new spec action key missing from a whitelist
 * must be a red check, not a silent drop; extraction failure is red, never a
 * silent pass").
 *
 * ── Why this is derivable, when objectstack#6975 argued it was not ───────────
 * #6975 stalled on one half of the diff: "the keys the runtime reads" is not
 * mechanically derivable, because `git grep 'action\.'` over the runner and the
 * console handlers returns `action.name` / `action.api` / `action.method` hits
 * with no way to separate "body-path key a renderer must forward" from
 * "mechanic the runner resolves itself". That is true OF GREP. Two changes make
 * it derivable:
 *
 *   1. Read the sites with the compiler API, not with grep — property accesses
 *      and destructurings bound to the ActionDef parameter, per file. `grep`
 *      cannot tell `action.locations` (read off the AUTHORED list, to decide
 *      which actions render) from `action.target` (read off the FORWARDED def,
 *      at execute time); binding-scoped AST extraction can, because they are
 *      different bindings in different functions.
 *   2. INTERSECT that with what the surface may be AUTHORED with. A key the
 *      runtime reads but no author can write is a runner mechanic (`api`,
 *      `chain`, `actionType`, `navigate`) and is nobody's to forward. A key the
 *      author can write AND the runtime reads is exactly the forwardable set.
 *
 *   owed(surface) = authorable(surface) ∩ runtime-read − retired
 *
 * Both inputs come from their real declarations, so neither can be a stale hand
 * copy: `authorable` from `@objectstack/spec`'s own zod shapes plus (for
 * declared surfaces) `@object-ui/types`' renderer VIEW of an action, and
 * `runtime-read` from the consumers' ASTs.
 *
 * The surface-class split #6975 flagged — `element:button` deliberately omits
 * `bodyShape` because its contract is spec's `InlineActionSchema` pick list,
 * not `ActionSchema` — is therefore DERIVED here rather than registered: an
 * inline surface gets an inline owed set, so it is green without an exemption.
 * That is one fewer hand-maintained list than #6975 feared this gate would need.
 *
 * ── The justified-omission registry ──────────────────────────────────────────
 * What is left over is real: some omissions are load-bearing and CORRECT, and
 * #6975's objection to a mechanical diff was precisely that it would report
 * them. Two things cannot be read off an AST:
 *
 *   - REACHABILITY UNDER A GUARD. `recordIdParam`, `recordIdField` and
 *     `undoable` are each read only inside `if (rowRecord && …)`, and
 *     `rowRecord` is `params._rowRecord` — written ONLY by the spread-based
 *     hosts, never by these five renderers. The keys are unreachable here, not
 *     dropped.
 *   - CONSUMPTION AT THE RENDERER. `disabled` is evaluated by each renderer to
 *     grey its own control, and `onClick` is invoked by `action:menu` directly.
 *     A key the renderer itself honours is not one it owes the runner.
 *
 * So {@link JUSTIFIED} is the declared table for those, one entry per
 * (surface, key), each carrying the evidence that made the call — the same
 * governance as `check-spec-symbol-derivation.mjs`'s ALLOW: declared, reasoned,
 * and RATCHETED. An entry that excuses nothing (the key became owed-and-
 * forwarded, or stopped being owed) fails this guard, so the table cannot
 * outlive the code it excuses — which is the answer to #6975's "the registry is
 * itself the drift-prone list, one level up".
 *
 * {@link KNOWN_GAPS} is the other half, and the distinction matters: a
 * JUSTIFIED entry says "correctly omitted", a KNOWN_GAPS entry says "really
 * dropped, filed, not fixed here". Same ratchet, same shrink-only rule as
 * `check-spec-symbol-derivation.mjs`'s DEBT map, and for the same reason — this
 * gate exists to stop the BLEEDING (a new key missing from a whitelist fails on
 * the PR that adds it), not to retro-fix every pre-existing drop at once.
 *
 * ── Direction ────────────────────────────────────────────────────────────────
 * One-way, deliberately: `owed − forwarded − excused = ∅`. Forwarding a key
 * nothing reads is not an error here. It is harmless at runtime (the runner
 * ignores it), and the opposite rule would fail every renderer that forwards a
 * key defensively — `locations`, for one, which is read only off the AUTHORED
 * action by the hosts that decide placement, never off the forwarded def.
 *
 * ── Shape ────────────────────────────────────────────────────────────────────
 * Exported pure functions over an injectable `root`, with the CLI half behind
 * `invokedDirectly` — the same shape as `check-control-bytes.mjs` and
 * `check-changeset-presence.mjs`, and for the same reason: a gate whose failure
 * paths nothing exercises is the objectui#4690 anti-pattern one level up. Every
 * red below is driven from a synthetic repo in
 * `scripts/__tests__/check-action-forward-parity.test.ts`.
 *
 * Extraction failures THROW {@link ExtractionError} rather than returning a
 * verdict: a gate that cannot read its inputs has no verdict to give, and
 * returning "no errors" there would be the silent pass the ruling forbids.
 *
 * Run:  node scripts/check-action-forward-parity.mjs
 * Exit: 0 = every surface forwards what it owes, 1 = a key is dropped, an entry
 *       is stale, or extraction failed.
 */

import ts from "typescript";
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

// ── The surfaces ─────────────────────────────────────────────────────────────
// Every renderer that composes an explicit ActionDef payload and hands it to
// `execute(...)`. `contract` picks the authorable half of the owed set:
//
//   declared — the renderer receives a full action (spec `ActionSchema`, seen
//              through `@object-ui/types`' renderer VIEW of it).
//   inline   — the renderer receives spec's `InlineActionSchema` pick list, a
//              deliberately narrower vocabulary (objectstack#6837's PR pinned
//              this: `element:button`'s list mirrors that pick list field for
//              field).
//
// Hosts that spread the whole action (`{...action}`) are NOT surfaces: they
// cannot drop a key by construction, which is the entire failure being gated.
// `DeclaredActionsBar`, `RelatedRecordActionsBridge`, `ObjectGrid` and
// `page:header`'s `dispatchHeaderAction` are all that shape.
export const SURFACES = [
  { id: "action:button", contract: "declared", file: "packages/components/src/renderers/action/action-button.tsx" },
  { id: "action:icon", contract: "declared", file: "packages/components/src/renderers/action/action-icon.tsx" },
  { id: "action:group", contract: "declared", file: "packages/components/src/renderers/action/action-group.tsx" },
  { id: "action:menu", contract: "declared", file: "packages/components/src/renderers/action/action-menu.tsx" },
  { id: "element:button", contract: "inline", file: "packages/components/src/renderers/basic/elements.tsx" },
];

// ── The runtime consumers ────────────────────────────────────────────────────
// Where a forwarded ActionDef is actually read. `binding` is the parameter the
// def arrives as; reads are collected for that identifier only, which is what
// keeps `objectDef.actions.filter(a => a.locations…)` — a read off the AUTHORED
// list, in the same files — out of the set.
export const RUNTIME_CONSUMERS = [
  { file: "packages/core/src/actions/ActionRunner.ts", binding: "action" },
  { file: "packages/app-shell/src/hooks/useConsoleActionRuntime.tsx", binding: "action" },
  { file: "packages/app-shell/src/views/RecordDetailView.tsx", binding: "action" },
];

// ── Justified omissions ──────────────────────────────────────────────────────
// Key format: "<surface>:<key>". Every entry states WHY the omission is correct
// and cites the evidence, because an entry without one is indistinguishable
// from the drift this gate exists to catch. Ratcheted: an entry that no longer
// excuses a real omission fails below.
export const JUSTIFIED = {
  // ── Unreachable: read only under `rowRecord` ────────────────────────────────
  // `rowRecord` is `params._rowRecord`, and the ONLY writers are the four
  // spread-based hosts — DeclaredActionsBar.tsx:215,
  // RelatedRecordActionsBridge.tsx:164, ObjectGrid.tsx:1721 and :2034, and
  // page:header's dispatchHeaderAction (containers.tsx:1287-1289). None of them
  // dispatch THROUGH these renderers; they compose their own payload and call
  // `execute` directly. DeclaredActionsBar.tsx:100 says so in prose: it "injects
  // the record under `params._rowRecord` — which `action:button` does NOT do".
  //
  // These renderers forward `params: schema.params`, i.e. the AUTHORED params,
  // and `_rowRecord` is a host stash — `isAuthoredParamKey` excludes it by its
  // `_` prefix (packages/core/src/actions/actionKeys.ts:326-327). So the guard
  // cannot hold on this path and the key is unreachable, not dropped.
  ...Object.fromEntries(
    [
      ["recordIdParam", "action:button", "action:icon", "action:group", "action:menu"],
      ["recordIdField", "action:icon", "action:group", "action:menu"],
      ["undoable", "action:icon", "action:group", "action:menu"],
    ].flatMap(([key, ...surfaces]) =>
      surfaces.map((surface) => [
        `${surface}:${key}`,
        {
          reason:
            `Unreachable on this surface, not dropped. \`${key}\` is read only under a ` +
            "`rowRecord` guard — useConsoleActionRuntime.tsx:297 " +
            "(`if (rowRecord && action.recordIdParam)`), :377 " +
            "(`rowRecord?.[action.recordIdField || 'id']`) and :398 " +
            "(`action.undoable && obj && recId && rowRecord && …`) — and `rowRecord` is " +
            "`params._rowRecord`, written only by the spread-based hosts listed above, " +
            "none of which dispatch through this renderer. objectstack#6938 made the same " +
            "reachability call for `recordIdParam`; this gate's own measurement extended it " +
            "to the two siblings behind the same guard (objectui#4192 had read the omission " +
            "as a live Undo loss — it is not: `action:button` forwards `undoable` and " +
            "`recordIdField` on this path INERTLY, for want of the same `rowRecord`).",
          issue: 4192,
        },
      ])
    )
  ),

  // ── Consumed at the renderer ───────────────────────────────────────────────
  ...Object.fromEntries(
    ["action:button", "action:icon", "action:group", "action:menu"].map((surface) => [
      `${surface}:disabled`,
      {
        reason:
          "Consumed HERE, not owed to the runner. Every one of these renderers evaluates " +
          "`disabled` itself (through `hasDeclaredVisibilityGate` + `useCondition`) and greys " +
          "its own control, so the click the runner's own gate would refuse " +
          "(ActionRunner.ts:773) cannot be made in the first place. Forwarding it would put " +
          "the same predicate through a second evaluator on a path that is already closed " +
          "(objectui#3842 ruling on the declared-gate definition, applied by #3849).",
        issue: 4050,
      },
    ])
  ),
  "action:menu:onClick": {
    reason:
      "Consumed HERE. `handleExecute` invokes `action.onClick()` directly and returns before " +
      "reaching `execute` (action-menu.tsx:212) — the documented UI-local escape hatch that " +
      "bypasses the ActionEngine. A key the renderer honours itself is not one it owes the " +
      "runner.",
    issue: 4050,
  },

  // ── Read only to improve a diagnostic ──────────────────────────────────────
  ...Object.fromEntries(
    ["action:button", "action:icon", "action:group", "action:menu"].map((surface) => [
      `${surface}:body`,
      {
        reason:
          "Forwarding it could not change an outcome. The client runner cannot execute a spec " +
          "`body` AT ALL — it reads the key at ActionRunner.ts:1038 for one purpose, to replace " +
          '"no script provided" with the error naming the real cause ("Action body must be ' +
          'executed server-side … register a `script` handler"). So the omission costs a better ' +
          "message on an action that fails either way, never a behaviour. Forwarded by none of " +
          "the five surfaces; revisit if a client-side body executor ever lands.",
        issue: 4050,
      },
    ])
  ),
};

// ── Known gaps ───────────────────────────────────────────────────────────────
// Real drops, filed, deliberately NOT fixed here — same shrink-only governance
// as check-spec-symbol-derivation.mjs's DEBT map. Ratcheted below: a gap that
// has been closed must be deleted from this table, or it silently re-reserves
// the key for the next drop.
export const KNOWN_GAPS = {
  ...Object.fromEntries(
    ["action:button", "action:icon", "action:group", "action:menu"].map((surface) => [
      `${surface}:objectName`,
      {
        reason:
          "An action declaring its own `objectName` (a related-list row action retargeting a " +
          "CHILD object) is dropped by all four declared surfaces, so the console handler falls " +
          "back to the page's object — useConsoleActionRuntime.tsx:370 " +
          "(`action.objectName || objApiName`), :151 and :180 (the i18n scope for the param " +
          "dialog's labels). Pre-existing on every surface, so it is not this PR's regression " +
          "and not its fix.",
        issue: 4202,
      },
    ])
  ),
  ...Object.fromEntries(
    ["action:button", "action:icon", "action:group"].map((surface) => [
      `${surface}:onClick`,
      {
        reason:
          "The UI-local escape hatch is honoured by `action:menu` (which calls it, see JUSTIFIED " +
          "above) and by nothing else: these three neither invoke nor forward it, so a " +
          "code-composed `onClick` is silently inert. Not authorable in metadata (it is a " +
          "function), which is why it stayed invisible. Pre-existing; filed with `objectName`.",
        issue: 4202,
      },
    ])
  ),
};

// ── Opaque spreads ───────────────────────────────────────────────────────────
// A spread this gate cannot resolve to a literal key set is EXTRACTION FAILURE
// and fails — a spread could carry anything, so treating it as empty would be
// the silent pass the ruling forbids. An entry here declares a spread whose
// source is known not to carry authored action keys.
export const OPAQUE_SPREADS = {
  "action:button:localContext": {
    reason:
      "The renderer's own `context` PROP (`{ schema, className, context: localContext, … }`), a " +
      "host-supplied runtime context bag spread last — not the authored action, so it cannot " +
      "carry an authored spec key and cannot satisfy or violate the owed-set diff.",
  },
  "action:icon:localContext": {
    reason: "Same `context` prop as action:button — see that entry.",
  },
};

// ── 1. authorable(surface) ───────────────────────────────────────────────────
/**
 * A spec zod schema's own shape keys.
 *
 * `ActionSchema` is exported as a lazy proxy that does not forward `.shape`, so
 * this walks zod internals to reach the object shape — the same walk
 * `packages/core/src/actions/__tests__/actionKeys.pin.test.ts` does, and
 * acceptable for the same reason: a gate pins a fact, shipped code must not.
 */
export function specShapeKeys(schema, label) {
  const seen = new Set();
  const walk = (node, depth = 0) => {
    if (!node || depth > 8 || seen.has(node)) return null;
    seen.add(node);
    const s = node;
    const shapeOf = (v) => (v && typeof v === "object" ? Object.keys(v) : null);
    if (s.shape) return shapeOf(s.shape);
    const def = s._def ?? s.def;
    if (!def) return null;
    if (def.shape) return shapeOf(def.shape);
    for (const key of ["in", "out", "innerType", "schema", "left", "right"]) {
      const found = def[key] ? walk(def[key], depth + 1) : null;
      if (found) return found;
    }
    return null;
  };
  const keys = walk(schema);
  if (!keys || keys.length === 0) {
    fail(
      `could not resolve \`${label}\`'s shape from @objectstack/spec/ui.\n` +
        "    The schema's internal representation changed. Fix the walk — falling back to a\n" +
        "    hardcoded key list would make this gate the stale copy it exists to prevent."
    );
  }
  return keys;
}

/** `{ declared, inline }` — the two authorable vocabularies, from the spec itself. */
export function loadSpecSchemas(require = createRequire(import.meta.url)) {
  let ui;
  try {
    ui = require("@objectstack/spec/ui");
  } catch {
    fail(
      "cannot resolve @objectstack/spec/ui — run `pnpm install` first.\n" +
        "    This gate reads the spec's own schemas; it has no hardcoded fallback by design."
    );
  }
  for (const name of ["ActionSchema", "InlineActionSchema"]) {
    if (!ui[name]) fail(`@objectstack/spec/ui no longer exports \`${name}\` — the owed set cannot be derived.`);
  }
  return {
    declared: specShapeKeys(ui.ActionSchema, "ActionSchema"),
    inline: specShapeKeys(ui.InlineActionSchema, "InlineActionSchema"),
  };
}

/**
 * `@object-ui/types`' renderer VIEW of an action.
 *
 * Declared surfaces are typed against this, not against the spec schema
 * directly — it carries renderer-only fields the spec does not model
 * (`description`, `enabled`, `size`, …) while importing the spec-owned parts it
 * shares. Unioned into the declared owed set because a key an author can write
 * on THIS type and the runtime reads is just as forwardable as a spec one:
 * `description` is exactly that, and is half of objectui#4192.
 */
export const UI_ACTION_VIEW = "packages/types/src/ui-action.ts";
export function uiActionViewKeys(root, file = UI_ACTION_VIEW) {
  if (!existsSync(resolve(root, file))) {
    fail(`the renderer action view ${file} does not exist — re-point this gate at it.`);
  }
  const sf = parse(root, file);
  for (const stmt of sf.statements) {
    if (!ts.isInterfaceDeclaration(stmt) || stmt.name.text !== "ActionSchema") continue;
    const keys = stmt.members
      .filter(ts.isPropertySignature)
      .map((m) => (m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : null))
      .filter((n) => n !== null);
    if (keys.length === 0) fail(`\`ActionSchema\` in ${file} declares no properties — extraction failed.`);
    return keys;
  }
  fail(
    `\`interface ActionSchema\` not found in ${file}.\n` +
      "    The renderer view moved or was renamed; re-point this gate at it."
  );
}

/**
 * Keys the spec keeps as TOMBSTONES so the parser can reject them by name.
 * Read off `RETIRED_ACTION_KEYS` rather than listed here — a second copy would
 * drift, and a tombstone is never owed (authoring it is a parse rejection).
 */
export const ACTION_KEYS_MODULE = "packages/core/src/actions/actionKeys.ts";
export function retiredKeys(root, file = ACTION_KEYS_MODULE) {
  if (!existsSync(resolve(root, file))) {
    fail(`${file} does not exist — without it a tombstoned key would be reported as owed.`);
  }
  const sf = parse(root, file);
  let found = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "RETIRED_ACTION_KEYS" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      found = node.initializer.properties
        .map((p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null))
        .filter((n) => n !== null);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!found || found.length === 0) {
    fail(
      `\`RETIRED_ACTION_KEYS\` not found (or empty) in ${file}.\n` +
        "    Without it a tombstoned key would be reported as owed."
    );
  }
  return found;
}

// ── 2. runtime-read ──────────────────────────────────────────────────────────
/**
 * Property names read off the ActionDef binding in each consumer.
 *
 * Binding-scoped on purpose: `RecordDetailView.tsx` reads `a.locations` off the
 * AUTHORED action list a few hundred lines from where it reads `action.target`
 * off the forwarded def, and only the second is a forwarding contract. Grep
 * cannot tell them apart, which is what objectstack#6975 measured and called
 * non-derivable.
 */
export function runtimeReadKeys(root, consumers = RUNTIME_CONSUMERS) {
  const perFile = new Map();
  for (const consumer of consumers) {
    if (!existsSync(resolve(root, consumer.file))) {
      fail(
        `runtime consumer ${consumer.file} does not exist.\n` +
          "    A consumer that moved silently shrinks the owed set — re-point this gate at it."
      );
    }
    const sf = parse(root, consumer.file);
    const keys = new Set();
    const visit = (node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === consumer.binding
      ) {
        keys.add(node.name.text);
      }
      // `action!.label`
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isNonNullExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === consumer.binding
      ) {
        keys.add(node.name.text);
      }
      // `const { target, method } = action`
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        node.initializer.text === consumer.binding &&
        node.name &&
        ts.isObjectBindingPattern(node.name)
      ) {
        for (const el of node.name.elements) {
          const p = el.propertyName ?? el.name;
          if (ts.isIdentifier(p)) keys.add(p.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (keys.size === 0) {
      fail(
        `no reads of \`${consumer.binding}.*\` found in ${consumer.file}.\n` +
          "    Either the binding was renamed or the consumer changed shape. An empty read set\n" +
          "    would make every owed set empty and this whole gate vacuously green — which is\n" +
          "    the #4690 anti-pattern the ruling names."
      );
    }
    perFile.set(consumer.file, keys);
  }
  const union = new Set();
  for (const keys of perFile.values()) for (const k of keys) union.add(k);
  return { union, perFile };
}

// ── 3. forwarded(surface) ────────────────────────────────────────────────────
/**
 * The keys of the object literal a surface passes to `execute(...)`.
 *
 * Conditional payload fragments are resolved and UNIONED: `action:button` and
 * `element:button` both route params through
 * `const paramsPayload = Array.isArray(…) ? { actionParams } : { params }` and
 * spread it, so both branches count as forwarded — the runner accepts either as
 * the param-collection definition (ActionRunner.ts:816).
 */
export function forwardedKeys(root, surface, opaqueSpreads = OPAQUE_SPREADS) {
  if (!existsSync(resolve(root, surface.file))) {
    fail(`surface ${surface.id}: ${surface.file} does not exist — re-point this gate at the renderer.`);
  }
  const sf = parse(root, surface.file);

  // Local `const X = …` initializers, for resolving spreads.
  const locals = new Map();
  const collectLocals = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      locals.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectLocals);
  };
  collectLocals(sf);

  const unwrap = (node) => {
    let n = node;
    while (n && (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression?.(n))) {
      n = n.expression;
    }
    return n;
  };

  const calls = [];
  const findCalls = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "execute") {
      const arg = node.arguments.length === 1 ? unwrap(node.arguments[0]) : null;
      if (arg && ts.isObjectLiteralExpression(arg)) calls.push(arg);
    }
    ts.forEachChild(node, findCalls);
  };
  findCalls(sf);

  if (calls.length !== 1) {
    fail(
      `surface ${surface.id}: expected exactly one \`execute({…})\` call in ${surface.file}, found ${calls.length}.\n` +
        "    Zero means the forward site moved or the payload stopped being a literal; more than one\n" +
        "    means the surface has split and each payload needs its own entry in SURFACES. Either way\n" +
        "    the forwarded key set cannot be read, and a gate that cannot read it must not pass."
    );
  }

  const keys = new Set();
  const absorb = (objLiteral, depth = 0) => {
    if (depth > 4) fail(`surface ${surface.id}: spread nesting too deep to resolve in ${surface.file}.`);
    for (const prop of objLiteral.properties) {
      if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
        const name = prop.name;
        if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) keys.add(name.text);
        continue;
      }
      if (ts.isSpreadAssignment(prop)) {
        const expr = unwrap(prop.expression);
        if (ts.isObjectLiteralExpression(expr)) {
          absorb(expr, depth + 1);
          continue;
        }
        if (ts.isIdentifier(expr)) {
          const declared = locals.get(expr.text);
          const resolved = declared ? unwrap(declared) : null;
          const branches = [];
          if (resolved && ts.isConditionalExpression(resolved)) {
            branches.push(unwrap(resolved.whenTrue), unwrap(resolved.whenFalse));
          } else if (resolved && ts.isObjectLiteralExpression(resolved)) {
            branches.push(resolved);
          }
          if (branches.length > 0 && branches.every((b) => ts.isObjectLiteralExpression(b))) {
            for (const b of branches) absorb(b, depth + 1);
            continue;
          }
          if (opaqueSpreads[`${surface.id}:${expr.text}`]) continue;
          fail(
            `surface ${surface.id}: cannot resolve the spread \`...${expr.text}\` in ${surface.file}.\n` +
              "    A spread may carry any key, so treating it as empty would be the silent pass the\n" +
              "    ruling forbids. Either it resolves to object literals this gate can read, or it\n" +
              `    needs an OPAQUE_SPREADS entry keyed "${surface.id}:${expr.text}" saying why its\n` +
              "    source cannot carry authored action keys."
          );
        }
        fail(
          `surface ${surface.id}: unreadable spread in the \`execute({…})\` payload in ${surface.file}.\n` +
            "    The forwarded key set cannot be determined; extraction failure is red by ruling."
        );
      }
    }
  };
  absorb(calls[0]);

  if (keys.size === 0) {
    fail(`surface ${surface.id}: extracted zero forwarded keys from ${surface.file} — extraction failed.`);
  }
  return keys;
}

// ── 4. Diff ──────────────────────────────────────────────────────────────────
/**
 * `owed − forwarded − excused = ∅`, per surface.
 *
 * Returns `{ errors, report, runtimeRead, perFile }`; `errors` is empty when
 * every surface is clean. Anything that stops the inputs being READABLE throws
 * {@link ExtractionError} instead — see the header.
 */
export function analyze(root = REPO_ROOT, options = {}) {
  const {
    surfaces = SURFACES,
    consumers = RUNTIME_CONSUMERS,
    justified = JUSTIFIED,
    knownGaps = KNOWN_GAPS,
    opaqueSpreads = OPAQUE_SPREADS,
    spec = null,
    uiActionView = UI_ACTION_VIEW,
    actionKeysModule = ACTION_KEYS_MODULE,
  } = options;

  const specKeys = spec ?? loadSpecSchemas();
  const uiView = uiActionViewKeys(root, uiActionView);
  const retired = new Set(retiredKeys(root, actionKeysModule));
  const { union: runtimeRead, perFile } = runtimeReadKeys(root, consumers);

  const authorable = {
    declared: new Set([...specKeys.declared, ...uiView]),
    inline: new Set(specKeys.inline),
  };

  const errors = [];
  const matchedJustified = new Set();
  const matchedGaps = new Set();
  const report = [];

  for (const surface of surfaces) {
    const vocabulary = authorable[surface.contract];
    if (!vocabulary) {
      fail(`surface ${surface.id}: unknown contract \`${surface.contract}\` — expected "declared" or "inline".`);
    }
    const owed = [...vocabulary].filter((k) => runtimeRead.has(k) && !retired.has(k)).sort();
    if (owed.length === 0) {
      fail(
        `surface ${surface.id}: owed set is empty.\n` +
          "    Nothing would ever be checked for it — a vacuously green surface is the #4690\n" +
          "    anti-pattern, so this is red."
      );
    }
    const forwarded = forwardedKeys(root, surface, opaqueSpreads);
    const dropped = owed.filter((k) => !forwarded.has(k));

    const unexcused = [];
    const excusedJustified = [];
    const excusedGaps = [];
    for (const key of dropped) {
      const entry = `${surface.id}:${key}`;
      if (justified[entry]) {
        matchedJustified.add(entry);
        excusedJustified.push(key);
      } else if (knownGaps[entry]) {
        matchedGaps.add(entry);
        excusedGaps.push(key);
      } else unexcused.push(key);
    }

    report.push({
      surface,
      owed,
      forwarded: [...forwarded].sort(),
      dropped,
      justified: excusedJustified,
      gaps: excusedGaps,
      unexcused,
    });

    if (unexcused.length > 0) {
      errors.push(
        `${surface.id} (${surface.file}) does not forward ${unexcused.length} key` +
          `${unexcused.length === 1 ? "" : "s"} the runtime reads: \`${unexcused.join("`, `")}\`.\n` +
          `      Each is authorable on this surface's ${surface.contract === "inline" ? "`InlineActionSchema`" : "`ActionSchema`"} ` +
          "contract AND read off the forwarded def at execute time, so it is silently dropped\n" +
          "      one hop before the runner — the objectstack#6837 / #6938 shape. Add it to the\n" +
          "      `execute({…})` payload, or — if the omission is CORRECT — add a JUSTIFIED entry\n" +
          "      naming the guard that makes it unreachable or the renderer that consumes it,\n" +
          "      with the file:line evidence."
      );
    }
  }

  // Ratchet — an entry that excuses nothing must go, or it reserves the key for
  // a future drop under an exemption nobody re-examined.
  for (const [entry, meta] of Object.entries(justified)) {
    if (matchedJustified.has(entry)) continue;
    errors.push(
      `JUSTIFIED entry \`${entry}\` excuses nothing — the key is now forwarded, is no longer\n` +
        "      owed on that surface, or the surface is gone. Delete it: a stale exemption is how\n" +
        "      the next silent drop inherits a reason that was never about it.\n" +
        `      (reason on file: ${meta.reason.slice(0, 90)}…)`
    );
  }
  for (const [entry, meta] of Object.entries(knownGaps)) {
    if (matchedGaps.has(entry)) continue;
    errors.push(
      `KNOWN_GAPS entry \`${entry}\` is no longer a gap — delete it (and close #${meta.issue} once\n` +
        "      its last entry is gone). Left in, it re-reserves the key for a future drop."
    );
  }
  for (const entry of Object.keys(opaqueSpreads)) {
    const surfaceId = entry.slice(0, entry.lastIndexOf(":"));
    const ident = entry.slice(entry.lastIndexOf(":") + 1);
    const surface = surfaces.find((s) => s.id === surfaceId);
    if (!surface || !readFile(root, surface.file).includes(`...${ident}`)) {
      errors.push(
        `OPAQUE_SPREADS entry \`${entry}\` matches no spread in the surface's file — delete it,\n` +
          "      so an unreadable spread cannot inherit an exemption written for a different one."
      );
    }
  }

  return { errors, report, runtimeRead, perFile, authorable };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  let result;
  try {
    result = analyze(REPO_ROOT);
  } catch (error) {
    if (!(error instanceof ExtractionError)) throw error;
    console.error(`❌  action forward parity: ${error.message}`);
    process.exit(1);
  }

  const { errors, report, runtimeRead, perFile } = result;

  if (errors.length === 0) {
    const gaps = Object.keys(KNOWN_GAPS).length;
    const justifiedCount = Object.keys(JUSTIFIED).length;
    console.log(
      `✅  action forward parity: ${SURFACES.length} surfaces checked against ${runtimeRead.size} runtime-read keys ` +
        `from ${perFile.size} consumers; ${justifiedCount} justified omission` +
        `${justifiedCount === 1 ? "" : "s"}, ${gaps} known gap${gaps === 1 ? "" : "s"}.`
    );
    for (const r of report) {
      console.log(
        `    ${r.surface.id.padEnd(14)} owes ${String(r.owed.length).padStart(2)}, ` +
          `forwards ${String(r.forwarded.length).padStart(2)}`
      );
    }
    process.exit(0);
  }

  console.error("❌  an action renderer drops a key the runtime reads:\n");
  for (const message of errors) console.error(`    • ${message}\n`);
  console.error(
    "Every instance of this class shipped green: the key parses, publishes, and reads as\n" +
      "honoured while the payload is dropped one hop before the runner. See\n" +
      "https://github.com/objectstack-ai/objectui/issues/4050 for the six that were found by\n" +
      "hand before this gate existed."
  );
  process.exit(1);
}
