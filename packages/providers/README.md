# @object-ui/providers

**Reusable Context Providers for ObjectUI**

A collection of framework-agnostic React context providers that can be used by third-party systems without console dependencies.

## Installation

```bash
pnpm add @object-ui/providers
```

## Providers

### DataSourceProvider

Generic data source context that decouples ObjectUI from ObjectStack.

```tsx
import { DataSourceProvider } from '@object-ui/providers';

<DataSourceProvider dataSource={myCustomDataSource}>
  <App />
</DataSourceProvider>
```

### MetadataProvider

Schema/metadata management for objects, fields, and views.

```tsx
import { MetadataProvider } from '@object-ui/providers';

<MetadataProvider metadata={myMetadata}>
  <App />
</MetadataProvider>
```

### ThemeProvider

Theme management with system theme detection.

```tsx
import { ThemeProvider } from '@object-ui/providers';

<ThemeProvider defaultTheme="system" storageKey="my-app-theme">
  <App />
</ThemeProvider>
```

## Usage Example

```tsx
import { DataSourceProvider, MetadataProvider, ThemeProvider } from '@object-ui/providers';

function App() {
  return (
    <ThemeProvider>
      <DataSourceProvider dataSource={myDataSource}>
        <MetadataProvider metadata={myMetadata}>
          {/* Your app components */}
        </MetadataProvider>
      </DataSourceProvider>
    </ThemeProvider>
  );
}
```

## License

MIT
