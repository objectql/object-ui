/**
 * The client-side `maxSize` guard shared by the file and image widgets
 * (objectui#4141).
 *
 * Why this is shared rather than mirrored per widget: the guard is the only
 * thing standing between a declared `maxSize` and a real `presigned → PUT →
 * complete` round trip, and `paramToField` copies `maxSize` onto the field
 * config for **every** param type regardless of which widget ends up rendering
 * it. So a widget that re-derives the check drifts silently — the image param
 * shipped receiving the constraint and never reading it, while the file param
 * rejected the identical pick, and nothing failed until QA drove the two side by
 * side. One exported function makes the difference visible: a widget either
 * calls it or conspicuously does not.
 *
 * Both widgets deliberately share the `fields.file.exceedsMaxSize` key too. The
 * sentence names a file and a limit and says nothing file-widget-specific, it is
 * already translated in all 11 built-in locales, and a parallel `fields.image.*`
 * twin would be the same sentence maintained twice — drifting the moment one
 * translator rewords one of them.
 */

/**
 * Minimal shape of the i18next `t` this module needs, matching the established
 * `TranslateFn` pattern in `app-shell/src/providers/writeWarningToast`.
 */
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Divisor for rendering a byte limit as MB, matching the widgets' size display. */
const BYTES_PER_MB = 1024 * 1024;

/**
 * The rejection message for a pick that exceeds `maxSize`, or `null` when the
 * pick is within the limit — so a caller reads it as `if (err) reject`.
 *
 * A falsy `maxSize` (undeclared, or an explicit `0`) means **unrestricted**,
 * preserving the `if (maxSize && …)` semantics the file widget has always
 * applied: an undeclared limit must never turn into a 0-byte one.
 *
 * Takes `name` and `size` separately instead of a `File` because the image
 * widget's crop path validates a re-encoded `Blob`, which carries no name of its
 * own — that name comes from the cropper's output.
 */
export function maxSizeError(
  t: TranslateFn,
  pick: { name: string; size: number },
  maxSize: number | undefined,
): string | null {
  if (!maxSize || pick.size <= maxSize) return null;
  const maxMB = (maxSize / BYTES_PER_MB).toFixed(1);
  return t('fields.file.exceedsMaxSize', {
    defaultValue: `"${pick.name}" exceeds max size (${maxMB} MB)`,
    name: pick.name,
    max: maxMB,
  });
}
