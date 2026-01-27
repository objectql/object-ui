# @object-ui/layout

Layout components for Object UI - provides application shell components for building structured layouts with React Router integration.

## Features

- **Application Shell** - Complete app layout structure with header, sidebar, and content areas
- **Page Components** - Standard page layouts with headers and content sections
- **Navigation** - Sidebar navigation with React Router integration
- **Responsive** - Mobile-friendly layouts with collapsible sidebars
- **Tailwind Native** - Built with Tailwind CSS for easy customization

## Installation

```bash
pnpm add @object-ui/layout
```

**Peer Dependencies:**
- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `react-router-dom` >= 6.0.0

## Components

### AppShell

Complete application shell with header, sidebar, and main content area.

```typescript
import { AppShell } from '@object-ui/layout';

<AppShell
  header={<div>Header Content</div>}
  sidebar={<div>Sidebar Content</div>}
>
  <div>Main Content</div>
</AppShell>
```

### Page

Standard page layout with optional header section.

```typescript
import { Page, PageHeader } from '@object-ui/layout';

<Page>
  <PageHeader title="Dashboard" description="View your metrics" />
  <div>Page Content</div>
</Page>
```

### SidebarNav

Navigation sidebar component with React Router integration.

```typescript
import { SidebarNav } from '@object-ui/layout';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: 'home' },
  { label: 'Users', path: '/users', icon: 'users' },
  { label: 'Settings', path: '/settings', icon: 'settings' }
];

<SidebarNav items={navItems} />
```

## Usage with React Router

The layout components are designed to work seamlessly with React Router:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell, SidebarNav } from '@object-ui/layout';

function App() {
  return (
    <BrowserRouter>
      <AppShell
        header={<div className="p-4">My App</div>}
        sidebar={
          <SidebarNav
            items={[
              { label: 'Dashboard', path: '/', icon: 'home' },
              { label: 'Users', path: '/users', icon: 'users' }
            ]}
          />
        }
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
```

## Customization

All components accept `className` prop for Tailwind customization:

```typescript
<AppShell
  className="bg-gray-50"
  headerClassName="border-b"
  sidebarClassName="bg-white shadow-lg"
>
  {children}
</AppShell>
```

## API Reference

For detailed API documentation, visit the [Object UI Documentation](https://www.objectui.org/docs/layout).

## License

MIT
