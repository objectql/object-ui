/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Turning a write-warning (framework #3431/#3455) into the message the user
 * reads. Lives apart from `AdapterProvider` — and, deliberately, imports NOTHING
 * that renders — so the wording, the label resolution and the reason-branching
 * can be exercised directly.
 *
 * @module providers/writeWarningToast
 */

import type { ObjectStackAdapter, WriteWarningEvent } from '@object-ui/data-objectstack';

/** i18next's `t`, narrowed to what this module uses. */
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Convention-based field-label resolver (`useObjectLabel().fieldLabel`). */
export type FieldLabelFn = (objectName: string, fieldName: string, fallback: string) => string;

/**
 * Where the message goes. Structurally satisfied by sonner's `toast`, which is
 * what `AdapterProvider` passes.
 *
 * It is a REQUIRED parameter rather than a default-to-`sonner` one, on purpose:
 * a default would mean importing the toaster here, which is exactly the
 * dependency that has to stay out of this module. The caller owns the sink; the
 * test hands over its own and needs no module mock — so this module's behaviour
 * does not depend on vitest project isolation (`vitest.config.mts` runs the
 * `unit` project with `isolate: false`, where a `vi.mock` of a shared module is
 * only as reliable as the file's worker placement).
 */
export interface WriteWarningSink {
  warning(title: string, options?: { description?: string }): void;
}

/**
 * Resolve `field api name → human label` for one object, best-effort.
 *
 * The write-warning event carries machine names only — the server never sends
 * labels with `droppedFields`. Rather than print `type, source_method` at a
 * user who only ever saw "安灯类型 / 来源方式" (objectui#3484 point C), read the
 * object's schema (the adapter caches it, so this is normally free) and put its
 * labels through the same convention-based i18n every other surface uses. A
 * field the schema does not name falls back to its api name — an exact key
 * beats a guess.
 */
async function resolveFieldLabels(
  adapter: Pick<ObjectStackAdapter, 'getObjectSchema'>,
  objectName: string,
  fieldLabel: FieldLabelFn,
): Promise<(fieldName: string) => string> {
  let fields: Record<string, { label?: string }> | undefined;
  try {
    const schema = (await adapter.getObjectSchema(objectName)) as
      | { fields?: Record<string, { label?: string }> }
      | undefined;
    fields = schema?.fields;
  } catch {
    // Metadata unreachable — the api names below are still a truthful answer.
  }
  return (fieldName: string) =>
    fieldLabel(objectName, fieldName, fields?.[fieldName]?.label || fieldName);
}

/**
 * Announce a write-warning. The write SUCCEEDED — some caller-supplied fields
 * were legally stripped, so we tell the user rather than let it pass silently.
 *
 * The REASON decides the wording (#3794). `readonly_when` is not "this field is
 * read-only" — the field is editable in other states and the form rendered it
 * as an ordinary input; what happened is that THIS record's current state locks
 * it. Saying "read-only" there sends the user looking for a permission problem
 * that doesn't exist.
 *
 * The wording ACKNOWLEDGES the save (objectui#3484 point B). This message lands
 * next to the save surface's own "Updated" toast, and the pair used to read as
 * a contradiction — "some fields were not saved" beside "updated successfully",
 * with nothing telling the user which one to believe. It is one outcome, not
 * two: the record was saved, and N of the fields sent did not take effect.
 *
 * Says nothing when there is nothing to say (no events, or every event carried
 * an empty field list).
 */
export async function emitWriteWarning(
  ev: WriteWarningEvent,
  t: TranslateFn,
  adapter: Pick<ObjectStackAdapter, 'getObjectSchema'> | null,
  fieldLabel: FieldLabelFn,
  sink: WriteWarningSink,
): Promise<void> {
  const byReason = new Map<string, string[]>();
  for (const d of ev.droppedFields) {
    const seen = byReason.get(d.reason) ?? [];
    for (const f of d.fields) if (!seen.includes(f)) seen.push(f);
    byReason.set(d.reason, seen);
  }
  if (byReason.size === 0) return;

  const labelOf = adapter && ev.resource
    ? await resolveFieldLabels(adapter, ev.resource, fieldLabel)
    : (fieldName: string) => fieldName;

  const lines: string[] = [];
  for (const [reason, fields] of byReason) {
    if (fields.length === 0) continue;
    const list = fields.map(labelOf).join(', ');
    lines.push(
      reason === 'readonly_when'
        ? t('detail.writeStrippedByState', {
            fields: list,
            defaultValue:
              "Not editable in this record's current state, so it did not take effect: {{fields}}",
          })
        : t('detail.writeStrippedReadonly', {
            fields: list,
            defaultValue: 'Read-only, so it did not take effect: {{fields}}',
          }),
    );
  }
  if (lines.length === 0) return;
  sink.warning(
    t('detail.writeStrippedTitle', {
      defaultValue: 'Saved — but some fields did not take effect',
    }),
    { description: lines.join('\n') },
  );
}
