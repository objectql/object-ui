import React, { useRef, useState, useCallback, lazy, Suspense } from 'react';
import { Button, EmptyValue } from '@object-ui/components';
import { useUpload } from '@object-ui/providers';
import { Upload, X, Image as ImageIcon, Crop as CropIcon, Loader2 } from 'lucide-react';
import { FieldWidgetProps } from './types';
import { useUploadingSignal } from './useUploadingSignal';

// Lazy-load the cropper so the dialog (canvas + crop logic) is not in the initial
// ImageField bundle. Consumers that never crop pay zero cost.
const ImageCropperDialog = lazy(() =>
  import('./ImageCropperDialog').then((m) => ({ default: m.ImageCropperDialog })),
);

/**
 * ImageField - Image upload widget with preview thumbnails
 * Supports single and multiple image uploads with drag-and-drop and preview display
 */
export function ImageField({ value, onChange, field, readonly, onUploadingChange, ...props }: FieldWidgetProps<any>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageField = (field || (props as any).schema) as any;
  const multiple = imageField?.multiple || false;
  const accept = imageField?.accept ? imageField.accept.join(',') : 'image/*';
  /**
   * Set `field.crop = false` to opt out of inline cropping. Defaults to enabled.
   */
  const cropEnabled = imageField?.crop !== false;
  const [cropTarget, setCropTarget] = useState<{ index: number; src: string; name: string } | null>(null);
  const { upload } = useUpload();
  const [uploading, setUploading] = useState(false);
  useUploadingSignal(uploading, onUploadingChange);

  // Derived value + memoized handlers must run before the readonly early return
  // so hook order stays stable across renders.
  const images = value ? (Array.isArray(value) ? value : [value]) : [];

  const handleCropConfirm = useCallback(
    async (blob: Blob, name: string) => {
      if (!cropTarget) return;
      setUploading(true);
      try {
        const result = await upload(blob);
        const next = {
          name: result.name || name,
          original_name: name,
          size: result.size,
          mime_type: result.mimeType,
          url: result.url,
        };
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
    [cropTarget, images, multiple, onChange, upload],
  );

  const openCropper = useCallback(
    (index: number) => {
      const img = images[index];
      if (!img?.url) return;
      setCropTarget({ index, src: img.url, name: img.name || `image-${index}.png` });
    },
    [images],
  );

  if (readonly) {
    if (!value) return <EmptyValue />;

    return (
      <div className="flex flex-wrap gap-2">
        {images.map((img: any, idx: number) => (
          <img
            key={idx}
            src={img.url || ''}
            alt={img.name || `Image ${idx + 1}`}
            className="size-20 rounded-md object-cover border border-gray-200"
          />
        ))}
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      const imageObjects = await Promise.all(
        selectedFiles.map(async (file) => {
          const result = await upload(file);
          return {
            name: result.name,
            original_name: file.name,
            size: result.size,
            mime_type: result.mimeType,
            url: result.url,
          };
        }),
      );

      if (multiple) {
        onChange([...images, ...imageObjects]);
      } else {
        onChange(imageObjects[0]);
      }
    } finally {
      setUploading(false);
      // Reset input so picking the same file again still triggers change.
      if (inputRef.current) inputRef.current.value = '';
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
        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img: any, idx: number) => (
              <div key={idx} className="relative group">
                <img
                  src={img.url || ''}
                  alt={img.name || `Image ${idx + 1}`}
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
                      aria-label={`Crop image ${idx + 1}`}
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
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full"
          disabled={uploading}
          data-testid="image-field-upload-button"
        >
          {uploading ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <ImageIcon className="size-4 mr-2" />
          )}
          {uploading ? 'Uploading…' : images.length > 0 ? 'Add More Images' : 'Upload Image'}
        </Button>
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
