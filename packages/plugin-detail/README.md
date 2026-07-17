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

The `record:related_list` renderer is automatically gated on the current
user's object-level `read` permission for the child object: when the
permission system (`@object-ui/permissions`) is loaded and denies read,
the whole section renders nothing — no header, no empty grid, no "New"
button that would be rejected server-side. With no `PermissionProvider`
mounted (Studio designer, standalone embeds) the gate stays open.

### InlineEditSaveBar & InlineFieldInput

The record-level inline-edit session (#2407): double-clicking a field (or its
hover pencil) in the highlights strip or details body stages edits into ONE
shared draft (`InlineEditProvider` from `@object-ui/react`), committed by
`<InlineEditSaveBar>` as a single atomic OCC-guarded update. Polish shipped in
#2572:

- **Editors**: `InlineFieldInput` routes every field type to the same widget
  the form uses — including `number` / `currency` / `percent` (numeric
  keyboard, `min`/`max`/`step` from metadata, fraction↔percent conversion) and
  reference pickers, which receive `$expand`-ed record objects as-is so the
  display name renders without a hydration re-fetch.
- **Keyboard shortcuts**: while the session is active, **Esc** cancels (open
  popovers/dialogs keep owning Escape for "close") and **Cmd/Ctrl+Enter**
  saves; both respect the in-flight `saving` and `locked` states.
- **Approval lock**: hosts pass `locked` / `lockedHint` to the save bar and
  gate `InlineEditProvider.canEdit` when the record is approval-locked, so a
  locked record hides its edit affordances instead of rejecting at Save.

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

## Reference Rail decision matrix

The "Reference Rail" is the right-hand column on the record detail page
that surfaces summary cards for related collections (similar to
Salesforce's **Related** rail and HubSpot's **About this record**
sidebar). It is rendered by the `record:reference_rail` component and
emits automatically when:

1. The page is generated by the synth (`buildDefaultPageSchema`) — i.e.
   no explicit `Page` overrides the object's detail view.
2. The objectDef declares **≥2 related collections** (lookup/master-detail
   inbound fields).
3. The viewport is **≥ xl (1280 px)** — below that the rail collapses and
   the **Related** tab keeps full coverage.
4. The objectDef does **not** opt out via `detail.hideReferenceRail`.

When the rail emits, the synth automatically suppresses the **Related**
tab so the same information isn't shown twice.

### Per-object opt-out

Add a `detail` block to the objectDef:

```ts
ObjectSchema.create({
  name: 'product',
  // …
  detail: {
    hideReferenceRail: true,  // hide the rail; restore the Related tab
    hideRelatedTab: true,     // (optional) force-hide the Related tab too
  },
});
```

### CRM business-domain guidance

| Object type        | Rail   | Why                                                          |
|--------------------|--------|--------------------------------------------------------------|
| Hub objects        | **on** | Account / Opportunity / Contact / Case — users browse laterally to quotes, contacts, activities |
| Transactional      | **on** | Quote / Contract / Order — show line-items + related parties at a glance |
| Campaign / Event   | **on** | Members, responses, child campaigns                         |
| Catalog            | **off**| Product / Price Book — users edit attributes; lateral relationships are noise |
| Atomic action      | **off**| Task / Note — focused single-column edit beats a related-list rail |
| Lead (unconverted) | **off**| Pre-conversion records have no children — keep it focused on the form |

### Adding the rail to a custom `Page`

For explicit (non-synth) Pages, add an `aside` region after the `main`
region:

```ts
{
  name: 'aside',
  width: 'small',
  className: 'hidden xl:flex flex-col gap-4',
  components: [
    {
      type: 'record:reference_rail',
      id: 'opp_reference_rail',
      properties: {
        entries: [
          { objectName: 'quote',                 relationshipField: 'opportunity', title: 'Quotes',     limit: 3 },
          { objectName: 'opportunity_line_item', relationshipField: 'opportunity', title: 'Products',   limit: 3 },
          { objectName: 'task',                  relationshipField: 'related_to_opportunity', title: 'Open Tasks', limit: 3 },
        ],
      },
    },
  ],
},
```

The renderer reads `entries` from both `schema.entries` and
`schema.properties.entries` so either spec-style or flat authoring works.

## License

MIT — see [LICENSE](./LICENSE).
