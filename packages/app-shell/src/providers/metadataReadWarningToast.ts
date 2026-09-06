/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Turning a metadata read-warning (objectui#7741) into the message the user
 * reads.
 *
 * Lives apart from `AdapterProvider` — and, deliberately, imports NOTHING that
 * renders — so the wording and the reason-branching can be exercised directly.
 * Same split, and the same reason, as its siblings `writeWarningToast.ts` and
 * `saveAdvisoryToast.ts`: the caller owns the sink, the test hands over its
 * own, and no module mock is needed.
 *
 * ## Why this surface has to exist at all
 *
 * `listImportMappings` degrades every failure to an empty list, and the import
 * wizard hides its saved-mapping selector on an empty list. So a refused or
 * broken door rendered exactly like "no mapping is registered": the feature was
 * simply ABSENT, with a `console.warn` as the only discriminator — in the
 * browser console, with nothing in the UI pointing at it. A user without
 * devtools open could not tell the two apart, and neither could a careful
 * reporter: objectstack#14026 was filed, routed and worked by two seats on that
 * misreading. Promoting the log level would not have changed any of it. This
 * module is the half that makes the failure visible where the decision is made.
 *
 * ## What it deliberately does NOT say
 *
 * Nothing about the supported case. A server that does not serve the `mapping`
 * kind never reaches here — the adapter classifies that arm as `not-served` and
 * emits no event — so an older deployment keeps its quiet, empty, selector-less
 * wizard and earns no toast. Turning a real deployment shape into a visible
 * fault is the failure this surface must not commit.
 *
 * ## Why the server's own words are appended untranslated
 *
 * `code`, `status` and `message` are SERVER data. They are the evidence that
 * separates "could not be read" from "there are none", they are what a user
 * pastes into a bug report, and they go stale the moment the producer rewords
 * them. Only the frame — the title and the remedy sentence — is i18n copy, the
 * same division `saveAdvisoryToast.ts` draws.
 *
 * @module providers/metadataReadWarningToast
 */

import type { MetadataReadWarningEvent } from '@object-ui/data-objectstack';

/** i18next's `t`, narrowed to what this module uses. */
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Where the message goes. Structurally satisfied by sonner's `toast`, which is
 * what `AdapterProvider` passes.
 *
 * Required rather than defaulted to `sonner` for the same reason its two
 * siblings are: a default would mean importing the toaster here, which is
 * precisely the dependency that has to stay out of this module.
 */
export interface MetadataReadWarningSink {
  warning(title: string, options?: { description?: string; duration?: number }): void;
}

/**
 * How long the warning stays on screen. The body is a remedy plus the server's
 * own words, which the user has to actually read — the same 10s the advisory
 * surfaces use, so the warning tier behaves alike wherever it appears.
 */
const READ_WARNING_TOAST_MS = 10_000;

/**
 * The remedy sentence, chosen by WHICH loud verdict this was.
 *
 * An exhaustive `switch` with a `never` check rather than a ternary, for the
 * reason `saveAdvisoryToast.advisoryTitle` records: a ternary answers "is it
 * refused, else unreadable", so a THIRD reason added to the union would compile
 * everywhere and silently render the wrong remedy. Here it is a compile error
 * instead — the type must not merely be STATED, it must be HANDLED.
 *
 * The `default` branch is unreachable for type-checked callers; it exists for
 * an untyped one (the event type is published, and JS consumers are not bound
 * by it). It throws rather than falling back to either sentence, because the
 * caller wraps this in a try/catch that swallows: the failure mode is therefore
 * "no toast", never "a toast naming the wrong remedy".
 */
function remedy(ev: MetadataReadWarningEvent, t: TranslateFn): string {
  switch (ev.reason) {
    case 'refused':
      return t('console.importMappingsRefused', {
        defaultValue:
          'The server refused this request, so this list is empty because it could not be read — not because nothing is registered. Sign in again, or ask an administrator for access.',
      });
    case 'unreadable':
      return t('console.importMappingsUnreadable', {
        defaultValue:
          'This list is empty because it could not be read, not because nothing is registered. Try again, and report this if it keeps happening.',
      });
    default: {
      const unhandled: never = ev.reason;
      throw new Error(
        `metadataReadWarningToast: no remedy for reason ${JSON.stringify(unhandled)}`,
      );
    }
  }
}

/**
 * The server's own words about its own answer, as one line — or nothing at all
 * when it sent none.
 *
 * Assembled from whichever of the three the event carries, in the order a
 * reader needs them: the ADR-0112 code (the contract field the adapter branched
 * ON), the HTTP status, then the message. A failure that declared none of them
 * — a dropped connection, say — adds no line rather than an empty parenthesis.
 */
function serverDetail(ev: MetadataReadWarningEvent): string | undefined {
  const head = [ev.code, ev.status !== undefined ? `HTTP ${ev.status}` : undefined]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
  const parts = [head, ev.message].filter((p): p is string => typeof p === 'string' && p.length > 0);
  return parts.length > 0 ? parts.join(' — ') : undefined;
}

/**
 * Announce a metadata read that could not be answered and was degraded to an
 * empty result anyway.
 *
 * The title names the object, because that is the scope the empty list is about
 * and the wizard the user is standing in is open on exactly one object.
 */
export function emitMetadataReadWarning(
  ev: MetadataReadWarningEvent,
  t: TranslateFn,
  sink: MetadataReadWarningSink,
): void {
  const title = t('console.importMappingsUnavailable', {
    object: ev.objectName,
    defaultValue: 'Saved import mappings for {{object}} could not be loaded',
  });
  const detail = serverDetail(ev);
  sink.warning(title, {
    description: detail ? `${remedy(ev, t)}\n${detail}` : remedy(ev, t),
    duration: READ_WARNING_TOAST_MS,
  });
}
