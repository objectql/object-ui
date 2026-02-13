import React, { useRef } from 'react';
import { Button } from '@object-ui/components';
import { Upload, X, File as FileIcon } from 'lucide-react';
import { FieldWidgetProps } from './types';

/**
 * FileField - File upload widget with drag-and-drop support
 * Supports single and multiple file uploads with configurable accepted file types
 */
export function FileField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<any>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileField = (field || (props as any).schema) as any;
  const multiple = fileField?.multiple || false;
  const accept = fileField?.accept ? fileField.accept.join(',') : undefined;

  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    
    const files = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-2">
        {files.map((file: any, idx: number) => (
          <span key={idx} className="text-sm truncate max-w-xs">
            {file.name || file.original_name || 'File'}
          </span>
        ))}
      </div>
    );
  }

  const files = value ? (Array.isArray(value) ? value : [value]) : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const fileObjects = selectedFiles.map(file => ({
      name: file.name,
      original_name: file.name,
      size: file.size,
      mime_type: file.type,
      // In a real implementation, this would upload the file and return a URL
      url: URL.createObjectURL(file),
    }));

    if (multiple) {
      onChange([...files, ...fileObjects]);
    } else {
      onChange(fileObjects[0]);
    }
  };

  const handleRemove = (index: number) => {
    if (multiple) {
      const newFiles = files.filter((_: any, i: number) => i !== index);
      onChange(newFiles.length > 0 ? newFiles : null);
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
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((file: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileIcon className="size-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm truncate">
                    {file.name || file.original_name || 'File'}
                  </span>
                  {file.size && (
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(idx)}
                  className="h-6 w-6 p-0"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full"
        >
          <Upload className="size-4 mr-2" />
          {files.length > 0 ? 'Add More Files' : 'Upload File'}
        </Button>
      </div>
    </div>
  );
}
