# Component Migration Guide

This guide helps you migrate from deprecated custom components to the standard Shadcn UI patterns.

## Form Components Migration

### Overview

ObjectUI previously included custom field components (`field.tsx`, `input-group.tsx`) that are now deprecated in favor of Shadcn's standard `form.tsx` components with `react-hook-form` integration.

### Why Migrate?

- **Standard Pattern**: Aligns with Shadcn UI conventions used across the ecosystem
- **Better Integration**: Full `react-hook-form` support with validation
- **Type Safety**: Better TypeScript inference and type safety
- **Community Support**: Standard patterns have better documentation and community examples

### Comparison: Custom Field vs Shadcn Form

#### Custom Field System (Deprecated)

```tsx
import { Field, FieldLabel, FieldError, FieldDescription } from '@object-ui/components';

<Field>
  <FieldLabel>Email</FieldLabel>
  <FieldDescription>Enter your email address</FieldDescription>
  <Input type="email" />
  <FieldError errors={errors.email} />
</Field>
```

**Features:**
- Simple wrapper components
- Manual error handling
- No built-in form state management
- Custom validation required

#### Shadcn Form System (Recommended)

```tsx
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@object-ui/components';
import { useForm } from 'react-hook-form';

const form = useForm();

<Form {...form}>
  <FormField
    control={form.control}
    name="email"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input type="email" {...field} />
        </FormControl>
        <FormDescription>Enter your email address</FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

**Features:**
- Full `react-hook-form` integration
- Automatic validation
- Built-in error handling
- Accessibility features (aria-* attributes)
- Type-safe form values

### Migration Steps

1. **Install react-hook-form** (if not already installed)
   ```bash
   pnpm add react-hook-form
   ```

2. **Replace component imports**
   ```tsx
   // Before
   import { Field, FieldLabel, FieldError, FieldDescription } from '@object-ui/components';
   
   // After
   import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@object-ui/components';
   import { useForm } from 'react-hook-form';
   ```

3. **Update component structure**
   - Replace `Field` with `FormField` + `FormItem`
   - Replace `FieldLabel` with `FormLabel`
   - Replace `FieldError` with `FormMessage`
   - Replace `FieldDescription` with `FormDescription`
   - Wrap inputs with `FormControl`

4. **Add form setup**
   ```tsx
   const form = useForm({
     defaultValues: {
       email: '',
       // ... other fields
     }
   });
   ```

### InputGroup Migration

The `InputGroup` component is deprecated. For grouped inputs with addons:

#### Before (Deprecated)
```tsx
import { InputGroup, InputGroupAddon, InputGroupInput } from '@object-ui/components';

<InputGroup>
  <InputGroupAddon align="inline-start">$</InputGroupAddon>
  <InputGroupInput placeholder="0.00" />
  <InputGroupAddon align="inline-end">USD</InputGroupAddon>
</InputGroup>
```

#### After (Recommended)
```tsx
import { Input } from '@object-ui/components';

<div className="flex items-center rounded-md border border-input shadow-sm">
  <span className="flex items-center pl-3 text-sm text-muted-foreground">$</span>
  <Input 
    placeholder="0.00" 
    className="flex-1 border-0 shadow-none focus-visible:ring-0"
  />
  <span className="flex items-center pr-3 text-sm text-muted-foreground">USD</span>
</div>
```

**Benefits:**
- More flexible styling with Tailwind utilities
- No custom abstraction layer
- Easier to customize and maintain

## Toast System Migration

### Overview

The legacy Radix toast system (`toast.tsx`, `toaster.tsx`, `use-toast.ts`) is deprecated in favor of Sonner, which is Shadcn's recommended toast solution.

### Why Migrate to Sonner?

- **Cleaner API**: Simpler, more intuitive API
- **Better UX**: Smoother animations and better mobile support
- **Modern**: Built for modern React with better performance
- **Standard**: Recommended by Shadcn UI

### Comparison: Legacy Toast vs Sonner

#### Legacy Toast (Deprecated)

```tsx
import { useToast } from '@object-ui/components';
import { ToastNotifier } from '@object-ui/components';

// In component
const { toast } = useToast();

toast({
  title: "Success",
  description: "Your changes have been saved.",
  variant: "default"
});

// In app root
<ToastNotifier />
```

#### Sonner (Recommended)

```tsx
import { toast } from 'sonner';
import { Toaster } from '@object-ui/components';

// In component
toast('Your changes have been saved.');
toast.success('Success message');
toast.error('Error message');
toast.warning('Warning message');
toast.info('Info message');

// With description
toast('Event created', {
  description: 'Your event has been scheduled successfully.'
});

// In app root
<Toaster />
```

### Migration Steps

1. **Update imports**
   ```tsx
   // Before
   import { useToast, ToastNotifier } from '@object-ui/components';
   
   // After
   import { toast } from 'sonner';
   import { Toaster } from '@object-ui/components'; // Now exports Sonner Toaster
   ```

2. **Replace hook calls with function calls**
   ```tsx
   // Before
   const { toast } = useToast();
   toast({ title: "Hello", description: "World" });
   
   // After
   toast('Hello', { description: 'World' });
   ```

3. **Update variant usage**
   ```tsx
   // Before
   toast({ title: "Success", variant: "default" });
   toast({ title: "Error", variant: "destructive" });
   
   // After
   toast.success('Success');
   toast.error('Error');
   toast.warning('Warning');
   toast.info('Info');
   ```

4. **Update Toaster component**
   ```tsx
   // Before
   import { ToastNotifier } from '@object-ui/components';
   <ToastNotifier />
   
   // After
   import { Toaster } from '@object-ui/components';
   <Toaster />
   ```

### Advanced Sonner Features

```tsx
// With action button
toast('Event created', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo'),
  },
});

// With duration
toast('Message', { duration: 5000 });

// With promise
toast.promise(fetchData(), {
  loading: 'Loading...',
  success: 'Data loaded',
  error: 'Failed to load',
});

// Dismiss all toasts
toast.dismiss();
```

## Summary

| Component | Status | Replacement |
|-----------|--------|-------------|
| `Field`, `FieldLabel`, `FieldError`, etc. | Deprecated | `FormField`, `FormItem`, `FormLabel`, `FormMessage`, etc. |
| `InputGroup` | Deprecated | Tailwind flex utilities + Shadcn primitives |
| `toast.tsx`, `toaster.tsx` | Deprecated | `sonner.tsx` (Sonner) |
| `use-toast.ts` | Deprecated | `toast` from 'sonner' |

## Need Help?

- Shadcn Form Documentation: https://ui.shadcn.com/docs/components/form
- Shadcn Sonner Documentation: https://ui.shadcn.com/docs/components/sonner
- React Hook Form: https://react-hook-form.com/
- Sonner: https://sonner.emilkowal.ski/

## Backward Compatibility

All deprecated components remain functional for backward compatibility. However, they are not recommended for new implementations and may be removed in a future major version.
