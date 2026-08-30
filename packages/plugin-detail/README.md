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

### Two ways to reach a data source

`detail-view` needs a data source to load a record, and there are two ways to
give it one. They are equivalent, and an explicit prop wins when both are
present:

```tsx
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

// 1. Injected by an ancestor — the pattern the rest of the family uses, and the
//    one to reach for when a page renders several data-bound blocks.
<SchemaRendererProvider dataSource={dataSource}>
  <SchemaRenderer schema={{ type: 'detail-view', objectName: 'account', resourceId: '42' }} />
</SchemaRendererProvider>

// 2. Handed to one placement — what `<DetailView dataSource={…} />` has always
//    taken, and what the examples below use.
<DetailView schema={{ type: 'detail-view', objectName: 'account', resourceId: '42' }} dataSource={dataSource} />
```

Route 1 is new as of objectui#5378: this block used to read the adapter from its
prop ONLY, while its siblings `object-grid` and `object-form` read it from
context only, so a page could satisfy one of them or the other and never both.
Nothing that worked before changed — route 2 is unaffected — and a block that
resolves neither now renders a **No data source resolved** panel naming itself
and the object it was about to read, instead of an empty shell.

Note the record id is `resourceId` here. `object-form`'s is `recordId`; the two
blocks do not share that key.

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

Related lists are **paged by default**: the `record:related_list` renderer
applies the spec default `limit` of **5** when the node doesn't declare one
(`@objectstack/spec` `RecordRelatedListProps.limit`, "Number of records to
display initially"), so a child collection of any size renders as pages with
Previous/Next controls instead of one flat dump. On the auto-fetch path the
component asks the server for **one page at a time** (`$top`/`$skip`) and
reads the collection size from `QueryResult.total` (falling back to a
`hasMore` estimate), so large child tables never ship wholesale to the
browser. A user column sort becomes a server `$orderby` (ordering stays
global across pages), and the node's `sort` prop seeds the initial order.
Because that `$orderby` names a flat field, two kinds of column cannot survive
the trip. A **relational column** (`lookup` / `master_detail` / `user` / `tree`)
would order the collection by the stored foreign-key id while its cells show
related-record names (`objectui#3096`); a **`formula` column** has no
materialized column to order by at all — silently unordered rows under a `200`
before `objectstack#6994`, a `400 INVALID_SORT` after it (`objectui#3950`). So on
the windowed path neither offers a sort affordance, at either of this card's two
sort entry points: the embedded table's column headers, and the button row a
`list` card keeps because it has no headers. In client mode the sort key is the
value the cell shows — the label this list already resolved, the formula result
the server hydrated — so the affordance stays and orders by that.
Passing `data` directly keeps the historical client-side slicing, and typing
in the opt-in filter box temporarily falls back to the full-fetch client
pipeline (the contains-filter sweeps every field, which no generic server
filter can express).

The node's `filter` (spec `RecordRelatedListProps.filter`, "additional filter
criteria") narrows the list beyond the parent relationship: it is
**AND-combined** with `{ [relationshipField]: parentId }`, never substituted for
it, so a related list stays scoped to the record it appears on and an additional
criterion can only ever narrow that set. Authors write it in the spec's own
vocabulary (`[{ field, operator, value }]`); a `dataSource` binding's composed
filter (component AND saved view AND binding) lands on the same key. Both are
lowered to ObjectQL through the repo's single filter sink, so no second dialect
appears. On the legacy raw-URL fallback path (no `dataSource` adapter, where the
query language is `filter[<field>]=<value>` and cannot carry an operator) a
declared filter is refused with a console explanation rather than dropped —
answering with more rows than the metadata asked for is the failure this key's
wiring exists to remove.

The **Add** affordance renders only where every link in its chain is available:
a spec-valid `add.picker.object` *and* a `dataSource`. The picker dialog and the
add callback both required the adapter already, so without it the button used to
render and do nothing at all when clicked — visible in hosts that supply no
`RecordContext` (Studio designer previews, context-free embeds).

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
- **Approval band & recall** (#6464): the band reads `approvalPending` /
  `approvalProgress` from the same provider, and offers its **Recall** button
  only where the click can succeed. Recall is the submitter's lever — the
  server authorizes it on submitter identity and refuses everyone else — so
  hosts that resolve approvals pass `InlineEditProvider.approvalIsSubmitter`.
  It is tri-state on purpose: `false` withdraws the button from a resolved
  non-submitter, `true` keeps it, and **omitting it leaves the button exactly
  as it was** — a host that resolves no approval identity is unchanged rather
  than losing its submitter's only unlock lever. It gates the affordance only;
  the recall endpoint remains the authority on who may actually recall.

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
