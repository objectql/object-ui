import { FieldMetadata } from '@object-ui/types';

export type FieldWidgetProps<T = any> = {
  value: T;
  onChange: (val: T) => void;
  // Use a looser type for field to avoid complex circular dependencies for now
  field: FieldMetadata; 
  readonly?: boolean;
  className?: string;
  errorMessage?: string;
}
