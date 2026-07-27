import { describe, it, expect } from 'vitest';
import {
  isFileIdToken,
  fileIdOf,
  readFileValue,
  readFileValues,
  isImageValue,
  fileValueForSubmit,
  uploadResultView,
  withRecentUploads,
} from './file-value';

const uploadResult = (over: Record<string, unknown> = {}) => ({
  url: 'https://app.example.com/api/v1/storage/files/file_a',
  name: 'a.png',
  size: 1024,
  mimeType: 'image/png',
  ...over,
});

describe('isFileIdToken', () => {
  it.each(['file_a', 'abc123', '0e2f4c1a-9b7d-4e3f-8a1b-2c3d4e5f6a7b', 'A-_9'])(
    'accepts the minted id %s',
    (v) => expect(isFileIdToken(v)).toBe(true),
  );

  it.each([
    'https://cdn.example.com/a.png',
    '/api/v1/storage/files/file_a',
    'data:image/png;base64,aGk=',
    'blob:http://localhost/abc',
    'a.png',
    '',
  ])('rejects the URL-shaped or dotted value %s', (v) => expect(isFileIdToken(v)).toBe(false));

  it('rejects non-strings and over-long values', () => {
    expect(isFileIdToken(null)).toBe(false);
    expect(isFileIdToken(42)).toBe(false);
    expect(isFileIdToken('a'.repeat(65))).toBe(false);
  });
});

describe('fileIdOf', () => {
  it('reads a bare reference', () => {
    expect(fileIdOf('file_a')).toBe('file_a');
  });

  it('prefers file_id, then id', () => {
    expect(fileIdOf({ file_id: 'legacy', id: 'expanded' })).toBe('legacy');
    expect(fileIdOf({ id: 'expanded' })).toBe('expanded');
  });

  it('returns undefined when there is no id to read', () => {
    expect(fileIdOf({ url: 'https://cdn.example.com/a.png', name: 'a.png' })).toBeUndefined();
    expect(fileIdOf('https://cdn.example.com/a.png')).toBeUndefined();
    expect(fileIdOf(null)).toBeUndefined();
  });
});

describe('readFileValue', () => {
  /**
   * The casing split is the reason this module exists: the platform's expanded
   * form is camelCase `mimeType`, the legacy inline blob is snake_case
   * `mime_type`. A widget reading only one silently stops recognising images
   * the moment the backend switches form.
   */
  it('reads the expanded form (camelCase mimeType)', () => {
    const view = readFileValue({
      id: 'file_a',
      name: 'a.png',
      size: 1024,
      mimeType: 'image/png',
      url: '/api/v1/storage/files/file_a',
    });

    expect(view).toMatchObject({
      id: 'file_a',
      name: 'a.png',
      size: 1024,
      mimeType: 'image/png',
      url: '/api/v1/storage/files/file_a',
    });
    expect(isImageValue(view)).toBe(true);
  });

  it('reads the legacy inline blob (snake_case mime_type)', () => {
    const view = readFileValue({
      file_id: 'file_a',
      name: 'a.png',
      original_name: 'original.png',
      size: 1024,
      mime_type: 'image/png',
      url: 'https://cdn.example.com/a.png',
    });

    expect(view).toMatchObject({ id: 'file_a', name: 'a.png', mimeType: 'image/png' });
    expect(isImageValue(view)).toBe(true);
  });

  it('falls back to original_name when name is absent', () => {
    expect(readFileValue({ original_name: 'orig.pdf' }).name).toBe('orig.pdf');
  });

  it('derives a name from the URL when the value carries none', () => {
    expect(readFileValue({ url: 'https://cdn.example.com/docs/report%20v2.pdf' }).name).toBe(
      'report v2.pdf',
    );
    expect(readFileValue('https://cdn.example.com/a.png').name).toBe('a.png');
  });

  it('reads a bare reference as an id with no URL of its own', () => {
    const view = readFileValue('file_a', 'File');

    // Honest: an unexpanded reference genuinely has nothing to render from.
    expect(view).toMatchObject({ id: 'file_a', name: 'File' });
    expect(view.url).toBeUndefined();
  });

  it('treats a URL string as a URL, never as a reference', () => {
    const view = readFileValue('/api/v1/storage/files/file_a');
    expect(view.id).toBeUndefined();
    expect(view.url).toBe('/api/v1/storage/files/file_a');
  });

  it('uses the supplied fallback name so widgets stay localised', () => {
    expect(readFileValue({}, '文件').name).toBe('文件');
    expect(readFileValue(null, '文件').name).toBe('文件');
  });

  it('is not an image when the MIME type says otherwise or is missing', () => {
    expect(isImageValue(readFileValue({ mimeType: 'application/pdf' }))).toBe(false);
    expect(isImageValue(readFileValue({ name: 'a.png' }))).toBe(false);
  });
});

describe('readFileValues', () => {
  it('normalises single, array and empty values', () => {
    expect(readFileValues(null)).toEqual([]);
    expect(readFileValues([])).toEqual([]);
    expect(readFileValues('file_a')).toHaveLength(1);
    expect(readFileValues(['file_a', 'file_b'])).toHaveLength(2);
  });

  it('drops null entries inside an array', () => {
    expect(readFileValues(['file_a', null, 'file_b'])).toHaveLength(2);
  });

  it('handles a mixed-form array during the transition', () => {
    const views = readFileValues([
      'file_a',
      { id: 'file_b', name: 'b.png', mimeType: 'image/png' },
      { name: 'c.png', mime_type: 'image/png', url: 'https://cdn.example.com/c.png' },
    ]);

    expect(views.map((v) => v.id)).toEqual(['file_a', 'file_b', undefined]);
    expect(views.map(isImageValue)).toEqual([false, true, true]);
  });
});

describe('fileValueForSubmit', () => {
  it('submits the bare reference when the adapter surfaced a fileId', () => {
    expect(fileValueForSubmit(uploadResult({ meta: { fileId: 'file_a' } }), 'orig.png')).toBe(
      'file_a',
    );
  });

  /**
   * Back-compat: the object-URL fallback adapter, or a backend predating
   * file-as-reference, surfaces no fileId. The same build must keep working
   * there, so it submits the legacy blob unchanged.
   */
  it('falls back to the legacy inline blob when there is no fileId', () => {
    expect(fileValueForSubmit(uploadResult(), 'orig.png')).toEqual({
      name: 'a.png',
      original_name: 'orig.png',
      size: 1024,
      mime_type: 'image/png',
      url: 'https://app.example.com/api/v1/storage/files/file_a',
    });
  });

  it('ignores a meta.fileId that is not id-shaped', () => {
    const v = fileValueForSubmit(uploadResult({ meta: { fileId: 'https://evil.example/x' } }));
    expect(typeof v).toBe('object');
  });

  it('round-trips through readFileValue in both modes', () => {
    const asRef = fileValueForSubmit(uploadResult({ meta: { fileId: 'file_a' } }));
    const asBlob = fileValueForSubmit(uploadResult(), 'orig.png');

    expect(readFileValue(asRef).id).toBe('file_a');
    expect(readFileValue(asBlob).mimeType).toBe('image/png');
  });
});

describe('withRecentUploads', () => {
  it('fills in display details for a bare reference just uploaded', () => {
    const view = uploadResultView(uploadResult({ meta: { fileId: 'file_a' } }), 'orig.png');
    const merged = withRecentUploads(readFileValues('file_a'), { file_a: view });

    expect(merged[0]).toMatchObject({
      id: 'file_a',
      name: 'a.png',
      mimeType: 'image/png',
      url: 'https://app.example.com/api/v1/storage/files/file_a',
    });
    // The raw value stays the reference — display enrichment must not change
    // what the field submits.
    expect(merged[0].raw).toBe('file_a');
  });

  it('leaves a value the backend already expanded alone', () => {
    const stale = uploadResultView(uploadResult({ name: 'stale.png', meta: { fileId: 'file_a' } }));
    const expanded = readFileValues([{ id: 'file_a', name: 'fresh.png', url: '/u', mimeType: 'image/png' }]);

    expect(withRecentUploads(expanded, { file_a: stale })[0].name).toBe('fresh.png');
  });

  it('is a no-op with nothing remembered', () => {
    const views = readFileValues('file_a');
    expect(withRecentUploads(views, {})).toBe(views);
  });
});
