import React from 'react';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@object-ui/components';
import { Upload, X } from 'lucide-react';
import { FieldWidgetProps } from './types';

/**
 * Avatar field widget - provides an avatar/profile picture uploader
 * Supports image URLs or file uploads
 */
export function AvatarField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  const [isHovered, setIsHovered] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const avatarField = (field || (props as any).schema) as any;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      console.error('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error('File size must be less than 5MB');
      return;
    }

    // Convert to base64 or upload to server
    const reader = new FileReader();
    reader.onloadend = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange('');
  };

  // Extract initials for fallback
  const getInitials = (): string => {
    const name = avatarField?.defaultName || avatarField?.label || 'User';
    return name
      .split(' ')
      .map((word: string) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (readonly) {
    return (
      <Avatar className="w-16 h-16">
        {value && <AvatarImage src={value} alt={avatarField?.label} />}
        <AvatarFallback>{getInitials()}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Avatar className="w-16 h-16">
          {value && <AvatarImage src={value} alt={avatarField?.label} />}
          <AvatarFallback>{getInitials()}</AvatarFallback>
        </Avatar>
        {!readonly && isHovered && value && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={readonly}
        >
          <Upload className="w-4 h-4 mr-2" />
          {value ? 'Change' : 'Upload'} Avatar
        </Button>
        <p className="text-xs text-muted-foreground">
          PNG, JPG up to 5MB
        </p>
      </div>
    </div>
  );
}
