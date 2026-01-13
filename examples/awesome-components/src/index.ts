import { AwesomeTable } from './components/AwesomeTable';
import { AwesomeForm } from './components/AwesomeForm';

// Export all components
export { AwesomeTable, AwesomeForm };

// Export types
export type {
  AwesomeTableProps,
  AwesomeFormProps
} from './types';

// Version and metadata
export const VERSION = '1.0.0';
export const OBJECTQL_VERSION = '^1.7.0';

// Default export for UMD
export default {
  AwesomeTable,
  AwesomeForm,
  VERSION,
  OBJECTQL_VERSION
};
