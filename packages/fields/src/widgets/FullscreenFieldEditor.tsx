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
 * ## `disabled` (objectui#3402)
 *
 * The dialog is a SECOND editing surface for the same value, so a field that is
 * not interactive has to be not interactive here too. It was not: hosts landed
 * `disabled` on their inline control only, this component never declared the
 * prop at all, and a disabled long-text field therefore sat correctly greyed out
 * next to a live expand button — click it, type anything, press "Done", and the
 * edit went into form state through `onCommit`. Measured on `origin/main`
 * before the fix: inline `disabled=true`, toggle `disabled=false`, dialog input
 * `disabled=false`, `onChange` called with "EDITED WHILE DISABLED".
 *
 * The gate is shaped like the built-in path's (`FullscreenTextarea` in
 * `components/src/renderers/form/form.tsx`, objectui#3400/PR #3401), because
 * one form-level setting must keep producing one behaviour on both paths:
 *
 *  - the toggle STAYS but is `disabled` — `disabled` means "not interactive,
 *    muted", not "shown plainly", which is `readonly`'s job (and `readonly`
 *    never reaches this component at all — see below);
 *  - `openFullscreen` refuses independently of the attribute, since a
 *    programmatic dispatch and a lost `pointer-events` rule both get past it;
 *  - the dialog locks on its OWN — `disabled` is not merely a static flag, it is
 *    also the form's `isSubmitting`, which flips to true while the dialog may
 *    already be open. At that moment the toggle is no longer the gate. So the
 *    editor is told (third `children` argument) and "Done" is disabled;
 *  - and `onCommit` is gated, because that is the single point where a value can
 *    leave this component for host state. Nothing native guards it: it is a
 *    click handler on a different control reading React state.
 *
 * "Cancel" and `Esc` stay live in every state — a dialog that goes disabled
 * mid-edit must still be closable, or a submit in flight traps the user in it.
 *
 * ## Why there is no `readonly` prop
 *
 * Both hosts early-return a read-only DISPLAY before they compute the affordance
 * (`TextAreaField.tsx`, `RichTextField.tsx`), so this component is never
 * rendered for a read-only field and a `readonly` prop here would be declared
 * with no producer — the shape this package keeps deleting (objectui#3232/#3233).
 * A future host that renders an editor for read-only fields must add the prop
 * AND the producer together; do not add it "for symmetry" beforehand.
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
   * The host field is not interactive (objectui#3402). Disables the toggle, the
   * "Done" button and the write-back, and is handed to `children` so the host's
   * own editor renders disabled too. See the `disabled` section above for why
   * each of those is a separate line rather than belt-and-braces.
   *
   * **Producer**: the widget's `disabled` prop, which the form renderer computes
   * as `disabled || fieldDisabled || isSubmitting || optionGroupGated` and
   * forwards to registered widgets (`stripRegisteredFieldProps` does not strip
   * it).
   */
  disabled?: boolean;
  /**
   * The editor itself, rendered inside the dialog body against the draft. The
   * host passes the SAME editor it renders inline, so "fullscreen" is a size
   * change rather than a second, poorer editing surface.
   *
   * The third argument is this component's `disabled`, and the host is expected
   * to put it on the control it renders: only the host knows which element its
   * editor's disabled state belongs on. Ignoring it is not a write-back hole —
   * `onCommit` is gated here regardless — but it does leave a control that looks
   * editable while the field is not, so both in-repo hosts apply it and their
   * tests pin it.
   */
  children: (
    draft: string,
    setDraft: (next: string) => void,
    disabled: boolean,
  ) => React.ReactNode;
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
  disabled = false,
  children,
  footer,
  toggleClassName,
}: FullscreenFieldEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const openFullscreen = () => {
    if (disabled) return;
    setDraft(value ?? '');
    setOpen(true);
  };
  const cancelFullscreen = () => setOpen(false);
  const commitFullscreen = () => {
    // THE gate: the one point where a value leaves this component for host
    // state. `disabled` can flip to true while this dialog is open (it carries
    // the form's `isSubmitting`), so this is checked here and not only on the
    // way in. Closing is unconditional — see "Cancel and Esc stay live" above.
    if (!disabled) onCommit(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openFullscreen}
        disabled={disabled}
        className={cn(
          'absolute top-1.5 right-1.5 inline-flex items-center justify-center size-7 rounded-md bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background border shadow-sm transition-colors',
          'disabled:opacity-50 disabled:pointer-events-none',
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
          <div className="flex-1 min-h-0 p-4">{children(draft, setDraft, disabled)}</div>
          <DialogFooter className="p-3 border-t flex-row justify-between sm:justify-end gap-2">
            {footer?.(draft)}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={cancelFullscreen}>
                <X className="size-4 mr-1" /> Cancel
              </Button>
              <Button
                type="button"
                onClick={commitFullscreen}
                disabled={disabled}
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
