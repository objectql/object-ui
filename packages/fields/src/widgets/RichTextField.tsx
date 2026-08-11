import React from 'react';
import { cn, Textarea, EmptyValue } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/react';
import { FullscreenFieldEditor } from './FullscreenFieldEditor';
import { FieldWidgetComponentProps } from './types';

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
}) {
  return (
    <div className={cn('space-y-2', fullHeight && 'flex flex-col h-full')}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{formatLabel}</span>
        <span className="italic">{hint}</span>
      </div>
      <div className={cn('relative', fullHeight && 'flex-1 min-h-0')}>
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={fullHeight ? undefined : rows}
          // `text-base` in the dialog for the same reason `TextAreaField` uses
          // it there: sub-16px inputs make iOS Safari zoom on focus, which is
          // exactly wrong for a surface the user opened to get more room.
          className={cn(
            'font-mono',
            fullHeight ? 'text-base h-full min-h-full resize-none' : 'text-sm',
            className,
          )}
          aria-invalid={!!error}
          data-testid={textareaTestId}
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
  // Resolved once and given to BOTH renderings of the editor (objectui#3402) —
  // exactly like `formatLabel` / `hint` / `placeholder` below, and for the same
  // reason. Landing it on the inline surface alone left a disabled rich-text
  // field greyed out next to a live expand button whose dialog committed any
  // edit through `onCommit`. `disabled` also carries the form's `isSubmitting`.
  const disabled = Boolean(props.disabled);

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
      className={props.className}
      overlay={
        showFullscreenButton && (
          <FullscreenFieldEditor
            value={value ?? ''}
            onCommit={onChange}
            label={richField?.label}
            testIdPrefix="richtext"
            disabled={disabled}
          >
            {(draft, setDraft, editorDisabled) => (
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
              />
            )}
          </FullscreenFieldEditor>
        )
      }
    />
  );
}
