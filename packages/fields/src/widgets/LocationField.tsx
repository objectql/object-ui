import React from 'react';
import { Input, EmptyValue } from '@object-ui/components';
import { LocationValueSchema } from '@objectstack/spec/data';
import type { LocationValue } from '@objectstack/spec/data';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';

/**
 * The stored shape of a `type: 'location'` value — RE-EXPORTED from
 * `@objectstack/spec/data`, never re-declared here (objectui#6272).
 *
 * `LocationValue` is `z.input` of the spec's `LocationValueSchema`
 * (`{ lat, lng, altitude?, accuracy? }`), which is what `valueSchemaFor({ type:
 * 'location' })` validates a stored location against. A second local
 * declaration under the spec's own name is objectstack#4115's failure class and
 * is refused by `scripts/check-spec-symbol-derivation.mjs` — it was refused on
 * the closed PR #6418, which is why this is a bare re-export.
 */
export type { LocationValue } from '@objectstack/spec/data';

/**
 * A stored value is a location only when it carries BOTH spec coordinates as
 * finite numbers.
 *
 * ⛔ Deliberately no fallback to the deprecated `{ latitude, longitude }`
 * spelling, and no `|| 0` default on a missing coordinate — both were the
 * defect (objectui#6272, maintainer ruling 2026-08-28 「6272 A1」, option A1
 * chosen explicitly over a read-side compatibility shim):
 *
 *  - reading `latitude`/`longitude` made this widget the one surface that
 *    disagreed with the platform contract. `valueSchemaFor({type:'location'})`
 *    REJECTS `{ latitude, longitude }` (`invalid_type` at `[lat]`, `[lng]`) and
 *    ACCEPTS `{ lat, lng }`, and the display surfaces (`LocationCellRenderer`,
 *    `ObjectMap`) already read `lat`/`lng` first — that is correct by contract,
 *    not tolerance.
 *  - `|| 0` turned every unreadable value into `0, 0`, a VALID coordinate in
 *    the Gulf of Guinea. A field that renders a plausible wrong place is worse
 *    than one that renders nothing: an empty box is visibly unset, `0, 0` is
 *    not. The same applies to a half value — `{ lat }` alone must not invent a
 *    longitude.
 */
function isLocationValue(value: unknown): value is LocationValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { lat, lng } = value as Record<string, unknown>;
  return isFiniteNumber(lat) && isFiniteNumber(lng);
}

/**
 * A usable numeric component of a location: a real number, never `NaN` or an
 * infinity. Named so the coordinates and the two optional keys below are held
 * to the SAME test rather than to two copies of it that can drift apart.
 */
function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Is this candidate emission one the platform's own validator ACCEPTS?
 *
 * The guard above tests that a coordinate is a real number; the spec also
 * constrains its RANGE, and nothing in this widget used to (objectui#6714):
 *
 * ```ts
 * // @objectstack/spec, LocationValueSchema
 * lat: z.number().min(-90).max(90)
 * lng: z.number().min(-180).max(180)
 * ```
 *
 * So typing `999, 999` emitted `{ lat: 999, lng: 999 }` — a value
 * `valueSchemaFor({ type: 'location' })` refuses with `too_big` at BOTH keys.
 * That is the producer direction of the contract-first failure class
 * (AGENTS.md #0.1): a renderer writing what the contract rejects. It is also
 * open to every user who edits a location field, since typing the coordinates
 * is this field's only interaction.
 *
 * ⛔ The bounds are NOT restated here as `-90`/`90` literals. A hand-copied
 * range is a SECOND contract that can drift from the spec silently — the exact
 * shape #0.1 bans — so the spec's own schema is asked instead. It is a
 * memoized lazy schema, so this costs one `safeParse` of a 2–4 key object.
 *
 * Two deliberate consequences of asking the schema rather than testing two
 * bounds by hand:
 *
 *  - The check is on the WHOLE emitted object, so `altitude`/`accuracy` carried
 *    across the edit are held to the contract too. {@link carryOptionalKeys}
 *    already narrows them to finite numbers, so this is a no-op today — it is
 *    the guard that keeps it one.
 *  - `Infinity` is refused as well. `parseFloat('Infinity')` is `Infinity` and
 *    `!isNaN(Infinity)` is `true`, so the format gate alone let it through;
 *    `z.number()` rejects it. Same defect class, same fix, no extra branch.
 *
 * ⚠️ Deliberately NOT wired into {@link isLocationValue}, which is the READ
 * guard. A record that already holds an out-of-range pair keeps RENDERING here,
 * so the person who can correct it can still see it — blanking it would hide
 * the dirty data from its only fixer. objectui#6272's empty render was for a
 * value whose SHAPE this widget cannot read; this shape is readable, it is just
 * not writable. This card is the producer direction only.
 */
function isSpecAcceptedLocation(candidate: LocationValue): boolean {
  return LocationValueSchema.safeParse(candidate).success;
}

/**
 * Build the value emitted for a freshly typed coordinate pair, carrying the
 * spec's two OPTIONAL keys across the edit (objectui#6664).
 *
 * The box edits `lat`/`lng` only, but a stored location may also carry
 * `altitude` and `accuracy` — both declared by `LocationValueSchema`, and both
 * registered on the platform's authorable surface, so a customer may write
 * them. Rebuilding the emission as a bare `{ lat, lng }` dropped them silently
 * the moment anyone retyped the coordinates, with nothing to warn them.
 *
 * ⛔ The carry is a KEY-BY-KEY pick out of an already-valid `LocationValue`,
 * and deliberately NOT a spread of `previous` (nor `Object.assign`): a stored
 * record may still hold the retired `{ latitude, longitude }` spelling, and
 * spreading it would carry that dialect straight back into the emitted object
 * and undo objectui#6272's rename. The spec schema cannot be that guard —
 * `LocationValueSchema` is a plain, NON-STRICT `z.object`, so it ACCEPTS a
 * polluted object and merely strips the unknown keys from its own parsed
 * OUTPUT, while the value handed to `onChange` keeps them. Both facts are
 * pinned in `__tests__/LocationField.optionalKeys.test.tsx`.
 *
 * Each optional key is taken only when it is a usable number. Measured against
 * the spec: `z.number()` rejects `NaN`, `Infinity` and a numeric string alike
 * (`invalid_type` at `[altitude]`), so carrying one of those forward would make
 * this widget emit a value the platform's own validator refuses. Leaving it
 * behind is a NARROWING — this emits less than it was handed, never more — not
 * a tolerant fallback of the kind AGENTS.md #0.1 bans.
 */
function carryOptionalKeys(lat: number, lng: number, previous: unknown): LocationValue {
  const emitted: LocationValue = { lat, lng };
  if (!isLocationValue(previous)) return emitted;
  if (isFiniteNumber(previous.altitude)) emitted.altitude = previous.altitude;
  if (isFiniteNumber(previous.accuracy)) emitted.accuracy = previous.accuracy;
  return emitted;
}

/**
 * LocationField - Geographic coordinate input for a `type: 'location'` value.
 *
 * Reads and writes `@objectstack/spec`'s `LocationValue` (`{ lat, lng }`) and
 * displays it as the comma-separated pair a user types. The coordinates are
 * still called latitude and longitude to a human — only the STORED key names
 * are the spec's, which is why the placeholder is unchanged.
 *
 * ⚠️ BREAKING (objectui#6272): a record stored in the deprecated
 * `{ latitude, longitude }` spelling — including one this widget itself wrote
 * before the flip — now renders EMPTY here until it is re-saved or fixed at the
 * data layer. It keeps rendering correctly in detail views and on the map,
 * which read the spec spelling first. That cost was presented and accepted as
 * part of the A1 ruling; it is not an oversight to route around with a shim.
 */
export function LocationField({ value, onChange, field, readonly, error, ...props }: FieldWidgetComponentProps<LocationValue | null>) {
  const config = field;
  // For display, convert the stored pair to a "lat, lng" string.
  const displayValue = isLocationValue(value) ? `${value.lat}, ${value.lng}` : '';

  if (readonly) {
    return <span className="text-sm">{displayValue || <EmptyValue />}</span>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val.trim()) {
      onChange(null);
      return;
    }

    // Parse as coordinates (latitude, longitude)
    const parts = val.split(',').map(p => p.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        // The typed pair replaces `lat`/`lng`; `altitude`/`accuracy` survive
        // the edit (objectui#6664). Key-by-key, never a spread — see above.
        const emitted = carryOptionalKeys(lat, lng, value);
        // objectui#6714: the SAME refusal the line below already applies to
        // text that isn't a coordinate pair, extended from format to RANGE.
        // Measured before choosing this: nothing downstream rejects or repairs
        // the value — a real `ObjectForm` submit hands `{ lat: 999, lng: 999 }`
        // straight to `dataSource.create`, with no error raised anywhere — so
        // refusing HERE is the only thing standing between a typo and storage.
        if (isSpecAcceptedLocation(emitted)) {
          onChange(emitted);
        }
      }
      // If the text is not a coordinate pair, or the pair is one the spec
      // refuses, don't update the value — the prior value stands.
    }
  };

  return (
    <Input
      // DOM pass-through onto the real focusable control (objectui#3318).
      {...toDomProps(props)}
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={config?.placeholder || 'latitude, longitude'}
      disabled={readonly || props.disabled}
      className={props.className}
      // AFTER the spread so this widget's own computation wins: `error` is
      // the published validation slot (#3222), `!!undefined` → explicit
      // "false".
      aria-invalid={!!error}
    />
  );
}
