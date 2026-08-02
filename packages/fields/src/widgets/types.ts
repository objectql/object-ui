import type { AriaAttributes, FocusEventHandler, MouseEventHandler } from 'react';
import type { DependsOnInput, FieldMetadata } from '@object-ui/types';

/**
 * Props every field widget in this package receives at RUNTIME.
 *
 * Named `FieldWidgetComponentProps`, not `FieldWidgetProps` (objectui#3161,
 * objectstack#4115 ledger batch 7), adopting the name `@object-ui/app-shell`
 * settled on for the same split in objectui#3169: `@objectstack/spec/ui` owns
 * `FieldWidgetProps` for the DECLARED widget-plugin contract — a zod object
 * (`FieldWidgetPropsSchema`) a plugin manifest is validated against, with
 * `field` narrowed to `{ name?, label?, type: <the FieldType enum> }` and
 * `readonly` / `required` carrying `.default()`s. This is the React interface
 * the widgets in this directory actually implement, against
 * `@object-ui/types`'s much richer `FieldMetadata`.
 *
 * The two are NOT interchangeable, and the divergence is not cosmetic: the
 * spec's contract names the error slot `error`, this one names it
 * `errorMessage`, so a widget written to the spec's declared props renders no
 * validation message here. That divergence is tracked in objectui#3222 and is
 * deliberately NOT resolved here — but it is now *visible*: reading
 * `props.error` or `props.required` off this type is a compile error rather
 * than a silent `any`.
 *
 * ## Why there is no `[key: string]: any` (objectui#3221)
 *
 * This type used to end in an index signature, "load-bearing" for the widgets'
 * `...props` spreads. It was also why every drift above was invisible: **a type
 * that claims to have every key can never be reported as missing one** (the
 * objectstack#4075 mechanism). `props.required` and `props.error` were legal
 * reads typed `any` and always `undefined` at runtime; a misspelled prop
 * (`readOnly` for `readonly`, `onchange` for `onChange`) compiled; and any
 * structural/parity comparison against the type was useless *in principle*,
 * which is why the batch-7 symbol guard was the only detector that could see
 * the collision at all.
 *
 * It is replaced by the CLOSED set below: the controlled-input contract, the
 * host plumbing the form renderer genuinely forwards, and a DOM pass-through
 * allowance. `data-*` is an open family by design (it is open in HTML too) and
 * is expressed as a template-literal index signature, which — unlike
 * `[key: string]` — leaves `keyof` finite, so an undeclared prop still fails.
 *
 * Adding a key here is a contract change: say who produces it and who reads it.
 */
export type FieldWidgetComponentProps<T = any> = {
  /* ── The controlled-input contract every widget implements ─────────────── */

  value: T;
  onChange: (val: T) => void;
  /**
   * The field's metadata. Deliberately the looser `@object-ui/types` shape
   * rather than the spec's, to avoid a circular dependency for now.
   */
  field: FieldMetadata;
  readonly?: boolean;
  disabled?: boolean;
  className?: string;
  errorMessage?: string;
  /**
   * Upload widgets (`file`/`image`) fire this when their in-progress state
   * flips, so a host can block submit until a presigned upload settles. Other
   * widgets ignore it.
   */
  onUploadingChange?: (uploading: boolean) => void;

  /* ── Host plumbing: what a rendering host actually forwards ─────────────── */

  /**
   * The raw authored node the widget was rendered from. Two hosts supply it:
   * `SchemaRenderer` (`<Component schema={schema} {...schema} />`) and the
   * form renderer's `renderFieldComponent` (`schema={props.field || ...}`),
   * which is why ~25 widgets read `field || schema` for their config.
   *
   * This is a second carrier for what `field` already means, i.e. a de-facto
   * second contract (AGENTS.md #0.1) — declared here so it is at least
   * visible; converging the two is tracked separately.
   */
  schema?: FieldMetadata | Record<string, unknown>;
  /**
   * DataSource for widgets that query records (lookup / user / object-ref /
   * recipient-picker / grid). Injected by the form renderer for the field
   * types that need it, and passed directly by inline-edit hosts. Option
   * widgets destructure it purely to keep it off their DOM spread.
   *
   * Left structural (`unknown`): `@object-ui/fields` must not depend on a
   * concrete adapter — every consumer narrows it itself.
   */
  dataSource?: unknown;
  /**
   * Live sibling-field values driving cascading / role-gated options and
   * dependent lookups (ADR-0058, #2215/#2284). The form renderer passes the
   * in-progress record; widgets fall back to `SchemaRendererContext`.
   */
  dependentValues?: Record<string, unknown>;
  /**
   * Controlling field(s) that gate this field's option list. Normally declared
   * on the field metadata; accepted as a prop so a host can drive the gate for
   * a field it synthesised. Field metadata wins when both are present.
   */
  dependsOn?: DependsOnInput;
  /**
   * Hint shown when a dependency-gated option list is still waiting on its
   * controlling field. Forwarded by the form renderer; the option widgets in
   * this package currently discard it and render their own message instead.
   */
  emptyHint?: string;
  /**
   * Render as a single-line, borderless control for a grid cell (the inline
   * editor and the line-item grid set it) instead of the full form layout.
   */
  compact?: boolean;
  /**
   * Receive the FULL selected record rather than just its id, so a host can
   * auto-fill sibling fields from it (a line-item grid copying a product's
   * price). When provided, the host owns the resulting value change.
   */
  onSelectRecord?: (record: Record<string, any>) => void;
  /**
   * Offer a "create new" affordance in a record picker, carrying whatever the
   * user had typed. Also declarable on the field metadata.
   */
  onCreateNew?: (searchQuery: string) => void;

  /* ── DOM pass-through: what `...props` may legitimately reach an input ──── */

  id?: string;
  /** react-hook-form's field name, spread in by the form renderer. */
  name?: string;
  autoFocus?: boolean;
  tabIndex?: number;
  onBlur?: FocusEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onClick?: MouseEventHandler<HTMLElement>;
} & AriaAttributes & {
  /**
   * Arbitrary `data-*` attributes (test ids, analytics hooks). Open by design,
   * but a template-literal key — `keyof` stays finite, so this does NOT
   * reintroduce the index signature objectui#3221 removed: `props.required`
   * is still an error, `props['data-testid']` is still fine.
   */
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};
