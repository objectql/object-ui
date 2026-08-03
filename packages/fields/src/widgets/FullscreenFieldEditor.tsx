/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@object-ui/components';
import { Maximize2, Check, X } from 'lucide-react';

/**
 * The fullscreen-edit affordance shared by every long-text widget: the "expand"
 * button plus the full-height dialog it opens.
 *
 * ## Why this is shared rather than copied
 *
 * `ObjectFormSchema.mobile.fullscreenLongText` is ONE form-level promise, and
 * `ObjectForm` projects it onto EVERY long-text field as `mobile_fullscreen`
 * (`field:textarea` → `TextAreaField`, `field:markdown` / `field:html` →
 * `RichTextField`). A user who turns the setting on gets one behaviour, so the
 * behaviour has one implementation. objectui#3301 is what the other
 * arrangement costs: the flag reached `RichTextField` for as long as the
 * feature has existed and that widget simply never read it, so half the
 * documented promise ("textarea/rich-text get an expand button") silently did
 * nothing. A second hand-written copy of the state machine is the same failure
 * with an extra step — it drifts, and nothing reports the drift.
 *
 * What is genuinely per-widget is the EDITOR, so that is the only thing
 * injected: `children` renders it against the draft. Everything a user can
 * observe about the *interaction* — when the affordance appears, that the
 * dialog seeds from the committed value, that typing stays local until "Done",
 * that "Cancel" discards — lives here, once.
 *
 * ## Draft semantics (unchanged from the original `TextAreaField` behaviour)
 *
 * The dialog edits a LOCAL draft seeded from `value` at open time and commits
 * once, on "Done". It deliberately does not stream every keystroke to the host:
 * these widgets sit in a react-hook-form field, and per-keystroke `onChange`
 * during a modal edit would mark the form dirty (and fire validation) for an
 * edit the user may still cancel. "Cancel" therefore needs no undo — nothing
 * was written.
 *
 * ## `testIdPrefix`
 *
 * Each host passes its own (`textarea`, `richtext`), yielding the same
 * convention with a per-widget namespace: `<prefix>-fullscreen-toggle` /
 * `-dialog` / `-save`. One form can contain both a textarea and a markdown
 * field, so a single shared id would make a test unable to say which widget it
 * had found. The editor's own test id belongs to `children` for the same
 * reason.
 *
 * Focus management, `Esc`, the overlay and the close button are Radix's, via
 * the repo's `Dialog` (`@object-ui/components`) — deliberately not re-answered
 * here.
 */
export interface FullscreenFieldEditorProps {
  /**
   * The committed value. Seeds the draft each time the dialog opens — read at
   * open time, not held, so a value that changes underneath while the dialog is
   * closed is picked up on the next open.
   */
  value: string;
  /** Called once with the draft when the user confirms. */
  onCommit: (next: string) => void;
  /** Field label — the dialog title and part of the toggle's accessible name. */
  label?: string;
  /** Namespace for this widget's fullscreen test ids. See above. */
  testIdPrefix: string;
  /**
   * The editor itself, rendered inside the dialog body against the draft. The
   * host passes the SAME editor it renders inline, so "fullscreen" is a size
   * change rather than a second, poorer editing surface.
   */
  children: (draft: string, setDraft: (next: string) => void) => React.ReactNode;
  /** Optional footer status for the draft (e.g. a character counter). */
  footer?: (draft: string) => React.ReactNode;
  /**
   * Extra classes for the toggle button. It is absolutely positioned by
   * default and expects a `relative` ancestor; a host whose layout has a
   * better home for it can re-place it here.
   */
  toggleClassName?: string;
}

export function FullscreenFieldEditor({
  value,
  onCommit,
  label,
  testIdPrefix,
  children,
  footer,
  toggleClassName,
}: FullscreenFieldEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const openFullscreen = () => {
    setDraft(value ?? '');
    setOpen(true);
  };
  const cancelFullscreen = () => setOpen(false);
  const commitFullscreen = () => {
    onCommit(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openFullscreen}
        className={cn(
          'absolute top-1.5 right-1.5 inline-flex items-center justify-center size-7 rounded-md bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background border shadow-sm transition-colors',
          toggleClassName,
        )}
        aria-label={`Edit ${label ?? 'text'} fullscreen`}
        data-testid={`${testIdPrefix}-fullscreen-toggle`}
      >
        <Maximize2 className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-3xl h-[100dvh] sm:h-[80vh] max-h-[100dvh] sm:max-h-[80vh] flex flex-col p-0 gap-0"
          data-testid={`${testIdPrefix}-fullscreen-dialog`}
        >
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-base">{label ?? 'Edit text'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4">{children(draft, setDraft)}</div>
          <DialogFooter className="p-3 border-t flex-row justify-between sm:justify-end gap-2">
            {footer?.(draft)}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={cancelFullscreen}>
                <X className="size-4 mr-1" /> Cancel
              </Button>
              <Button
                type="button"
                onClick={commitFullscreen}
                data-testid={`${testIdPrefix}-fullscreen-save`}
              >
                <Check className="size-4 mr-1" /> Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
