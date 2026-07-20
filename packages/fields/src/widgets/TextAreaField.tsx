import React, { useState } from 'react';
import {
  Textarea,
  EmptyValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@object-ui/components';
import { Maximize2, Check, X } from 'lucide-react';
import { FieldWidgetProps } from './types';

/**
 * TextAreaField - Multi-line text input widget
 * Supports configurable row count and preserves whitespace in readonly mode.
 *
 * Mobile UX (round 3): when the host form passes `mobileFullscreen` (or the
 * field schema sets `mobile_fullscreen: true`), an "expand" affordance opens
 * a fullscreen edit dialog — much easier on phones than tapping a 4-row
 * textarea trapped between other fields.
 */
export function TextAreaField({ value, onChange, field, readonly, errorMessage, ...props }: FieldWidgetProps<string>) {
  // Hooks must run before any early return (readonly) to keep hook order stable.
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  if (readonly) {
    return (
      <div className="text-sm whitespace-pre-wrap">
        {value || <EmptyValue />}
      </div>
    );
  }

  const textareaField = (field || (props as any).schema) as any;
  const rows = textareaField?.rows || 4;
  const maxLength = textareaField?.max_length;
  // Mobile fullscreen flag may arrive on the field metadata, on the form-field
  // schema (when called via the form renderer where `field` is the ObjectQL
  // metadata sub-object), or as an explicit widget prop.
  const showFullscreenButton = Boolean(
    (props as any).mobileFullscreen ??
    textareaField?.mobile_fullscreen ??
    (props as any).mobile_fullscreen ??
    (props as any).schema?.mobile_fullscreen,
  );

  const openFullscreen = () => { setDraft(value ?? ''); setFullscreenOpen(true); };
  const cancelFullscreen = () => setFullscreenOpen(false);
  const commitFullscreen = () => { onChange(draft); setFullscreenOpen(false); };

  const { inputType, mobileFullscreen, ...domProps } = props as any;

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
        aria-invalid={!!errorMessage}
        className={domProps.className}
      />
      {showFullscreenButton && (
        <button
          type="button"
          onClick={openFullscreen}
          className="absolute top-1.5 right-1.5 inline-flex items-center justify-center size-7 rounded-md bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background border shadow-sm transition-colors"
          aria-label={`Edit ${textareaField?.label ?? 'text'} fullscreen`}
          data-testid="textarea-fullscreen-toggle"
        >
          <Maximize2 className="size-3.5" />
        </button>
      )}
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
        <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
          <DialogContent
            className="sm:max-w-3xl h-[100dvh] sm:h-[80vh] max-h-[100dvh] sm:max-h-[80vh] flex flex-col p-0 gap-0"
            data-testid="textarea-fullscreen-dialog"
          >
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="text-base">
                {textareaField?.label ?? 'Edit text'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 p-4">
              <Textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={maxLength}
                placeholder={textareaField?.placeholder}
                className="h-full min-h-full resize-none text-base"
                data-testid="textarea-fullscreen-input"
              />
            </div>
            <DialogFooter className="p-3 border-t flex-row justify-between sm:justify-end gap-2">
              {maxLength && (
                <span className="text-xs text-muted-foreground self-center">
                  {draft.length}/{maxLength}
                </span>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="ghost" onClick={cancelFullscreen}>
                  <X className="size-4 mr-1" /> Cancel
                </Button>
                <Button type="button" onClick={commitFullscreen} data-testid="textarea-fullscreen-save">
                  <Check className="size-4 mr-1" /> Done
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
