# @object-ui/fields

The standard field library and registry for Object UI.

## Features

- 📚 **Standard Fields** - Implementation of all ObjectStack protocol fields (Text, Number, Date, Lookup, etc.)
- 🔌 **Plugin System** - `FieldRegistry` allows registering custom renderers or overriding standard ones.
- 🛠 **Helpers** - Utilities for schema mapping, validation, and expression evaluation.

## Installation

```bash
npm install @object-ui/fields
```

## Field Registry

The Field Registry is the core mechanism that allows decoupling view components from specific field implementations.

### Registering a Custom Field

You can override standard fields or add new ones:

```tsx
import { registerFieldRenderer } from '@object-ui/fields';
import { MyCustomColorPicker } from './MyCustomColorPicker';

// Register a new 'color' field type
registerFieldRenderer('color', MyCustomColorPicker);
```

### Using Standard Fields

View components use `getCellRenderer` to resolve the correct component for a field type.

```tsx
import { getCellRenderer } from '@object-ui/fields';

const MyGridCell = ({ field, value }) => {
  const Renderer = getCellRenderer(field.type);
  return <Renderer field={field} value={value} />;
};
```

## Standard Field Types

Supported types out of the box:

- **Basic**: `text`, `textarea`, `number`, `boolean`
- **Format**: `currency`, `percent`
- **Date**: `date`, `datetime`, `time`
- **Selection**: `select`, `lookup`, `master_detail`
- **Contact**: `email`, `phone`, `url`
- **Media**: `file`, `image`
- **System**: `formula`, `summary`, `auto_number`

### Rendering form field widgets outside the form

The full widget surface is exported for consumers that render field widgets
outside a record form (ADR-0059):

- `FORM_FIELD_TYPES` — the frozen list of every type the form can render.
- `resolveFormWidgetType(type)` — resolves any field-type spelling to its
  widget key (spec aliases like `toggle`/`json`/`secret` included; unknown
  types fall back to `text`, mirroring the form).
- `getLazyFieldWidget(type)` — the widget wrapped in `React.lazy` (cached per
  type; render inside `<Suspense>`), sharing the same loaders `registerField`
  uses so nothing is bundled eagerly.

The app-shell `ActionParamDialog` uses these to render declared action params
through the exact same widgets as the object form — with a drift test pinning
param support ⊇ form support.

### File uploads in line-item grids

`GridField` (the master-detail line-items grid) supports `type: 'file'` columns:
the cell renders a compact upload button plus removable file chips (thumbnails
for images) instead of degrading to a text input, so users can attach a receipt
or photo per row without opening the row form (objectui#2360). Columns accept
`accept?: string[]` and `multiple?: boolean`; uploads run through the same
`UploadProvider` pipeline as the full-size `FileField` (the compact control is
exported as `FileCell`). Auto-derived subform columns map `file`/`image`/
`avatar` fields to file columns instead of dropping them.

### Cascading & role-gated select options

`select` options support a per-option `visibleWhen` CEL predicate (offered only
when TRUE, evaluated against the live record + `current_user`) and a field-level
`dependsOn`. Together they drive dependent selects (country → province → city)
and role-gated options with no bespoke matrix — the same primitives dependent
lookups use. While a `dependsOn` parent is empty the control is gated; a parent
change re-filters the list and clears a now-invalid value. Client-side hiding is
UX only — gate authorization-sensitive values on the server too. See
[`content/docs/fields/select.mdx`](../../content/docs/fields/select.mdx).

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/fields)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/fields)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
