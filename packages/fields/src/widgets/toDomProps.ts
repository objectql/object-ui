/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FieldWidgetComponentProps } from './types';

/**
 * The RUNTIME EXECUTOR of the "DOM pass-through" section of
 * {@link FieldWidgetComponentProps} (objectui#3291).
 *
 * ## The defect
 *
 * Field widgets forwarded their leftover props to a control with a bare
 * spread — `const { inputType, ...domProps } = props as any; <Input
 * {...domProps} />`. Whatever a host handed the widget therefore became a DOM
 * attribute. Measured on `origin/main`, a real form + a real widget:
 *
 * ```
 * <input placeholder="PH-f" zzcanary="CANARY-STR" zzcanaryobj="[object Object]"
 *        zzcanarynum="42" id="…" type="text" value="" name="f">
 * ```
 *
 * The `[object Object]` this issue is named for is an authored field-config
 * key being `String()`-ed onto an attribute. React 19 does not warn: an
 * all-lowercase unknown attribute is passed through in complete silence, which
 * is why this survived so long.
 *
 * ## Why a whitelist, and not a list of keys to drop
 *
 * The biggest leak source is not any NAMED renderer prop — it is the open tail
 * of author-supplied keys. The form renderer destructures a fixed set of known
 * keys and forwards `...fieldProps` verbatim
 * (`components/src/renderers/form/form.tsx`), and `SchemaRenderer` is wider
 * still: it spreads the whole authored node as props and has no strip layer at
 * all, so on the SDUI path a widget's own spread is the ONLY line of defence.
 *
 * A blacklist enumerating today's renderer-only keys (`error`, `emptyHint`,
 * `dataSource`, `dependentValues`, `dependsOn`, `options`, `inputType`, …)
 * would pass every one of the canaries above and would not stop the next
 * authored key either. Only "keep the known-safe set, drop the rest" closes
 * it, which is what this function does.
 *
 * ## Declared = enforced
 *
 * {@link FieldWidgetComponentProps} already DECLARES the closed set of keys a
 * widget may receive, including which of them may legitimately reach a DOM
 * element (objectui#3221). Until now that was a type-level claim a widget
 * could violate at runtime simply by spreading. This function is that
 * declaration's executable form, and the assertion below makes the link
 * mechanical: a key forwarded here that is not declared on the contract is a
 * compile error, so the two cannot drift apart.
 *
 * ## Deliberately NOT forwarded
 *
 * `role` and other HTML global attributes are absent because the contract does
 * not declare them. They reached the DOM before this change only through the
 * open spread. If a field node should be able to author one, DECLARE it on
 * `FieldWidgetComponentProps` first and add it here — do not reopen the spread
 * (AGENTS.md #0.1: fix the contract, never widen the consumer).
 */
const DOM_PASS_THROUGH_KEYS = [
  /* ── The contract's own "DOM pass-through" block, verbatim ─────────────── */
  'id',
  'name',
  'autoFocus',
  'tabIndex',
  'onBlur',
  'onFocus',
  'onClick',

  /* ── Two more declared keys that ARE valid DOM attributes ──────────────── */
  //
  // Both are declared on `FieldWidgetComponentProps` under the
  // controlled-input contract rather than the DOM block, because widgets also
  // INTERPRET them (`className` gets composed with the widget's own classes;
  // `disabled` is OR-ed with `readonly`). They are still `class` and
  // `disabled` on the element, and every widget here already forwards them.
  //
  // Withholding them would make this helper a silent styling- and
  // interactivity-dropper: `<Input {...toDomProps(props)} />` — the shape this
  // change teaches every future widget author to write — would quietly lose
  // the host's className and disabled state. That is a NEW silent failure of
  // exactly the kind the whitelist exists to prevent, so they are forwarded.
  'className',
  'disabled',
] as const;

type DomPassThroughKey = (typeof DOM_PASS_THROUGH_KEYS)[number];

/**
 * Compile-time link to the declaration: every key forwarded at runtime must
 * exist on {@link FieldWidgetComponentProps}. Deleting a key from the contract
 * without deleting it here fails `pnpm --filter @object-ui/fields type-check`,
 * which is what keeps this helper from becoming a second, drifting contract.
 */
type EveryForwardedKeyIsDeclared =
  DomPassThroughKey extends keyof FieldWidgetComponentProps ? true : never;
const _everyForwardedKeyIsDeclared: EveryForwardedKeyIsDeclared = true;
void _everyForwardedKeyIsDeclared;

const DOM_PASS_THROUGH: ReadonlySet<string> = new Set<string>(DOM_PASS_THROUGH_KEYS);

/**
 * `aria-*` is declared on the contract as React's `AriaAttributes`; `data-*`
 * is declared as an open template-literal family (open in HTML too, and the
 * only open family the contract has). Both are matched by prefix so the helper
 * needs no per-attribute list.
 */
function isOpenDomFamily(key: string): boolean {
  return key.startsWith('data-') || key.startsWith('aria-');
}

/** The subset of `P` this helper forwards, with each key's declared type. */
export type DomProps<P> = Pick<P, Extract<keyof P, DomPassThroughKey>> & {
  [K in Extract<keyof P, `data-${string}` | `aria-${string}`>]: P[K];
};

/**
 * Keep only what may legitimately become a DOM attribute, and drop everything
 * else — renderer plumbing, and any extra key an author put on the field
 * config or SDUI node.
 *
 * Replaces the bare `{...props}` spread in every field widget that renders a
 * host element:
 *
 * ```tsx
 * // before — forwards whatever it was handed
 * const { inputType, ...domProps } = props as any;
 * return <Input {...domProps} … />;
 *
 * // after
 * return <Input {...toDomProps(props)} … />;
 * ```
 *
 * Semantic props a widget INTERPRETS (`value`, `onChange`, `field`,
 * `readonly`, `error`, …) are read from `props` as before; this function only
 * governs what gets spread.
 */
export function toDomProps<P extends object>(props: P): DomProps<P> {
  const domProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (DOM_PASS_THROUGH.has(key) || isOpenDomFamily(key)) {
      domProps[key] = (props as Record<string, unknown>)[key];
    }
  }
  return domProps as DomProps<P>;
}
