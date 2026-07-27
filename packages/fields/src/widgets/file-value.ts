/**
 * File field value shapes (ObjectStack ADR-0104 D3 wave 2).
 *
 * A `file`/`image`/`avatar`/`video`/`audio` field value reaches the UI in one
 * of three forms, and every widget that renders one has to cope with all
 * three — so the rules live here once rather than being re-derived per widget.
 *
 *  1. **Reference** — a bare `sys_file` id string. The form the backend stores
 *     once file-as-reference is adopted.
 *  2. **Expanded** — `{ id, name, size, mimeType, url }`, what the read path
 *     returns after resolving a stored reference. Note `mimeType`: this comes
 *     from the platform's spec-owned `FileValueSchema` and is **camelCase**.
 *  3. **Legacy inline blob** — `{ file_id?, name, original_name, size,
 *     mime_type, url }`, the pre-reference shape this package used to build
 *     itself, with **snake_case** `mime_type`.
 *
 * That casing split is the whole reason this module exists: a widget reading
 * only `mime_type` silently stops recognising images the moment the backend
 * starts returning the expanded form, and the failure looks like "thumbnails
 * disappeared" rather than anything pointing at a value shape.
 *
 * ## Submitting
 *
 * When the upload adapter surfaced a `fileId`, the widget submits the **bare
 * id** — the reference form. When it did not (the object-URL fallback adapter,
 * an older backend), it submits the legacy blob unchanged. So the same build
 * works against a backend that has adopted references and one that has not.
 * Action params already POST a bare fileId; this brings record field values
 * onto the same contract.
 */

/** A file value normalised for rendering, whatever form it arrived in. */
export interface FileValueView {
  /** `sys_file` id, when the value carries one. */
  id?: string;
  /** Best available display name. Never empty. */
  name: string;
  /** Resolvable URL, when the value carries one. A bare reference does not. */
  url?: string;
  size?: number;
  mimeType?: string;
  /** The value as it arrived, so callers can pass it through untouched. */
  raw: unknown;
}

/**
 * A minted file id: uuid/nanoid-shaped, and crucially not a URL — a URL always
 * carries `:`, `/` or `.`, so it can never match. Mirrors the platform's
 * `isFileIdToken`, which is the arbiter on the server side of the same question.
 */
export function isFileIdToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/**
 * The `sys_file` id a value refers to, or `undefined`.
 *
 * `file_id ?? id` matches the rule `serializeParamValues` already applies to
 * action params — one extraction rule for both surfaces.
 */
export function fileIdOf(value: unknown): string | undefined {
  if (isFileIdToken(value)) return value;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const id = o.file_id ?? o.id;
    if (typeof id === 'string' && id) return id;
  }
  return undefined;
}

/** Last path segment of a URL, used as a display name of last resort. */
function nameFromUrl(url: string): string {
  const path = url.split(/[?#]/)[0] ?? url;
  const seg = path.split('/').filter(Boolean).pop();
  return seg ? decodeURIComponent(seg) : url;
}

/**
 * Normalise one file value for display.
 *
 * @param fallbackName shown when the value carries no usable name — pass a
 *   translated string so the widget stays localised.
 */
export function readFileValue(value: unknown, fallbackName = 'File'): FileValueView {
  if (value == null) return { name: fallbackName, raw: value };

  if (typeof value === 'string') {
    // A bare id has no name or URL of its own — the backend expands it on read.
    if (isFileIdToken(value)) return { id: value, name: fallbackName, raw: value };
    // Otherwise it is a URL (legacy external link, data:, blob:).
    return { url: value, name: nameFromUrl(value), raw: value };
  }

  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
    const url = str(o.url);
    const name =
      str(o.name) ??
      str(o.original_name) ??
      (url ? nameFromUrl(url) : undefined) ??
      fallbackName;
    return {
      id: fileIdOf(o),
      name,
      url,
      size: typeof o.size === 'number' ? o.size : undefined,
      // Expanded form is camelCase, legacy blob is snake_case — accept both.
      mimeType: str(o.mimeType) ?? str(o.mime_type),
      raw: value,
    };
  }

  return { name: fallbackName, raw: value };
}

/** Normalise a field value (single or `multiple`) to an array of views. */
export function readFileValues(value: unknown, fallbackName = 'File'): FileValueView[] {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.filter((v) => v != null).map((v) => readFileValue(v, fallbackName));
}

/** Does this value look like an image, by MIME type? */
export function isImageValue(view: FileValueView): boolean {
  return (view.mimeType ?? '').startsWith('image/');
}

/** The subset of an upload result these helpers read. */
export interface UploadResultLike {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  meta?: Record<string, unknown>;
}

/**
 * What to store in the field for a completed upload.
 *
 * Returns the bare `sys_file` id when the adapter surfaced one — the reference
 * form — and the legacy inline blob when it did not, so a deployment whose
 * upload adapter or backend predates file-as-reference keeps working unchanged.
 */
export function fileValueForSubmit(
  result: UploadResultLike,
  originalName?: string,
): string | Record<string, unknown> {
  const fileId = (result.meta as { fileId?: unknown } | undefined)?.fileId;
  if (isFileIdToken(fileId)) return fileId;
  return {
    name: result.name,
    original_name: originalName ?? result.name,
    size: result.size,
    mime_type: result.mimeType,
    url: result.url,
  };
}

/**
 * The display view of a just-completed upload.
 *
 * Submitting a bare id means the field value no longer carries the name, size
 * or URL needed to render it, and the enriched form only comes back on the next
 * read. Widgets keep these views keyed by id so an upload appears immediately
 * instead of showing a bare token until a refetch.
 */
export function uploadResultView(result: UploadResultLike, originalName?: string): FileValueView {
  const id = isFileIdToken((result.meta as { fileId?: unknown } | undefined)?.fileId)
    ? ((result.meta as { fileId?: string }).fileId as string)
    : undefined;
  return {
    id,
    name: result.name || originalName || 'File',
    url: result.url,
    size: result.size,
    mimeType: result.mimeType,
    raw: result,
  };
}

/**
 * Merge locally-known upload views over a field value's own views, matched by
 * id. A value that is still a bare reference picks up the name/URL captured at
 * upload time; anything already enriched by the backend is left alone.
 */
export function withRecentUploads(
  views: FileValueView[],
  recent: Record<string, FileValueView>,
): FileValueView[] {
  if (Object.keys(recent).length === 0) return views;
  return views.map((v) => {
    if (!v.id || v.url) return v;
    const known = recent[v.id];
    return known ? { ...known, raw: v.raw } : v;
  });
}
