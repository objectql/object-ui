import { FieldMetadata } from '@object-ui/types';

export type FieldWidgetProps<T = any> = {
  value: T;
  onChange: (val: T) => void;
  // Use a looser type for field to avoid complex circular dependencies for now
  field: FieldMetadata; 
  readonly?: boolean;
  disabled?: boolean;
  className?: string;
  errorMessage?: string;
  /**
   * Upload widgets (`file`/`image`) fire this when their in-progress state
   * flips, so a host can block submit until a presigned upload settles. Other
   * widgets ignore it.
   */
  onUploadingChange?: (uploading: boolean) => void;
  [key: string]: any;
}
