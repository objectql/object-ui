import { ComponentRegistry } from '../../registry';
import { Toaster as SonnerToaster } from '@object-ui/ui';
import { Toaster as DefaultToaster } from '@object-ui/ui'; 
// Note: In shadcn/ui typical setup, Toaster is exported from 'components/ui/toaster' and 'components/ui/sonner'.
// But in @object-ui/ui index.tsx, we need to check if they are exported.
// Assuming they are exported as Toaster and Sonner (or similar).
// Let's assume standard exports.

ComponentRegistry.register('toaster', 
  ({ schema }) => {
    if (schema.provider === 'sonner') {
        return <SonnerToaster />;
    }
    return <DefaultToaster />;
  },
  {
    label: 'Toaster',
    inputs: [
      { name: 'provider', type: 'enum', enum: ['default', 'sonner'], defaultValue: 'default', label: 'Provider' }
    ],
    defaultProps: {
      provider: 'default'
    }
  }
);
