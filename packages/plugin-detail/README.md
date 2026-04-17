# @object-ui/plugin-detail

DetailView plugin for ObjectUI - A comprehensive detail page component with field grouping, tabs, related lists, and action buttons.

## Features

- **Field Grouping/Sections**: Organize fields into logical sections with titles
- **Collapsible Sections**: Make sections collapsible to save space
- **Tab Navigation**: Organize content into tabs for better UX
- **Related Lists**: Display related records (e.g., contacts for an account)
- **Action Buttons**: Edit, Delete, and custom action buttons
- **Readonly/Edit Mode**: Toggle between view and edit modes
- **Back Navigation**: Built-in back button with customizable behavior
- **Loading States**: Skeleton loading for async data
- **Custom Headers/Footers**: Flexible customization options

## Installation

```bash
pnpm add @object-ui/plugin-detail
```

## Usage

### Basic Example

```tsx
import { DetailView } from '@object-ui/plugin-detail';

function ContactDetail() {
  return (
    <DetailView
      schema={{
        type: 'detail-view',
        title: 'Contact Details',
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          company: 'Acme Corp',
        },
        fields: [
          { name: 'name', label: 'Full Name' },
          { name: 'email', label: 'Email' },
          { name: 'phone', label: 'Phone' },
          { name: 'company', label: 'Company' },
        ],
        showBack: true,
        showEdit: true,
        showDelete: true,
      }}
    />
  );
}
```

### With Sections

```tsx
<DetailView
  schema={{
    type: 'detail-view',
    title: 'Account Details',
    sections: [
      {
        title: 'Basic Information',
        icon: '📋',
        fields: [
          { name: 'name', label: 'Account Name' },
          { name: 'industry', label: 'Industry' },
          { name: 'website', label: 'Website' },
        ],
        columns: 2,
      },
      {
        title: 'Address',
        collapsible: true,
        defaultCollapsed: false,
        fields: [
          { name: 'street', label: 'Street' },
          { name: 'city', label: 'City' },
          { name: 'state', label: 'State' },
          { name: 'zipcode', label: 'Zip Code' },
        ],
        columns: 2,
      },
    ],
    data: accountData,
  }}
/>
```

### With Tabs and Related Lists

```tsx
<DetailView
  schema={{
    type: 'detail-view',
    title: 'Account: Acme Corp',
    objectName: 'accounts',
    resourceId: '12345',
    fields: [
      { name: 'name', label: 'Account Name' },
      { name: 'industry', label: 'Industry' },
    ],
    tabs: [
      {
        key: 'details',
        label: 'Details',
        icon: '📄',
        content: {
          type: 'detail-section',
          fields: [
            { name: 'description', label: 'Description' },
            { name: 'employees', label: 'Employee Count' },
          ],
        },
      },
      {
        key: 'activity',
        label: 'Activity',
        badge: '12',
        content: {
          type: 'activity-timeline',
          data: activityData,
        },
      },
    ],
    related: [
      {
        title: 'Contacts',
        type: 'table',
        api: '/api/accounts/12345/contacts',
        columns: ['name', 'email', 'phone', 'title'],
      },
      {
        title: 'Opportunities',
        type: 'table',
        api: '/api/accounts/12345/opportunities',
        columns: ['name', 'amount', 'stage', 'close_date'],
      },
    ],
    showEdit: true,
    showDelete: true,
  }}
  onEdit={() => navigate('/accounts/12345/edit')}
  onDelete={() => deleteAccount('12345')}
  onBack={() => navigate('/accounts')}
/>
```

## Schema

The DetailView component accepts a `DetailViewSchema`:

```typescript
interface DetailViewSchema {
  type: 'detail-view';
  title?: string;
  objectName?: string;
  resourceId?: string | number;
  api?: string;
  data?: any;
  sections?: DetailViewSection[];
  fields?: DetailViewField[];
  tabs?: DetailViewTab[];
  related?: RelatedList[];
  actions?: ActionSchema[];
  showBack?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  backUrl?: string;
  editUrl?: string;
  deleteConfirmation?: string;
  loading?: boolean;
  header?: SchemaNode;
  footer?: SchemaNode;
}
```

## Components

### DetailSection

Renders a group of fields with optional collapsing.

### DetailTabs

Tab navigation for organizing content into different views.

### RelatedList

Displays related records in list, grid, or table format.

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-detail)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-detail)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
