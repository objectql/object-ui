import React, { useEffect, useId, useState } from 'react';
import { Textarea, EmptyValue } from '@object-ui/components';
import { FullscreenFieldEditor } from './FullscreenFieldEditor';
import { FieldWidgetComponentProps } from './types';
import { toDomProps } from './toDomProps';
import { useFieldTranslation } from './useFieldTranslation';

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

/**
 * How long the typist must pause before the counter's status region is allowed
 * to change (objectui#3408). The GOV.UK Design System character-count component
 * uses the same shape and the same order of magnitude.
 *
 * The number this replaces was effectively 0: the counter WAS the live region,
 * so every keystroke re-rendered it and every re-render was an announcement.
 * Measured on `origin/main`, zh session, `maxLength: 500`, typing a 52-character
 * sentence one character at a time: 52 keystrokes produced 52 distinct
 * announcements totalling 979 spoken characters — ~19x the text the user was
 * trying to write, each one interrupting the screen reader's echo of what they
 * had just typed.
 */
const COUNTER_STATUS_DEBOUNCE_MS = 1000;

/** Announce inside the last 10% of the cap … */
const COUNTER_STATUS_REMAINING_RATIO = 0.1;
/** … or the last 20 characters — whichever the typist reaches FIRST. */
const COUNTER_STATUS_MIN_REMAINING = 20;

/**
 * The remaining-character count at or below which the status region speaks.
 *
 * "10% remaining OR 20 characters remaining, whichever comes first" is a
 * disjunction, and because `remaining` only ever counts DOWN as the user types,
 * the branch that fires first is simply the LARGER of the two — hence `max`.
 * A 500-character cap starts warning at 50 remaining; a 100-character cap at 20
 * (10% of it would be 10, which the typist would reach later, not sooner).
 *
 * A cap smaller than {@link COUNTER_STATUS_MIN_REMAINING} is therefore "near
 * the limit" from the first keystroke, which is correct: on a 10-character
 * field every character genuinely is one of the last few. The debounce still
 * bounds it to one announcement per pause.
 */
function counterStatusThreshold(maxLength: number): number {
  return Math.max(
    Math.ceil(maxLength * COUNTER_STATUS_REMAINING_RATIO),
    COUNTER_STATUS_MIN_REMAINING,
  );
}

export function TextAreaField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<string>) {
  // Everything from here to the `readonly` early return is hook-order
  // territory: a hook may not sit behind a conditional return. The readonly
  // branch renders no counter, so these are no-ops there — but moving them
  // down would desync hook order the moment a field toggles readonly. The
  // derivations they read (`maxLength`, `length`) sit up here for the same
  // reason, not because the readonly branch wants them.
  const { t } = useFieldTranslation();

  const textareaField = field as any;
  // Spec FieldSchema declares camelCase `maxLength`; `max_length` is the legacy
  // objectui spelling. Dual-read (framework#1878 §3 recheck) — without this a
  // spec-authored maxLength gave neither the textarea cap nor the counter.
  const maxLength = textareaField?.maxLength ?? textareaField?.max_length;
  const length = (value || '').length;

  // Two ids off one `useId()`: the description a screen reader reads ONCE on
  // focus, and the status region it hears only near the cap. Both derive from
  // the widget instance, so two textareas on one form never collide.
  const instanceId = useId();
  const descriptionId = `${instanceId}-charcount`;

  /**
   * The counter sentence as a DESCRIPTION (objectui#3408). Reached through the
   * textarea's `aria-describedby`, so focusing the field says "12 characters,
   * 500 max" once and then shuts up. Before this the cap was announced only as
   * a side effect of typing — focus told a screen reader user nothing at all
   * that a sighted user could read off the corner of the box.
   *
   * Same key the visible counter's `aria-label` used to carry (objectui#3406,
   * ten packs); it moved from a live region onto a description, it was not
   * duplicated.
   */
  const description = maxLength
    ? t('fields.textarea.characterCount', { count: length, max: maxLength })
    : '';

  /**
   * The near-limit warning, gated. Silent for the whole comfortable middle of
   * the field — a count nobody is close to is not news — and phrased as what
   * is LEFT rather than what has been typed, because that is the number the
   * user is about to act on. Over-long values (a cap lowered after the record
   * was saved) clamp to 0: the textarea's own `maxLength` blocks further
   * input, so "0 left" is the true actionable state, and the description above
   * still carries the honest `503 of 500`.
   */
  const pendingStatus =
    !readonly && maxLength && maxLength - length <= counterStatusThreshold(maxLength)
      ? t('fields.textarea.charactersRemaining', { count: Math.max(maxLength - length, 0) })
      : '';

  /**
   * The last sentence a PAUSE settled on. Only ever written by the timer —
   * never cleared synchronously — so this effect adds no cascading render on
   * the keystrokes it is busy staying quiet through
   * (`react-hooks/set-state-in-effect`).
   */
  const [settledStatus, setSettledStatus] = useState('');

  useEffect(() => {
    if (!pendingStatus) return;
    const timer = setTimeout(() => setSettledStatus(pendingStatus), COUNTER_STATUS_DEBOUNCE_MS);
    // Every keystroke cancels the previous pending announcement, so a typist
    // who never pauses is never interrupted. The dependency is the SENTENCE,
    // not the length: re-typing back to the same count produces the same string
    // and therefore no DOM change and no second announcement.
    return () => clearTimeout(timer);
  }, [pendingStatus]);

  /**
   * Speak the settled sentence only while it is still TRUE — i.e. while it is
   * the one the current value would produce. Everything else renders empty,
   * which costs no speech (emptying a live region announces nothing), and that
   * is what makes leaving the warning band silent IMMEDIATELY rather than a
   * second later.
   *
   * The obvious alternative, `pendingStatus ? settledStatus : ''`, is wrong in
   * one specific way: delete back out of the band and type into it again, and
   * the region re-announces the STALE count from before the excursion a full
   * second before the timer corrects it. Announcing a wrong number is worse
   * than announcing a right one twice, which is the bounded, sub-second,
   * correct-content cost of the comparison below. Pinned by `never
   * re-announces the STALE count when the user types back into the band`.
   */
  const status = settledStatus === pendingStatus ? pendingStatus : '';

  if (readonly) {
    return (
      <div className="text-sm whitespace-pre-wrap">
        {value || <EmptyValue />}
      </div>
    );
  }

  const rows = textareaField?.rows || 4;
  // Mobile fullscreen opt-in travels on the field metadata and nowhere else.
  // That metadata has exactly one carrier (`field`, objectui#3233), so this is
  // a single read — a misspelled flag has no read path to quietly catch it.
  const showFullscreenButton = Boolean(textareaField?.mobile_fullscreen);

  const domProps = toDomProps(props);
  // Resolved once and given to BOTH editing surfaces (objectui#3402). It used
  // to reach the inline `<Textarea>` alone, so a disabled field greyed out
  // correctly while its expand button stayed live and the dialog wrote the edit
  // straight back through `onCommit`. `disabled` also carries the form's
  // `isSubmitting`, so that hole was open for the duration of every submit.
  const disabled = Boolean(domProps.disabled);

  // APPENDED, never assigned (objectui#3408). `<FormControl>` is a Radix Slot
  // and already hands the control an `aria-describedby` naming the field's
  // description and error message; it arrives here through `toDomProps`'
  // `aria-*` pass-through. Overwriting it would trade "no cap announced" for
  // "no error announced" — a strictly worse bug, and a silent one.
  const describedBy =
    [domProps['aria-describedby'], maxLength ? descriptionId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="relative">
      <Textarea
        {...domProps}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={textareaField?.placeholder}
        disabled={readonly || disabled}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={!!error}
        // After the spread so the composed value wins over the raw host one.
        aria-describedby={describedBy}
        className={domProps.className}
      />
      {maxLength && (
        <>
          {/*
            The VISIBLE counter, and now visible ONLY (objectui#3408). It used
            to be three things at once: the digits a sighted user glances at,
            the carrier of the translated sentence (objectui#3406), and the
            live region itself — so the sentence was re-announced on every
            single keystroke. Split into the three nodes below, this one is
            decorative: `aria-hidden` keeps a screen reader from reading
            "5 slash 200" on top of the description that says it properly.
          */}
          <div
            className="absolute bottom-2 right-2 text-xs text-gray-400"
            aria-hidden="true"
            data-testid="textarea-character-count"
          >
            {length}/{maxLength}
          </div>

          {/*
            The DESCRIPTION. Referenced by the textarea's `aria-describedby`,
            never announced on its own — a screen reader reads it when focus
            lands on the field and not again. Visually hidden because the
            digits above already say it to the eye.
          */}
          <span id={descriptionId} className="sr-only">
            {description}
          </span>

          {/*
            The STATUS region. Rendered unconditionally (whenever there is a
            cap) and starting EMPTY on purpose: a live region has to be in the
            DOM before its content changes or the first change is not announced
            at all. `aria-atomic` so the whole sentence is spoken rather than
            the digits that differ from last time.
          */}
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {status}
          </span>
        </>
      )}

      {showFullscreenButton && (
        <FullscreenFieldEditor
          value={value ?? ''}
          onCommit={onChange}
          label={textareaField?.label}
          testIdPrefix="textarea"
          disabled={disabled}
          footer={(draft) =>
            maxLength ? (
              <span className="text-xs text-muted-foreground self-center">
                {draft.length}/{maxLength}
              </span>
            ) : null
          }
        >
          {(draft, setDraft, editorDisabled) => (
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={editorDisabled}
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
