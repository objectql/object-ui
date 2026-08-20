import React, { useRef, useState, useCallback, lazy, Suspense } from 'react';
import { Button, EmptyValue } from '@object-ui/components';
import { useUpload } from '@object-ui/providers';
import { useObjectTranslation } from '@object-ui/i18n';
import { X, Image as ImageIcon, Crop as CropIcon, Loader2 } from 'lucide-react';
import { FieldWidgetComponentProps } from './types.js';
import { toDomProps } from './toDomProps.js';
import { ImageLightbox } from './ImageLightbox.js';
import { useUploadingSignal } from './useUploadingSignal.js';
import { maxSizeError, type TranslateFn } from './file-size-guard.js';
import {
  fileValueForSubmit,
  readFileValues,
  uploadResultView,
  withRecentUploads,
  type FileValueView,
} from './file-value.js';

// Lazy-load the cropper so the dialog (canvas + crop logic) is not in the initial
// ImageField bundle. Consumers that never crop pay zero cost.
const ImageCropperDialog = lazy(() =>
  import('./ImageCropperDialog.js').then((m) => ({ default: m.ImageCropperDialog })),
);

/**
 * ImageField - Image upload widget with preview thumbnails
 * Supports single and multiple image uploads with drag-and-drop and preview display
 */
export function ImageField({ value, onChange, field, readonly, onUploadingChange, error, ...props }: FieldWidgetComponentProps<any>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageField = field as any;
  const multiple = imageField?.multiple || false;
  const accept = imageField?.accept ? imageField.accept.join(',') : 'image/*';
  /**
   * Max upload size in bytes. Delivered by `paramToField` for an action param
   * and by the field config for a record field; enforced before any upload
   * starts, exactly as FileField does (objectui#4141).
   */
  const maxSize = imageField?.maxSize as number | undefined;
  /**
   * Set `field.crop = false` to opt out of inline cropping. Defaults to enabled.
   */
  const cropEnabled = imageField?.crop !== false;
  const [cropTarget, setCropTarget] = useState<{ index: number; src: string; name: string } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { upload } = useUpload();
  const { t } = useObjectTranslation();
  const [uploading, setUploading] = useState(false);
  /** Client-side rejections (oversize picks), cleared on the next attempt. */
  const [errors, setErrors] = useState<string[]>([]);
  // Display details of just-uploaded images, keyed by their new `sys_file` id.
  // Submitting the reference form means the field value no longer carries the
  // URL a thumbnail needs; these keep the preview visible until the next read
  // returns the expanded form. See `file-value`.
  const [recent, setRecent] = useState<Record<string, FileValueView>>({});
  useUploadingSignal(uploading, onUploadingChange);

  // Derived value + memoized handlers must run before the readonly early return
  // so hook order stays stable across renders.
  const images = value ? (Array.isArray(value) ? value : [value]) : [];
  const views = withRecentUploads(readFileValues(value, 'Image'), recent);

  const remember = useCallback((result: any, originalName: string) => {
    const view = uploadResultView(result, originalName);
    if (view.id) setRecent((prev) => ({ ...prev, [view.id as string]: view }));
  }, []);

  const handleCropConfirm = useCallback(
    async (blob: Blob, name: string) => {
      if (!cropTarget) return;
      // The size that matters here is the CROP's, not the source image's: the
      // cropper re-encodes to PNG, so cropping an in-limit JPEG can produce a
      // blob over the limit. Checked before `setUploading` so a rejected crop
      // never flashes the spinner, and the dialog closes so the message lands
      // in the field's error row rather than behind the open dialog.
      const rejection = maxSizeError(t as TranslateFn, { name, size: blob.size }, maxSize);
      if (rejection) {
        setErrors([rejection]);
        setCropTarget(null);
        return;
      }
      setErrors([]);
      setUploading(true);
      try {
        const result = await upload(blob);
        remember(result, name);
        const next = fileValueForSubmit(result, name);
        if (multiple) {
          const updated = [...images];
          updated[cropTarget.index] = next;
          onChange(updated);
        } else {
          onChange(next);
        }
      } finally {
        setUploading(false);
        setCropTarget(null);
      }
    },
    [cropTarget, images, multiple, onChange, upload, remember, maxSize, t],
  );

  const openCropper = useCallback(
    (index: number) => {
      const img = views[index];
      if (!img?.url) return;
      setCropTarget({ index, src: img.url, name: img.name || `image-${index}.png` });
    },
    [views],
  );

  const lightboxImages = views.filter((v) => v.url).map((v) => ({ url: v.url as string, name: v.name }));

  if (readonly) {
    if (!value || lightboxImages.length === 0) return <EmptyValue />;

    return (
      <>
        <div className="flex flex-wrap gap-2">
          {lightboxImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="group relative overflow-hidden rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={t('fields.image.enlarge', { name: img.name || t('fields.image.imageAlt', { index: idx + 1 }) })}
            >
              <img
                src={img.url}
                alt={img.name || t('fields.image.imageAlt', { index: idx + 1 })}
                className="size-20 object-cover transition-transform duration-150 group-hover:scale-105"
              />
              <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </button>
          ))}
        </div>
        {lightboxIndex !== null && (
          <ImageLightbox
            images={lightboxImages}
            index={lightboxIndex}
            open
            onOpenChange={(o) => !o && setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        )}
      </>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    // Reset the input up front rather than in `finally`: a pick rejected below
    // returns before the upload runs, and leaving the old value in place would
    // stop the user re-picking the same name after shrinking the image.
    // `selectedFiles` already holds the File objects, so clearing is safe.
    if (inputRef.current) inputRef.current.value = '';
    if (selectedFiles.length === 0) return;

    // Enforce the declared limit before anything touches the network. Partial
    // acceptance matches FileField: the in-limit picks of a multi-select still
    // upload, and only the oversize ones are reported.
    const rejections: string[] = [];
    const validFiles = selectedFiles.filter((file) => {
      const rejection = maxSizeError(t as TranslateFn, file, maxSize);
      if (rejection) {
        rejections.push(rejection);
        return false;
      }
      return true;
    });
    setErrors(rejections);
    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      const imageObjects = await Promise.all(
        validFiles.map(async (file) => {
          const result = await upload(file);
          remember(result, file.name);
          return fileValueForSubmit(result, file.name);
        }),
      );

      if (multiple) {
        onChange([...images, ...imageObjects]);
      } else {
        onChange(imageObjects[0]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    if (multiple) {
      const newImages = images.filter((_: any, i: number) => i !== index);
      onChange(newImages.length > 0 ? newImages : null);
    } else {
      onChange(null);
    }
  };

  return (
    <div className={props.className}>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="space-y-2">
        {views.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {views.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.url || ''}
                  alt={img.name || t('fields.image.imageAlt', { index: idx + 1 })}
                  className="size-20 rounded-md object-cover border border-gray-200"
                />
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {cropEnabled && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openCropper(idx)}
                      className="h-6 w-6 p-0"
                      aria-label={t('fields.image.crop', { index: idx + 1 })}
                      data-testid={`image-field-crop-${idx}`}
                    >
                      <CropIcon className="size-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(idx)}
                    className="h-6 w-6 p-0"
                    aria-label={t('fields.image.remove', { index: idx + 1 })}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Button
          // DOM pass-through onto the widget's real focusable control — the
          // upload button is the keyboard path to the hidden file input
          // (objectui#3318).
          {...toDomProps(props)}
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full"
          disabled={uploading}
          data-testid="image-field-upload-button"
          // AFTER the spread so this widget's own computation wins (#3222).
          aria-invalid={!!error}
        >
          {uploading ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <ImageIcon className="size-4 mr-2" />
          )}
          {uploading
            ? t('fields.image.uploading')
            : images.length > 0
              ? t('fields.image.addMore')
              : t('fields.image.upload')}
        </Button>

        {/* Client-side rejections (oversize picks). Same presentation as
            FileField's error row — this widget previously had no surface for
            them at all, because it never rejected anything (objectui#4141). */}
        {errors.length > 0 && (
          <div className="space-y-0.5">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive">{err}</p>
            ))}
          </div>
        )}
      </div>

      {cropEnabled && cropTarget && (
        <Suspense fallback={null}>
          <ImageCropperDialog
            open
            onOpenChange={(o) => !o && setCropTarget(null)}
            src={cropTarget.src}
            outputName={cropTarget.name}
            onConfirm={handleCropConfirm}
          />
        </Suspense>
      )}
    </div>
  );
}
