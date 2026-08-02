import { FieldMetadata } from '@object-ui/types';

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
 * validation message here and nothing reports it. That divergence is recorded,
 * not resolved, by this rename — see the tripwire in
 * `__tests__/spec-symbol-batch7.test.tsx`.
 *
 * `[key: string]: any` below is load-bearing for the widgets' `...props`
 * spreads, and it is also why the drift above was invisible: the index
 * signature answers `any` for every key this type does not declare, so
 * `props.required` and `props.error` are legal reads that are always
 * `undefined` — a type that claims to have every key can never be reported as
 * missing one (the objectstack#4075 mechanism; only the symbol guard can see a
 * collision like this, a parity test cannot in principle). Removing it is a
 * separate change with a real blast radius: objectui#3221.
 */
export type FieldWidgetComponentProps<T = any> = {
  value: T;
  onChange: (val: T) => void;
  // Use a looser type for field to avoid complex circular dependencies for now
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
  [key: string]: any;
}
