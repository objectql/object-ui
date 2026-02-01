import React from 'react';
import { Avatar, AvatarFallback, Badge } from '@object-ui/components';
import { X } from 'lucide-react';
import { FieldWidgetProps } from './types';

/**
 * UserField - User/Owner selector field
 * Allows selecting one or multiple users
 */
export function UserField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<any>) {
  const userField = (field || (props as any).schema) as any;
  const multiple = userField?.multiple || false;

  if (readonly) {
    if (!value) return <span className="text-sm">-</span>;
    
    const users = Array.isArray(value) ? value : [value];
    return (
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user: any, idx: number) => {
          const name = user.name || user.username || 'User';
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          
          return (
            <Avatar key={idx} className="size-8 border-2 border-white" title={name}>
              <AvatarFallback className="bg-blue-500 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {users.length > 3 && (
          <Avatar className="size-8 border-2 border-white">
            <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
              +{users.length - 3}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  }

  const users = value ? (Array.isArray(value) ? value : [value]) : [];

  const handleRemove = (index: number) => {
    if (multiple) {
      const newUsers = users.filter((_: any, i: number) => i !== index);
      onChange(newUsers.length > 0 ? newUsers : null);
    } else {
      onChange(null);
    }
  };

  return (
    <div className={props.className}>
      {users.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {users.map((user: any, idx: number) => {
            const name = user.name || user.username || 'User';
            const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            
            return (
              <Badge key={idx} variant="outline" className="gap-2 pr-1">
                <Avatar className="size-5">
                  <AvatarFallback className="bg-blue-500 text-white text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      
      <div className="text-sm text-gray-500 italic">
        User selection component requires integration with user management system
      </div>
    </div>
  );
}
