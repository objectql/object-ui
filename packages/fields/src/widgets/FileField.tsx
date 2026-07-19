import React, { useRef, useState, useCallback } from 'react';
import { Button, EmptyValue } from '@object-ui/components';
import { useUpload } from '@object-ui/providers';
import { Upload, X, File as FileIcon, ImageIcon, Camera, Loader2 } from 'lucide-react';
import { FieldWidgetProps } from './types';
import { useUploadingSignal } from './useUploadingSignal';

/**
 * Shared upload pipeline for the file widgets: validates size, uploads through
 * the configured UploadProvider adapter (with progress), and merges results
 * into the field value — append for `multiple`, replace otherwise. Extracted so
 * the full-size FileField and the compact grid-cell {@link FileCell} stay
 * behaviourally identical (same value shape, same error handling).
 */
function useFileUploads(opts: {
  files: any[];
  multiple: boolean;
  maxSize?: number;
  onChange: (value: any) => void;
}) {
  const { files, multiple, maxSize, onChange } = opts;
  const { upload } = useUpload();
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);

  const processFiles = useCallback(async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    const newErrors: string[] = [];

    const validFiles = selectedFiles.filter(file => {
      if (maxSize && file.size > maxSize) {
        const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
        newErrors.push(`"${file.name}" exceeds max size (${maxMB} MB)`);
        return false;
      }
      return true;
    });
    setErrors(newErrors);

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      const fileObjects = await Promise.all(
        validFiles.map(async (file) => {
          try {
            const result = await upload(file, {
              onProgress: (ratio) =>
                setUploadProgress((prev) => ({ ...prev, [file.name]: ratio })),
            });
            return {
              name: result.name,
              original_name: file.name,
              size: result.size,
              mime_type: result.mimeType,
              url: result.url,
            };
          } catch (err) {
            newErrors.push(`Failed to upload "${file.name}": ${(err as Error).message}`);
            setErrors([...newErrors]);
            return null;
          }
        }),
      );
      const successful = fileObjects.filter(Boolean) as any[];
      if (successful.length === 0) return;

      if (multiple) {
        onChange([...files, ...successful]);
      } else {
        onChange(successful[0]);
      }
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }, [files, multiple, onChange, maxSize, upload]);

  return { processFiles, errors, uploading, uploadProgress };
}

/**
 * FileField - File upload widget with drag-and-drop support
 * Supports single and multiple file uploads with configurable accepted file types.
 * L2: File size validation, per-file progress indicators, error messages.
 */
export function FileField({ value, onChange, field, readonly, onUploadingChange, ...props }: FieldWidgetProps<any>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileField = (field || (props as any).schema) as any;
  const multiple = fileField?.multiple || false;
  const accept = fileField?.accept ? fileField.accept.join(',') : undefined;
  const maxSize = fileField?.maxSize as number | undefined; // bytes
  /**
   * Camera capture mode for mobile devices.
   * - `'environment'` (back camera): photos of receipts, documents, products
   * - `'user'` (front camera): selfies, profile pictures
   * - `false`: disable the camera button entirely
   * @default 'environment' when accept includes image/* on a touch device
   */
  const captureMode = (fileField?.capture ?? null) as 'environment' | 'user' | false | null;
  const acceptsImages = !accept || accept.split(',').some((t: string) =>
    t.trim().startsWith('image/') || t.trim() === 'image/*' || t.trim().startsWith('.jp') || t.trim().startsWith('.png') || t.trim().startsWith('.gif') || t.trim().startsWith('.webp'),
  );
  // Auto-enable camera button on touch devices when image upload is permitted, unless explicitly disabled.
  const isTouchDevice = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || /Mobi|Android/i.test(navigator.userAgent));
  const cameraEnabled = captureMode === false ? false : (captureMode ?? (acceptsImages && isTouchDevice ? 'environment' : null));
  const [isDragOver, setIsDragOver] = useState(false);

  const files = value ? (Array.isArray(value) ? value : [value]) : [];
  const { processFiles, errors, uploading, uploadProgress } = useFileUploads({
    files, multiple, maxSize, onChange,
  });
  useUploadingSignal(uploading, onUploadingChange);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (accept) {
      const acceptedTypes = accept.split(',').map((t: string) => t.trim().toLowerCase());
      const filtered = droppedFiles.filter(file => {
        const parts = file.name.split('.');
        const ext = parts.length > 1 ? '.' + parts.pop()?.toLowerCase() : '';
        return acceptedTypes.some((t: string) =>
          t === file.type || (ext && t === ext) || (t.endsWith('/*') && file.type.startsWith(t.replace('/*', '/')))
        );
      });
      processFiles(filtered);
    } else {
      processFiles(droppedFiles);
    }
  }, [accept, processFiles]);

  if (readonly) {
    if (!value) return <EmptyValue />;
    
    const readonlyFiles = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-2">
        {readonlyFiles.map((file: any, idx: number) => (
          <span key={idx} className="text-sm truncate max-w-xs">
            {file.name || file.original_name || 'File'}
          </span>
        ))}
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
  };

  const handleRemove = (index: number) => {
    if (multiple) {
      const newFiles = files.filter((_: any, i: number) => i !== index);
      onChange(newFiles.length > 0 ? newFiles : null);
    } else {
      onChange(null);
    }
  };

  const isImage = (file: any) => {
    const mime = file.mime_type || '';
    return mime.startsWith('image/');
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
      {cameraEnabled && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture={cameraEnabled}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Camera capture"
          data-testid="file-field-camera-input"
        />
      )}
      
      <div className="space-y-2">
        {/* Drag-and-drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 p-6 
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200
            ${isDragOver 
              ? 'border-primary bg-primary/5 text-primary' 
              : 'border-muted-foreground/25 hover:border-primary/50 text-muted-foreground hover:text-foreground'}
          `}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <Upload className={`size-8 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse{cameraEnabled ? ' • use the camera button below' : ''}
            </p>
          </div>
        </div>

        {cameraEnabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              cameraRef.current?.click();
            }}
            data-testid="file-field-camera-button"
          >
            <Camera className="size-4 mr-2" />
            {cameraEnabled === 'user' ? 'Take selfie' : 'Take photo'}
          </Button>
        )}

        {/* Upload progress indicator */}
        {uploading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="file-field-uploading">
            <Loader2 className="size-3 animate-spin" />
            <span>
              Uploading…
              {Object.keys(uploadProgress).length > 0 &&
                ` (${Math.round(
                  (Object.values(uploadProgress).reduce((s, v) => s + v, 0) /
                    Object.keys(uploadProgress).length) * 100,
                )}%)`}
            </span>
          </div>
        )}

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="space-y-0.5">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive">{err}</p>
            ))}
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((file: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-md border"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isImage(file) && file.url ? (
                    <img src={file.url} alt={file.name} className="size-8 object-cover rounded shrink-0" />
                  ) : isImage(file) ? (
                    <ImageIcon className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <FileIcon className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm truncate">
                    {file.name || file.original_name || 'File'}
                  </span>
                  {file.size && (
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(idx);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FileCell — compact upload control for a line-item grid cell (objectui#2360).
 *
 * Same value shape and upload pipeline as {@link FileField}, sized for a 32px
 * grid row: existing files render as removable chips (image thumbnail / file
 * icon + name) and a small button opens the native file picker. No
 * drag-and-drop zone — a grid cell has no room for one; the per-row expand
 * form still offers the full-size FileField.
 */
export function FileCell({
  value,
  onChange,
  disabled,
  multiple,
  accept,
  maxSize,
  'aria-label': ariaLabel,
  'data-cell': dataCell,
}: {
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  multiple?: boolean;
  /** Comma-joined accept list for the native picker (e.g. `"image/*,.pdf"`). */
  accept?: string;
  /** Max file size in bytes (oversize picks are rejected with an inline error). */
  maxSize?: number;
  'aria-label'?: string;
  /** Focus-grid coordinate (see GridField keyboard navigation). */
  'data-cell'?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const files = value ? (Array.isArray(value) ? value : [value]) : [];
  const { processFiles, errors, uploading } = useFileUploads({
    files, multiple: !!multiple, maxSize, onChange,
  });

  const removeAt = (index: number) => {
    if (multiple) {
      const next = files.filter((_: any, i: number) => i !== index);
      onChange(next.length > 0 ? next : null);
    } else {
      onChange(null);
    }
  };

  const isImage = (file: any) => String(file?.mime_type || '').startsWith('image/');
  const nameOf = (file: any) =>
    typeof file === 'string' ? file : file?.name || file?.original_name || 'File';
  const showUpload = !disabled && !uploading && (multiple || files.length === 0);

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 px-1 py-0.5">
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          processFiles(Array.from(e.target.files || []));
          e.target.value = ''; // allow re-picking the same file
        }}
        className="hidden"
      />
      {files.map((file: any, idx: number) => (
        <span
          key={idx}
          className="inline-flex max-w-40 items-center gap-1 rounded border bg-muted/50 px-1 py-0.5 text-xs"
          title={nameOf(file)}
          data-testid="file-cell-chip"
        >
          {isImage(file) && file.url ? (
            <img src={file.url} alt={nameOf(file)} className="size-5 shrink-0 rounded object-cover" />
          ) : (
            <FileIcon className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{nameOf(file)}</span>
          {!disabled && (
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${nameOf(file)}`}
              onClick={() => removeAt(idx)}
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {uploading && (
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          data-testid="file-cell-uploading"
        >
          <Loader2 className="size-3.5 animate-spin" />
        </span>
      )}
      {showUpload && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => inputRef.current?.click()}
          aria-label={ariaLabel}
          data-cell={dataCell}
          disabled={disabled}
        >
          <Upload className="size-3.5" />
          {files.length === 0 && 'Upload'}
        </Button>
      )}
      {errors.length > 0 && (
        <span className="w-full truncate text-[11px] text-destructive" title={errors.join('; ')}>
          {errors[0]}
        </span>
      )}
    </div>
  );
}
