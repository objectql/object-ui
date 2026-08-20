import React from 'react';
import { cn, Textarea, EmptyValue, type FullscreenEditorAria } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/react';
import { FullscreenFieldEditor } from './FullscreenFieldEditor.js';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps, type DomProps } from './toDomProps.js';

/**
 * The rich-text editing surface, rendered by `RichTextField` in BOTH positions:
 * inline in the form, and inside the fullscreen dialog.
 *
 * Sharing it is the point of objectui#3301's acceptance criterion "the dialog
 * holds the real editor". Had the dialog inlined a bare `<Textarea>` instead,
 * the two surfaces would already disagree (no format indicator) and would keep
 * disagreeing every time this widget gains an affordance — whatever the editor
 * grows into (a toolbar, a TipTap/Lexical instance, a preview toggle), both
 * positions get it at once because there is only one of them.
 *
 * `fullHeight` is the only difference between the two renderings: inline the
 * textarea is `rows`-sized, in the dialog it fills the available height.
 *
 * The `<Textarea>` below is this widget's ONE focusable control, so it is where
 * the host's DOM pass-through has to land (objectui#4810) — see `domProps`.
 */
function RichTextEditorSurface({
  value,
  onChange,
  formatLabel,
  hint,
  placeholder,
  rows,
  disabled,
  error,
  className,
  fullHeight,
  autoFocus,
  textareaTestId,
  overlay,
  domProps,
  editorAria,
}: {
  value: string;
  onChange: (next: string) => void;
  formatLabel: string;
  hint: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  error?: string;
  className?: string;
  fullHeight?: boolean;
  autoFocus?: boolean;
  textareaTestId?: string;
  /** Absolutely-positioned children over the textarea (the expand affordance). */
  overlay?: React.ReactNode;
  /**
   * The host's DOM pass-through (objectui#4810), already filtered through the
   * `toDomProps` whitelist by the caller — the field's `id`, the
   * `aria-describedby` `<FormControl>`'s Slot minted, `name`, `tabIndex`, the
   * focus handlers.
   *
   * Given to the INLINE surface only, and that is a statement about the dialog
   * rather than an omission: the host id is unique per form item, so handing it
   * to a second `<Textarea>` mounted at the same time would put two elements
   * under one id and make the visible label's `for` ambiguous, and the ids the
   * host's `aria-describedby` names sit OUTSIDE the dialog, which Radix
   * `aria-hidden`s while the modal is open. Exactly the split `TextAreaField`
   * makes for the same pair of surfaces.
   */
  domProps?: DomProps<FieldWidgetComponentProps<string>>;
  /**
   * The accessibility set `FullscreenFieldEditor` computes for the control it
   * hosts — accessible name and validation state (objectui#4824 / #4832).
   *
   * The mirror image of `domProps`: given to the DIALOG rendering only, because
   * only the dialog rendering has a name and a message node to be pointed at
   * from inside the modal. The inline surface takes both from the host, through
   * `domProps` and its own `error`.
   *
   * It is the dialog copy's SINGLE author of `aria-invalid`, which is why the
   * dialog rendering below passes no `error`: this surface used to compute
   * `aria-invalid={!!error}` from an `error` prop the dialog rendering never
   * received, so it announced a literal `aria-invalid="false"` for a field the
   * inline surface was announcing `true` for at the same moment — the sharper
   * half of objectui#4824.
   */
  editorAria?: FullscreenEditorAria;
}) {
  return (
    <div className={cn('space-y-2', fullHeight && 'flex flex-col h-full')}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{formatLabel}</span>
        <span className="italic">{hint}</span>
      </div>
      <div className={cn('relative', fullHeight && 'flex-1 min-h-0')}>
        <Textarea
          // BEFORE the spread, both of them, so a host that supplies either key
          // wins and one that supplies neither still gets this surface's own
          // value. After the spread they would be re-assigned `undefined` on
          // the inline surface — which is how a pass-through silently drops a
          // key it was handed.
          autoFocus={autoFocus}
          data-testid={textareaTestId}
          {...domProps}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={fullHeight ? undefined : rows}
          // `text-base` in the dialog for the same reason `TextAreaField` uses
          // it there: sub-16px inputs make iOS Safari zoom on focus, which is
          // exactly wrong for a surface the user opened to get more room.
          //
          // After the spread because it COMPOSES the host's `className` (which
          // reaches this component as the `className` prop) with the surface's
          // own classes, rather than letting the raw host value replace them.
          className={cn(
            'font-mono',
            fullHeight ? 'text-base h-full min-h-full resize-none' : 'text-sm',
            className,
          )}
          // After the spread, deliberately: `toDomProps` forwards the whole
          // `aria-` family, so `<FormControl>`'s own `aria-invalid` arrives in
          // `domProps` too. This widget reading `error` itself is one of
          // objectui#3318's 17 PASS entries — keeping the read last is what
          // keeps that entry passing instead of handing the state back to a
          // host that may not have one.
          aria-invalid={!!error}
          // LAST, and only ever non-empty on the dialog rendering: inside the
          // modal the primitive is the authority on both the name and the
          // validation state, and its `aria-invalid` must win over the `!!error`
          // above (which is the INLINE channel and is `false` there by
          // construction). On the inline surface this spreads nothing.
          {...editorAria}
        />
        {overlay}
      </div>
    </div>
  );
}

/**
 * Rich text field with markdown/HTML support
 * For now, this is a simple textarea. A full implementation would use
 * a rich text editor like TipTap, Lexical, or Slate.
 *
 * Reached by forms as `field:markdown` and `field:html`; both resolve here.
 *
 * ## Fullscreen editing (objectui#3301)
 *
 * `ObjectForm` stamps `mobile_fullscreen` onto the metadata of every long-text
 * field — textarea AND rich-text — when `ObjectFormSchema.mobile
 * .fullscreenLongText` is set, and `ObjectFormSchema.mobile`'s own JSDoc has
 * always promised "textarea/rich-text get an expand button". This widget never
 * read the flag, so for `field:markdown` / `field:html` that promise did
 * nothing at all: the producer stamped, and no consumer existed.
 *
 * The flag is read off `field` and nowhere else — the single metadata carrier
 * since objectui#3233 — matching `TextAreaField` read for read, so a
 * misspelled flag stays inert in both widgets rather than being caught by a
 * tolerant fallback in one of them. The affordance and dialog themselves come
 * from the shared `FullscreenFieldEditor`, so one form-level setting keeps
 * producing one behaviour across both widgets.
 *
 * ## Host plumbing (objectui#4810)
 *
 * The editable branch had no `toDomProps` at all, so everything
 * `<FormControl>`'s Radix `Slot` hands down — the field's `id`, the
 * `aria-describedby` naming its `<FormDescription>` and `<FormMessage>` —
 * arrived as props and landed on no element. Measured on a real form: the
 * visible label's `for` pointed at an id nothing carried (`for=DANGLING`) and
 * the rendered description had zero consumers, for all three registry keys
 * (`markdown` / `html` / `richtext`) since they are this one widget.
 *
 * The fix is objectui#3318's standing recipe — `toDomProps(props)` spread onto
 * the REAL focusable control, which here is the `<Textarea>` inside
 * `RichTextEditorSurface`, never the wrapper `<div>`s (a non-focusable wrapper
 * carrying the id would satisfy `document.getElementById` and still leave the
 * label inert). Only the inline surface receives it; see `domProps` there for
 * why the dialog's copy must not.
 */
export function RichTextField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<string>) {
  const { t } = useObjectTranslation();
  if (readonly) {
    return (
      <div
        className="text-sm prose prose-sm max-w-none"
      >
        {value || <EmptyValue />}
      </div>
    );
  }

  const richField = field as any;
  const rows = richField?.rows || 8;
  const format = richField?.format || 'markdown'; // 'markdown' or 'html'
  // Same single read as `TextAreaField`: the field metadata is the only
  // carrier, and this widget is the second consumer the flag always had.
  const showFullscreenButton = Boolean(richField?.mobile_fullscreen);

  // The host plumbing, filtered by the declared whitelist (objectui#3291) so
  // renderer-only props and authored field-config keys cannot become DOM
  // attributes. Read the semantic props below off it rather than off `props`
  // for the same reason `TextAreaField` does: one source, no chance of the
  // spread and the read disagreeing.
  const domProps = toDomProps(props);
  // Resolved once and given to BOTH renderings of the editor (objectui#3402) —
  // exactly like `formatLabel` / `hint` / `placeholder` below, and for the same
  // reason. Landing it on the inline surface alone left a disabled rich-text
  // field greyed out next to a live expand button whose dialog committed any
  // edit through `onCommit`. `disabled` also carries the form's `isSubmitting`.
  const disabled = Boolean(domProps.disabled);

  // Resolved once and handed to BOTH renderings of the editor, so the dialog
  // cannot drift into showing different copy than the inline surface.
  const formatLabel = t('fields.richText.format', { format, defaultValue: `Format: ${format}` });
  const hint = t('fields.richText.basicEditorHint', { defaultValue: 'Rich text editor (basic)' });
  const placeholder =
    richField?.placeholder ||
    t('fields.richText.placeholder', { defaultValue: 'Enter text…' });

  return (
    <RichTextEditorSurface
      value={value}
      onChange={onChange}
      formatLabel={formatLabel}
      hint={hint}
      placeholder={placeholder}
      rows={rows}
      disabled={readonly || disabled}
      error={error}
      className={domProps.className}
      domProps={domProps}
      overlay={
        showFullscreenButton && (
          <FullscreenFieldEditor
            value={value ?? ''}
            onCommit={onChange}
            label={richField?.label}
            testIdPrefix="richtext"
            disabled={disabled}
            /*
              The validation channel the dialog rendering never had
              (objectui#4824). It is handed to the PRIMITIVE, not down to the
              second `RichTextEditorSurface`, because the primitive is what
              renders the message node the control points at — a node that must
              live inside the modal, since the host's `<FormMessage>` is
              `aria-hidden` for as long as this dialog is open.
            */
            error={error}
          >
            {(draft, setDraft, editorDisabled, editorAria) => (
              <RichTextEditorSurface
                value={draft}
                onChange={setDraft}
                formatLabel={formatLabel}
                hint={hint}
                placeholder={placeholder}
                disabled={editorDisabled}
                autoFocus
                fullHeight
                textareaTestId="richtext-fullscreen-input"
                editorAria={editorAria}
              />
            )}
          </FullscreenFieldEditor>
        )
      }
    />
  );
}
