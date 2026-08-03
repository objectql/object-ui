import React from 'react';
import { Textarea, EmptyValue } from '@object-ui/components';
import { FullscreenFieldEditor } from './FullscreenFieldEditor';
import { FieldWidgetComponentProps } from './types';

/**
 * TextAreaField - Multi-line text input widget
 * Supports configurable row count and preserves whitespace in readonly mode.
 *
 * Mobile UX (round 3): when the FIELD METADATA carries `mobile_fullscreen:
 * true`, an "expand" affordance opens a fullscreen edit dialog — much easier
 * on phones than tapping a 4-row textarea trapped between other fields.
 *
 * That flag has exactly one producer: `ObjectForm` stamps it onto every
 * long-text field when `ObjectFormSchema.mobile.fullscreenLongText` is set
 * (`plugin-form/src/ObjectForm.tsx`). It reaches this widget on `field` — the
 * single metadata carrier since objectui#3233. A `SchemaRenderer`-hosted node
 * arrives there too: the registry adapter (`withFieldCarrier`) maps the SDUI
 * `schema` node onto `field` before the widget sees it.
 *
 * The affordance, the dialog and the draft/commit semantics live in the shared
 * `FullscreenFieldEditor` — the same producer stamps the same flag on
 * rich-text fields, and `RichTextField` renders it from there too
 * (objectui#3301). Only the EDITOR differs per widget; here it is a
 * full-height `Textarea`.
 *
 * There is deliberately NO widget-prop override. A `mobileFullscreen`
 * (camelCase) prop was read here and written by nobody in the repo, and the
 * snake_case `mobile_fullscreen` prop cannot arrive either: the form renderer
 * strips both `mobile_fullscreen` and `fullscreen` from the props it forwards
 * to registered widgets (`stripRegisteredFieldProps` in
 * `components/src/renderers/form/form.tsx`). Reading keys nobody produces
 * documented a contract that never held and invited the next author to pass a
 * silently-ignored prop, so the reads are gone (objectui#3232). If a host
 * override is ever genuinely needed, declare ONE key on
 * `FieldWidgetComponentProps`, stop stripping it, and have a host pass it.
 */
export function TextAreaField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<string>) {
  if (readonly) {
    return (
      <div className="text-sm whitespace-pre-wrap">
        {value || <EmptyValue />}
      </div>
    );
  }

  const textareaField = field as any;
  const rows = textareaField?.rows || 4;
  // Spec FieldSchema declares camelCase `maxLength`; `max_length` is the legacy
  // objectui spelling. Dual-read (framework#1878 §3 recheck) — without this a
  // spec-authored maxLength gave neither the textarea cap nor the counter.
  const maxLength = textareaField?.maxLength ?? textareaField?.max_length;
  // Mobile fullscreen opt-in travels on the field metadata and nowhere else.
  // That metadata has exactly one carrier (`field`, objectui#3233), so this is
  // a single read — a misspelled flag has no read path to quietly catch it.
  const showFullscreenButton = Boolean(textareaField?.mobile_fullscreen);

  const { inputType, ...domProps } = props as any;

  return (
    <div className="relative">
      <Textarea
        {...domProps}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={textareaField?.placeholder}
        disabled={readonly || domProps.disabled}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={!!error}
        className={domProps.className}
      />
      {maxLength && (
        <div
          className="absolute bottom-2 right-2 text-xs text-gray-400"
          aria-live="polite"
          aria-label={`Character count: ${(value || '').length} of ${maxLength}`}
        >
          {(value || '').length}/{maxLength}
        </div>
      )}

      {showFullscreenButton && (
        <FullscreenFieldEditor
          value={value ?? ''}
          onCommit={onChange}
          label={textareaField?.label}
          testIdPrefix="textarea"
          footer={(draft) =>
            maxLength ? (
              <span className="text-xs text-muted-foreground self-center">
                {draft.length}/{maxLength}
              </span>
            ) : null
          }
        >
          {(draft, setDraft) => (
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={maxLength}
              placeholder={textareaField?.placeholder}
              className="h-full min-h-full resize-none text-base"
              data-testid="textarea-fullscreen-input"
            />
          )}
        </FullscreenFieldEditor>
      )}
    </div>
  );
}
