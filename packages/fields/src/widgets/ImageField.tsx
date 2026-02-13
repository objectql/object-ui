import React, { useRef } from 'react';
import { Button } from '@object-ui/components';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { FieldWidgetProps } from './types';

/**
 * ImageField - Image upload widget with preview thumbnails
 * Supports single and multiple image uploads with drag-and-drop and preview display
 */
export function ImageField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<any>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageField = (field || (props as any).schema) as any;
  const multiple = imageField?.multiple || false;
  const accept = imageField?.accept ? imageField.accept.join(',') : 'image/*';

  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    
    const images = Array.isArray(value) ? value : [value];
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

  const images = value ? (Array.isArray(value) ? value : [value]) : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const imageObjects = selectedFiles.map(file => ({
      name: file.name,
      original_name: file.name,
      size: file.size,
      mime_type: file.type,
      // In a real implementation, this would upload the image and return a URL
      url: URL.createObjectURL(file),
    }));

    if (multiple) {
      onChange([...images, ...imageObjects]);
    } else {
      onChange(imageObjects[0]);
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
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemove(idx)}
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
          <ImageIcon className="size-4 mr-2" />
          {images.length > 0 ? 'Add More Images' : 'Upload Image'}
        </Button>
      </div>
    </div>
  );
}
