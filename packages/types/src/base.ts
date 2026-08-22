/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Base Schema Types
 * 
 * The foundational type definitions for the Object UI schema protocol.
 * These types define the universal interface for all UI components.
 * 
 * @module base
 * @packageDocumentation
 */

import type { I18nLabel } from '@objectstack/spec/ui';

/**
 * A KEYED i18n label — a reference INTO a translation bundle (objectui#4581).
 *
 * This is objectui's own label vocabulary, and it is NOT the spec's
 * `I18nLabel`. The two are structurally confusable and answer wrongly for each
 * other's input, silently — objectui#4167 is the card that names the hazard,
 * and PR #4169 the one that had to alias five imports by hand because neither
 * shape had a name that said which it was:
 *
 * - KEYED (this type): `{ key, defaultValue?, params? }`, resolved against a
 *   translation bundle by `resolveKeyedI18nLabel`
 *   (`packages/react/src/utils/i18n.ts`, and the `t`-taking twin in
 *   `packages/app-shell/src/utils/index.ts`).
 * - INLINE (`I18nLabel`, re-exported from `@objectstack/spec/ui`):
 *   `string | Record<string, string>` — a locale MAP like
 *   `{ en: 'Owner' }` — resolved against a BCP-47 locale by the spec's own
 *   `resolveI18nLabel(label, locale)`.
 *
 * The shape below is the census of the three inline copies that existed before
 * this type was minted — `packages/react/src/utils/i18n.ts`,
 * `packages/layout/src/NavigationRenderer.tsx` and
 * `packages/app-shell/src/utils/index.ts` — which were verified identical in
 * their object half first. It is a NAME for what was already there, not a new
 * capability.
 */
export type KeyedI18nLabel = {
  /** Translation-bundle key, e.g. `dialog.close`. */
  key: string;
  /** Rendered when the key is missing from the bundle, or no `t` is available. */
  defaultValue?: string;
  /** Interpolation values for the key's placeholders, e.g. `{{name}}`. */
  params?: Record<string, any>;
};

/**
 * Base schema interface that all component schemas extend.
 * This is the fundamental building block of the Object UI protocol.
 * 
 * @example
 * ```typescript
 * const schema: BaseSchema = {
 *   type: 'text',
 *   id: 'greeting',
 *   className: 'text-lg font-bold',
 *   data: { message: 'Hello World' }
 * }
 * ```
 */
export interface BaseSchema {
  /**
   * Component type identifier. Determines which renderer to use.
   * @example 'input', 'button', 'form', 'grid'
   */
  type: string;

  /**
   * Unique identifier for the component instance.
   * Used for state management, event handling, and React keys.
   */
  id?: string;

  /**
   * Human-readable name for the component.
   * Used for form field names, labels, and debugging.
   */
  name?: string;

  /**
   * Display label for the component.
   * Often used in forms, cards, and other UI elements.
   *
   * Accepts the spec's INLINE LOCALE MAP as well as a plain string
   * (objectui#4580, revised Q1 ruling — option A), because that is what a spec
   * producer already writes into this slot: `bridgeListView` assigns
   * `node.label = spec.label` at
   * `packages/react/src/spec-bridge/bridges/list-view.ts:180`, and `ListView`'s
   * own `label` is the spec's `I18nLabel`. Under the old `string` declaration
   * that assignment was a type error the moment `SchemaNode` stopped being
   * core's index-signature interface — the defect this widening resolves, not a
   * capability being invented here.
   *
   * ## Which vocabulary this is, and who resolves it
   *
   * This slot — and {@link BaseSchema.description} two lines down — carries the
   * spec's INLINE form: `I18nLabel` = `string | Record<string, string>`, a
   * locale MAP like `{ en: 'Owner', 'zh-CN': '负责人' }`, resolved against a
   * BCP-47 locale by the spec's own `resolveI18nLabel(label, locale)` from
   * `@objectstack/spec/ui`. Its documented fallback order is exact match →
   * base/region (`zh-CN` ↔ `zh`) → last resort (any remaining entry), and it
   * returns `undefined` when nothing matched, so read sites pair it with
   * `?? someDefault`.
   *
   * ⚠️ {@link BaseSchema.ariaLabel}, two properties below, carries the OTHER
   * vocabulary — the KEYED form {@link KeyedI18nLabel} (`{ key, defaultValue?,
   * params? }`), a reference INTO a translation bundle, resolved by
   * `resolveKeyedI18nLabel`. One interface now carries both, two properties
   * apart, and they are structurally confusable: a keyed ref typed into this
   * slot is accepted only *vacuously*, as a locale map whose "locales" are
   * named `key` and `defaultValue`. That is objectui#4167's hazard, inherent to
   * the spec's `I18nLabel` design and present on every spec surface using it;
   * naming both shapes with cross-referenced docs is the accepted mitigation
   * (#4580's revised Q1 ruling states this cost and accepts it).
   *
   * ## Resolution happens at READ time, not at the bridge
   *
   * The renderer resolves this against the display locale — `useDisplayLocale()`
   * where the read site is in an i18n-reachable package, a locale threaded
   * through props/context where it is not (`packages/layout` carries no i18n
   * dependency). Resolving at the spec bridge was ruled out and measured
   * unimplementable in PR #4603: the bridge is a plain class method that cannot
   * call a hook, `BridgeContext` declares no locale, and `updateContext()` has
   * zero callers — so a bridge-resolved label would freeze one audience's
   * language into the node tree with no re-translation channel, the defect the
   * spec's own resolver doc records as #6761.
   *
   * @example "Submit"
   * @example { en: 'Submit', 'zh-CN': '提交' }
   */
  label?: string | I18nLabel;

  /**
   * Descriptive text providing additional context.
   * Typically rendered as help text below the component.
   *
   * Accepts the spec's INLINE LOCALE MAP as well as a plain string on exactly
   * the {@link BaseSchema.label} evidence one slot over (objectui#4580, revised
   * Q1 ruling): `bridgeListView` assigns `node.description = spec.description`
   * at `packages/react/src/spec-bridge/bridges/list-view.ts:224`, where the
   * spec's `ListView.description` is an `I18nLabel`. Same vocabulary, same
   * resolver (`resolveI18nLabel` against the display locale), same
   * confusability warning against {@link BaseSchema.ariaLabel}'s keyed form —
   * see {@link BaseSchema.label} for the full statement.
   *
   * @example "Shown below the field"
   * @example { en: 'Shown below the field', 'zh-CN': '显示在字段下方' }
   */
  description?: string | I18nLabel;

  /**
   * Placeholder text for input components.
   * Provides hints about expected input format or content.
   */
  placeholder?: string;

  /**
   * Tailwind CSS classes to apply to the component.
   * This is the primary styling mechanism in Object UI.
   * @example 'bg-blue-500 text-white p-4 rounded-lg'
   */
  className?: string;

  /**
   * Inline CSS styles as a JavaScript object.
   * Use sparingly - prefer className with Tailwind.
   * @example { backgroundColor: '#fff', padding: '16px' }
   */
  style?: Record<string, string | number>;

  /**
   * Arbitrary data attached to the component.
   * Can be used for custom properties, state, or context.
   */
  data?: any;

  /**
   * Child components or content.
   * Can be a single component, array of components, or primitive values.
   */
  body?: SchemaNode | SchemaNode[];

  /**
   * Alternative name for children (React-style).
   * Some components use 'children' instead of 'body'.
   */
  children?: SchemaNode | SchemaNode[];

  /**
   * Controls whether the component is visible.
   * When false, component is not rendered (display: none).
   *
   * Accepts a PREDICATE STRING as well as a boolean (objectui#4581): the
   * renderer does not read this key as a boolean, it evaluates it —
   * `SchemaRenderer.tsx:382` calls `evaluator.evaluateCondition(schema.visible)`,
   * and `evaluateCondition` is declared
   * `(condition: string | boolean | undefined, context?) => boolean`. The
   * sibling keys `visibleWhen` and the deprecated `visibleOn` are `string` for
   * the same reason; this one simply under-reported the capability, and
   * fixtures exercising it had to cast past the declaration.
   *
   * @default true
   * @example true
   * @example "${data.role === 'admin'}"
   */
  visible?: boolean | string;

  /**
   * Canonical conditional-visibility predicate (ADR-0089) — the element is shown
   * when this evaluates truthy. The spec folds the deprecated `visibleOn` /
   * `visibility` aliases into this key at parse.
   * @example "${data.role === 'admin'}"
   */
  visibleWhen?: string;

  /**
   * Expression for conditional visibility.
   * Evaluated against the current data context.
   * @deprecated ADR-0089 — use `visibleWhen`.
   * @example "${data.role === 'admin'}"
   */
  visibleOn?: string;

  /**
   * Controls whether the component is hidden (but still rendered).
   * When true, component is rendered but not visible (visibility: hidden).
   * @default false
   */
  hidden?: boolean;

  /**
   * Expression for conditional hiding.
   * @example "${!data.isActive}"
   */
  hiddenOn?: string;

  /**
   * Controls whether the component is disabled.
   * Applies to interactive components like buttons and inputs.
   *
   * Accepts a PREDICATE STRING as well as a boolean (objectui#4581), on exactly
   * the `visible` evidence one slot over: the renderer does not read this key
   * as a boolean, it evaluates it — `SchemaRenderer.tsx:466` calls
   * `evaluator.evaluateCondition(newSchema.disabled)`, and `evaluateCondition`
   * is declared
   * `(condition: string | boolean | undefined, context?) => boolean`. The
   * sibling key `disabledOn` is `string` for the same reason. The asymmetry
   * with `visible` was accidental rather than deliberate (#4580 ruling Q3-A);
   * the two fixtures exercising it had been casting past the declaration.
   *
   * @default false
   * @example false
   * @example "${data.status === 'locked'}"
   */
  disabled?: boolean | string;

  /**
   * Expression for conditional disabling.
   * @example "${data.status === 'locked'}"
   */
  disabledOn?: string;

  /**
   * Test ID for automated testing.
   * Rendered as data-testid attribute.
   */
  testId?: string;

  /**
   * Accessibility label for screen readers.
   * Rendered as aria-label attribute.
   *
   * Accepts the KEYED i18n form as well as a plain string (objectui#4581),
   * because that is what the renderer resolves:
   * `packages/react/src/SchemaRenderer.tsx:111` reads
   * `aria['aria-label'] = resolveKeyedI18nLabel(schema.ariaLabel)`, and
   * `resolveKeyedI18nLabel` accepts `{ key, defaultValue?, params? }` — the
   * shape now named {@link KeyedI18nLabel}.
   *
   * NOT `I18nLabel`. The original #4581 text asked for `string | I18nLabel`,
   * and PR #4593 measured that spelling wrong in three ways before the ruling
   * withdrew it (#4580 Q2-B): `I18nLabel` is the spec's INLINE LOCALE MAP
   * (`string | Record<string, string>`), so the shipped keyed fixture was
   * accepted only *vacuously* — as a locale map whose "locales" are named `key`
   * and `defaultValue`; the same label carrying `params` was REJECTED
   * (`Type '{ name: string; }' is not assignable to type 'string'`); and a
   * genuine `{ en: 'Owner' }` type-checked while `resolveKeyedI18nLabel`
   * returns `undefined` for it, rendering an EMPTY aria-label. The two
   * vocabularies are structurally confusable — objectui#4167's exact hazard.
   *
   * ⚠️ That hazard is now LIVE ON THIS INTERFACE, not just adjacent to it:
   * since #4580's revised Q1 ruling, {@link BaseSchema.label} and
   * {@link BaseSchema.description} declare the spec's INLINE map (`I18nLabel`,
   * resolved by `resolveI18nLabel(label, locale)`), while this slot declares
   * the KEYED ref (resolved by `resolveKeyedI18nLabel`). Two properties apart,
   * both spelled `string | {object}`, and each accepts the other's shape
   * vacuously. Check which resolver owns a slot before writing an object into
   * it; the ruling accepted this cost with exactly this naming + cross-
   * referencing as the mitigation.
   *
   * @example "Close dialog"
   * @example { key: 'dialog.close', defaultValue: 'Close dialog' }
   */
  ariaLabel?: string | KeyedI18nLabel;

  /**
   * Additional properties specific to the component type.
   * This index signature allows type-specific extensions.
   */
  [key: string]: any;
}

/**
 * A schema node can be a full schema object or a primitive value.
 * This union type supports both structured components and simple content.
 * 
 * @example
 * ```typescript
 * const nodes: SchemaNode[] = [
 *   { type: 'text', value: 'Hello' },
 *   'Plain string',
 *   { type: 'button', label: 'Click' }
 * ]
 * ```
 */
export type SchemaNode = BaseSchema | string | number | boolean | null | undefined;

/**
 * Component renderer function type.
 * Accepts a schema and returns a rendered component.
 * Framework-agnostic - can be React, Vue, or any other renderer.
 */
export interface ComponentRendererProps<TSchema extends BaseSchema = BaseSchema> {
  /**
   * The schema object to render
   */
  schema: TSchema;

  /**
   * Additional properties passed to the renderer
   */
  [key: string]: any;
}

/**
 * One coarse control kind a {@link ComponentInput} may declare.
 *
 * Named and exported (objectui#3832) because an input's `type` is no longer a
 * single one of these: it is one OR an array of them, and both the declaration
 * sites and the consumers that read it need the arm vocabulary by name rather
 * than re-spelling the eleven literals. Widening it is a contract change — see
 * `ComponentInputSchema` in `zod/base.zod.ts`, which enforces the same set.
 */
export type ComponentInputControlType =
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

/**
 * Input field configuration for component metadata.
 * Describes what properties a component accepts in the designer/editor.
 */
export interface ComponentInput {
  /**
   * Property name (must match schema property)
   */
  name: string;

  /**
   * Input control type — ONE coarse kind, or an ARRAY of them when the key's
   * contract is a union (objectui#3832).
   *
   * The array form exists because a spec key is often a union while this field
   * used to be a single kind, so a declaration had to pick one arm and the
   * repo's own manifest gate then reported the other arm's legal values:
   * `sdui-parser`'s `checkType` warned `type-mismatch` on the inline
   * translation maps (`{ en, "zh-CN" }`) that the very same inputs' own
   * `description` teaches an author to write. One platform authority
   * contradicting itself on the write it just recommended, at warning severity
   * — which is worse than it sounds, because noise on legal writes trains
   * authors (AI authors included) to dismiss the `unknown-prop` and
   * `type-mismatch` reports that ARE real.
   *
   * Semantics of the array form: the arms are alternatives, and a value passes
   * validation when ANY arm accepts it. That is the only leniency — a value
   * matching none of the declared arms is still reported, so a union is not a
   * way to opt out of the gate. Declare only arms the contract accepts AND the
   * renderer resolves; an arm the renderer drops advertises a shape that never
   * reaches the screen. `element:record_picker.emptyText` was held at a single
   * `'string'` arm for exactly that reason until objectui#5590 taught its render
   * site to resolve the inline locale map, and the second arm was declared in
   * that same change — which is the order this rule prescribes, not an
   * exception to it.
   *
   * The single-kind form stays valid and unchanged, and it is the canonical
   * spelling for a key with one arm: the manifest serializer collapses a
   * one-element array back to the bare string, so the published
   * `sdui.manifest.json` gains arrays only where a union was really declared.
   *
   * ## The arms are COARSE KINDS — and that is the ceiling (objectui#5006)
   *
   * An arm names a value's *kind*, never its *domain*. `'number'` is the only
   * numeric arm and `ComponentInput` has no `integer` / `min` / `max` slot to
   * pair with it, so a key whose contract is narrower than "some number" has
   * no way to say so here. Worked example — `page:header.maxVisible`, whose
   * spec type is a POSITIVE SAFE INTEGER: `@objectstack/spec` rejects `0`,
   * `-1` and `1.5`, while this declaration's `'number'` arm admits all three
   * and `checkType` raises no diagnostic on any of them.
   *
   * **Ruled (maintainer, 2026-08-17): the coarse arm plus `description` IS the
   * publication face's expression ceiling today, and SPEC IS THE SOLE JUDGE OF
   * VALUES.** So spell the domain out in `description`, in the author's own
   * terms ("A positive integer — the contract rejects 0 and fractional
   * values"), and let `os validate` / `os build` be the gate that enforces it.
   * `description` documents, it does not check: objectui deliberately raises
   * no authoring-time diagnostic on an out-of-domain value. A *renderer*
   * reading such a key should therefore agree with spec rather than tolerate
   * what spec rejects — `page:header`'s `readMax` was tightened to exactly the
   * contract for this reason, so the loosest layer stops deciding behaviour.
   *
   * Two directions were **deferred**, not rejected on merit: giving
   * `ComponentInput` real constraint slots (two sources of truth, free to
   * drift), and binding `checkType` to spec's Zod member when a
   * `ComponentPropsMap` entry exists (one truth, but couples `sdui-parser` to
   * spec). The ruling names the reopen condition: **a measured case of an
   * author — human or agent — shipping a spec-rejected value that objectui's
   * silence let through.** Until that is measured, do not widen this field.
   *
   * @example 'string'
   * @example ['string', 'object']   // a string or an inline translation map
   * @example ['string', 'number']   // element:text_input.defaultValue
   */
  type: ComponentInputControlType | ComponentInputControlType[];

  /**
   * Display label in the editor
   */
  label?: string;

  /**
   * Default value for new instances
   */
  defaultValue?: any;

  /**
   * Whether this property is required
   */
  required?: boolean;

  /**
   * Enum options (for type='enum')
   */
  enum?: string[] | { label: string; value: any }[];

  /**
   * Help text or description
   */
  description?: string;

  /**
   * Whether this is an advanced/expert option
   */
  advanced?: boolean;

  /**
   * Specific input type (e.g., 'email', 'password' for string)
   */
  inputType?: string;

  /**
   * Minimum value (for number/date)
   */
  min?: number;

  /**
   * Maximum value (for number/date)
   */
  max?: number;

  /**
   * Step value (for number)
   */
  step?: number;

  /**
   * Placeholder text
   */
  placeholder?: string;
}

/**
 * Component metadata for registration and designer integration.
 * Describes the component's capabilities, defaults, and documentation.
 */
export interface ComponentMeta {
  /**
   * Display name in designer/palette
   */
  label?: string;

  /**
   * Icon name or SVG string
   */
  icon?: string;

  /**
   * Category for grouping (e.g., 'Layout', 'Form', 'Data Display')
   */
  category?: string;

  /**
   * Configurable properties
   */
  inputs?: ComponentInput[];

  /**
   * Default property values for new instances
   */
  defaultProps?: Record<string, any>;

  /**
   * Example configurations for documentation
   */
  examples?: Record<string, any>;

  /**
   * Whether the component can have children
   */
  isContainer?: boolean;

  /**
   * Whether the component can be resized in the designer
   */
  resizable?: boolean;

  /**
   * Resize constraints (which dimensions can be resized)
   */
  resizeConstraints?: {
    width?: boolean;
    height?: boolean;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };

  /**
   * Tags for search/filtering
   */
  tags?: string[];

  /**
   * Description for documentation
   */
  description?: string;
}

/**
 * Complete component configuration combining renderer and metadata.
 */
export interface ComponentConfig extends ComponentMeta {
  /**
   * Unique component type identifier
   */
  type: string;

  /**
   * The component renderer (framework-specific)
   */
  component: any;
}

/**
 * Common HTML attributes that can be applied to components
 */
export interface HTMLAttributes {
  id?: string;
  className?: string;
  style?: Record<string, any>;
  title?: string;
  role?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'data-testid'?: string;
}

/**
 * Event handler types
 */
export interface EventHandlers {
  onClick?: (event?: any) => void | Promise<void>;
  onChange?: (value: any, event?: any) => void | Promise<void>;
  onSubmit?: (data: any, event?: any) => void | Promise<void>;
  onFocus?: (event?: any) => void;
  onBlur?: (event?: any) => void;
  onKeyDown?: (event?: any) => void;
  onKeyUp?: (event?: any) => void;
  onMouseEnter?: (event?: any) => void;
  onMouseLeave?: (event?: any) => void;
}

/**
 * Common style properties using Tailwind's semantic naming
 */
export interface StyleProps {
  /**
   * Padding (Tailwind scale: 0-96)
   */
  padding?: number | string;

  /**
   * Margin (Tailwind scale: 0-96)
   */
  margin?: number | string;

  /**
   * Gap between flex/grid items (Tailwind scale: 0-96)
   */
  gap?: number | string;

  /**
   * Background color
   */
  backgroundColor?: string;

  /**
   * Text color
   */
  textColor?: string;

  /**
   * Border width
   */
  borderWidth?: number | string;

  /**
   * Border color
   */
  borderColor?: string;

  /**
   * Border radius
   */
  borderRadius?: number | string;
}
