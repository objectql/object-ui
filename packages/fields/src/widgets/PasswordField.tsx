import React, { useState } from 'react';
import { Input } from '@object-ui/components';
import { Button } from '@object-ui/components';
import { Eye, EyeOff } from 'lucide-react';
import { FieldWidgetProps } from './types';

export function PasswordField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<string>) {
  const [showPassword, setShowPassword] = useState(false);
  const config = field || (props as any).schema;

  if (readonly) {
    return <span className="text-sm">••••••••</span>;
  }

  return (
    <div className="relative">
      <Input
        type={showPassword ? 'text' : 'password'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={config?.placeholder}
        disabled={readonly}
        className={`pr-10 ${props.className || ''}`}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="size-4 text-gray-500" />
        ) : (
          <Eye className="size-4 text-gray-500" />
        )}
      </Button>
    </div>
  );
}
