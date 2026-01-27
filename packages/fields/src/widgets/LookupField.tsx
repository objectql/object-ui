import React, { useState } from 'react';
import { 
  Button, 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Badge
} from '@object-ui/components';
import { Search, X } from 'lucide-react';
import { FieldWidgetProps } from './types';

interface LookupOption {
  value: string | number;
  label: string;
  [key: string]: any;
}

/**
 * Lookup field for selecting related records
 * Supports single and multi-select with search
 */
export function LookupField({ value, onChange, field, readonly }: FieldWidgetProps<any>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const lookupField = field as any;
  const options: LookupOption[] = lookupField.options || [];
  const multiple = lookupField.multiple || false;
  const displayField = lookupField.display_field || 'label';

  // Filter options based on search
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected option(s)
  const selectedOptions = multiple
    ? (Array.isArray(value) ? value : []).map(v => 
        options.find(opt => opt.value === v)
      ).filter(Boolean)
    : value ? [options.find(opt => opt.value === value)].filter(Boolean) : [];

  const handleSelect = (option: LookupOption) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const isSelected = currentValues.includes(option.value);
      
      if (isSelected) {
        onChange(currentValues.filter(v => v !== option.value));
      } else {
        onChange([...currentValues, option.value]);
      }
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  };

  const handleRemove = (optionValue: any) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      onChange(currentValues.filter(v => v !== optionValue));
    } else {
      onChange(null);
    }
  };

  if (readonly) {
    if (!selectedOptions.length) {
      return <span className="text-sm">-</span>;
    }

    if (multiple) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt, idx) => (
            <Badge key={idx} variant="outline">
              {opt?.[displayField] || opt?.label}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <span className="text-sm">
        {selectedOptions[0]?.[displayField] || selectedOptions[0]?.label}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selected values display */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt, idx) => (
            <Badge 
              key={idx} 
              variant="outline"
              className="gap-1"
            >
              {opt?.[displayField] || opt?.label}
              <button
                onClick={() => handleRemove(opt?.value)}
                className="ml-1 hover:text-destructive"
                type="button"
                aria-label={`Remove ${opt?.[displayField] || opt?.label}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Lookup dialog trigger */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-start text-left font-normal"
            type="button"
          >
            <Search className="mr-2 size-4" />
            {selectedOptions.length === 0 
              ? field.placeholder || 'Select...'
              : multiple ? `${selectedOptions.length} selected` : 'Change selection'
            }
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {field.label || 'Select'} {multiple && '(multiple)'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Search input */}
          <div className="space-y-4">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />

            {/* Options list */}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredOptions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No options found
                </p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = multiple
                    ? (Array.isArray(value) ? value : []).includes(option.value)
                    : value === option.value;

                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSelect(option)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 flex items-center justify-between ${
                        isSelected ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                      type="button"
                    >
                      <span>{option.label}</span>
                      {isSelected && (
                        <Badge variant="default" className="ml-2">Selected</Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
