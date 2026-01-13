import { ComponentRegistry } from '@object-ui/core';
import { Label, Button } from '@/ui';
import { Upload, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

ComponentRegistry.register('file-upload', 
  ({ schema, className, value, onChange, ...props }) => {
    const [files, setFiles] = useState<File[]>(value || []);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = Array.from(e.target.files || []);
      const updatedFiles = schema.multiple ? [...files, ...newFiles] : newFiles;
      setFiles(updatedFiles);
      if (onChange) {
        onChange(updatedFiles);
      }
    };

    const handleRemoveFile = (index: number) => {
      const updatedFiles = files.filter((_, i) => i !== index);
      setFiles(updatedFiles);
      if (onChange) {
        onChange(updatedFiles);
      }
    };

    const handleClick = () => {
      inputRef.current?.click();
    };

    return (
      <div className={`grid w-full max-w-sm items-center gap-1.5 ${schema.wrapperClass || ''}`}>
        {schema.label && <Label htmlFor={schema.id}>{schema.label}</Label>}
        <div className={cn('flex flex-col gap-2', className)}>
          <input
            ref={inputRef}
            type="file"
            id={schema.id}
            className="hidden"
            accept={schema.accept}
            multiple={schema.multiple}
            onChange={handleFileChange}
            {...props}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleClick}
          >
            <Upload className="mr-2 h-4 w-4" />
            {schema.buttonText || 'Choose files'}
          </Button>
          {files.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border rounded-md text-sm"
                >
                  <span className="truncate flex-1">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleRemoveFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
  {
    label: 'File Upload',
    inputs: [
      { name: 'label', type: 'string', label: 'Label' },
      { name: 'buttonText', type: 'string', label: 'Button Text' },
      { name: 'accept', type: 'string', label: 'Accepted File Types', description: 'MIME types (e.g., "image/*,application/pdf")' },
      { name: 'multiple', type: 'boolean', label: 'Allow Multiple Files' },
      { name: 'id', type: 'string', label: 'ID', required: true }
    ],
    defaultProps: {
      label: 'Upload files',
      buttonText: 'Choose files',
      multiple: true,
      id: 'file-upload-field'
    }
  }
);
