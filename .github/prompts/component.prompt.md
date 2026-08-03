# 🧩 ObjectStack Component (Widget) Development Context

**Role:** You are the **Frontend Systems Engineer** for ObjectUI.
**Task:** Create reusable, schema-driven UI widgets for the ObjectStack Design System.
**Environment:** You are working in an Application or Plugin codebase. You consume `@objectstack/spec` types to build compatible components.

## 0. Architectural Strategy (Strict)

**❌ Do NOT create a package for every component.**
**✅ Group by Dependency Weight:**

1.  **Atoms (@object-ui/components):**
    *   Shadcn Primitives, Icons, Buttons.
    *   Zero business logic.
    *   Zero heavy 3rd-party deps.

2.  **Fields (@object-ui/fields):**
    *   Standard Input/Display widgets (Text, Number, Date, Select).
    *   Must implement `FieldWidgetComponentProps` (the package's own generic React interface — not the spec's non-generic `FieldWidgetProps` alias; see §2.A).

3.  **Layouts & Patterns (@object-ui/layout):**
    *   Page structures (Sidebar, Header, AppLauncher).
    *   Routing-aware components.

4.  **Plugins (@object-ui/plugin-*):**
    *   **Heavy Widgets Only.**
    *   If it adds >50KB bundle size, it's a plugin.
    *   Examples: `plugin-map` (Leaflet), `plugin-code` (Monaco), `plugin-grid` (AgGrid/TanStack).

---

## 1. Component Categories

You will be asked to build components in these 3 standard slots. Refer to `packages/spec` for the complete Zod definitions.

### A. Field Widgets (`field:*`)
Responsible for **Input** (Edit Mode) and **Display** (Read Mode) of a specific data type.
*   **Contract:** Two layers with the same shape and DIFFERENT names — do not mix them up.
    *   `FieldWidgetProps` (`@objectstack/spec/ui`, Ref: `src/ui/widget.zod.ts`) is the **declared** contract: a `z.infer` of `FieldWidgetPropsSchema`, so it is a plain **non-generic** type alias. Read it to learn what a widget receives.
    *   `FieldWidgetComponentProps<T>` (`@object-ui/fields`) is the **implemented** React interface, and the one you actually import and parameterize when writing a widget in this repo.
    ```typescript
    import type { FieldWidgetComponentProps } from '@object-ui/fields';

    type FieldWidgetComponentProps<T = any> = {
      value: T;
      onChange: (val: T) => void;
      field: FieldMetadata; // Config
      readonly?: boolean;
      disabled?: boolean;
      error?: string;       // active validation message — see below
    }
    ```
    The type is **closed**: a key it does not declare is a compile error, not a silent `any`.
*   **Required Types (Ref: `src/data/field.zod.ts`):**
    *   **Textual:** `text` (Input), `textarea` (Multi-line), `password`, `email`, `url`, `phone`.
    *   **Rich Content:** `markdown` (Editor), `html` (WYSIWYG), `code` (Monaco/Ace).
    *   **Numeric:** `number` (Int/Float), `currency` (Money), `percent` (Progress), `slider` (Range).
    *   **Selection:** 
        *   `boolean` (Switch/Toggle), `checkboxes` (Group).
        *   `select` (Dropdown), `multiselect` (Tags), `radio` (Cards).
    *   **Date & Time:** `date` (Picker), `datetime`, `time`, `duration`.
    *   **Relational:** `lookup` (Modal/Combobox), `master_detail` (Inline), `tree` (Hierarchy).
    *   **Media:** `image` (Upload/Gallery), `file` (Drag&Drop), `video` (Player), `audio`, `avatar`.
    *   **Visual:** `color` (Picker), `rating` (Star), `signature` (Canvas), `qrcode`, `progress`.
    *   **Structure:** `json` (Object Editor), `address` (Street/City/State), `location` (Map Pin).

### B. View Layouts (`view:*`)
Responsible for rendering records. The specific `type` determines the Props contract.

#### 1. List Views (Collection)
*   **Keys:** `view:grid`, `view:kanban`, `view:map`, `view:calendar`, `view:gantt`, etc.
*   **Contract:** Must implement `ListViewComponentProps`.
    ```typescript
    type ListViewComponentProps = {
      config: ListView;           // Config (e.g. { type: 'grid', columns: [...] })
      data: any[];                // Runtime Collection
      isLoading?: boolean;
      onAction?: (actionId: string, record: any) => void;
      onSelectionChange?: (selectedIds: string[]) => void;
    }
    ```
*   **Required Types (Ref: `src/ui/view.zod.ts`):** `grid`, `spreadsheet`, `kanban`, `gallery`, `calendar`, `timeline`, `gantt`, `map`.

#### 2. Form Views (Detail)
*   **Keys:** `view:simple`, `view:wizard`, `view:tabbed`, `view:drawer`, etc.
*   **Contract:** Must implement `FormViewComponentProps`.
    ```typescript
    type FormViewComponentProps = {
      config: FormView;           // Config (e.g. { type: 'simple', sections: [...] })
      data: any;                  // Single Runtime Record
      isLoading?: boolean;
      onAction?: (actionId: string, record: any) => void;
      onChange?: (field: string, value: any) => void;
    }
    ```
*   **Required Types (Ref: `src/ui/view.zod.ts`):** `simple`, `tabbed`, `wizard`, `split`, `drawer`, `modal`.

### D. Page Components (`page:*`)
Reusable UI blocks for the Drag-and-Drop Page Builder.
*   **Contract:** Must implement `PageComponentProps`.
    ```typescript
    type PageComponentProps = {
      id: string;                 // Instance ID
      type: string;               // Component Type Name
      properties: Record<string, any>; // User Config
      context?: {                 // Runtime Context
        objectName?: string;
        recordId?: string;
      };
    }
    ```
*   **Standard Components Library:**
    *   **Structure:** `page:header`, `page:footer`, `page:sidebar`, `page:tabs`, `page:accordion`, `page:card`.
    *   **Record Context:** 
        *   `record:details` (The form), `record:highlights` (Key fields header).
        *   `record:related_list` (Sub-grid), `record:activity` (Timeline).
        *   `record:chatter` (Feed), `record:path` (Status Steps).
    *   **Navigation:** `app:launcher`, `nav:menu`, `nav:breadcrumb`.
    *   **Utility:** `global:search`, `global:notifications`, `user:profile`.

### E. Dashboard Widgets (`widget:*`)
Standalone cards placed on a dashboard grid.
*   **Contract:** Must implement `DashboardWidgetProps` (Ref: `src/ui/dashboard.zod.ts`).
    ```typescript
    type DashboardWidgetProps = {
      config: DashboardWidgetSchema; // Config
      data?: any;                    // Runtime Data (optional)
      width: number;
      height: number;
    }
    ```
*   **Required Types (Ref: `src/ui/dashboard.zod.ts`):**
    *   **KPI:** `metric` (Big Number with Trend).
    *   **Charts:** `bar`, `line`, `pie`, `funnel`, `radar`, `scatter`, `heatmap`.
    *   **Analysis:** `pivot` (Cross-Tab Table).
    *   **Content:** `table` (List), `text` (Note), `image`, `frame` (Embed).

### F. Primitive Atoms (`atom:*`)
The fundamental building blocks used by all other widgets.
*   **Contract:** Pure UI components (No metadata dependencies).
*   **Required Library:**
    *   `atom:icon` (Lucide Wrapper).
    *   `atom:button` (Standard Actions).
    *   `atom:spinner` (Loading State).
    *   `atom:empty` (No Data Placeholder).
    *   `atom:error` (Error Boundary/Message).
    *   `atom:badge` (Status Indicators).

### G. Smart Actions (`action:*`)
Executable elements bound to the Action Protocol. They handle permissions, loading states, and confirmation dialogs automatically.
*   **Contract:** Must implement `ActionComponentProps` (Ref: `src/ui/action.zod.ts`).
    ```typescript
    type ActionComponentProps = {
      action: ActionSchema;       // Metadata
      record?: any;               // Context
      onExecute: () => Promise<void>;
    }
    ```
*   **Required Components:**
    *   `action:button`: Standalone smart button.
    *   `action:group`: Toolbar or Button Group.
    *   `action:menu`: Dropdown menu for overflow actions.
    *   `action:icon`: Icon-only trigger (for dense lists).

### H. AI Interface (`ai:*`)
Conversational and Generative UI components.
*   **Required Components:**
    *   `ai:chat_window`: Standard conversational interface.
    *   `ai:input`: Prompt input with auto-complete/context.
    *   `ai:suggestion`: "Next Best Action" cards.
    *   `ai:feedback`: Thumbs up/down + reasoning capture.

---

## 2. API Reference & Contracts

### A. Field Widget Implementation
**Reference:** `packages/fields/src/widgets/types.ts` (implemented props), `@objectstack/spec` -> `dist/ui/widget.zod.d.ts` (declared contract)

Import the **generic** `FieldWidgetComponentProps<T>` from `@object-ui/fields`.
The spec's `FieldWidgetProps` is a non-generic alias — writing
`FieldWidgetProps< number >` does not compile. There is no `mode` prop on
either type; read-mode is `readonly`.

```typescript
import type { FieldWidgetComponentProps } from '@object-ui/fields';

export function RatingField({
  value,
  onChange,
  field,
  readonly,
  error,
}: FieldWidgetComponentProps<number>) {

  if (readonly) {
    return <span>{'★'.repeat(value || 0)}</span>;
  }

  return (
    // `error` is the ACTIVE VALIDATION MESSAGE, supplied by the form renderer.
    // Consume it as a boolean signal for a11y and nothing more: the message
    // text is rendered by `<FormMessage/>` and the required marker by
    // `<FormLabel>`, both in the form renderer. A widget that also prints the
    // text double-displays it.
    <div className="flex gap-1" role="radiogroup" aria-invalid={!!error}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button 
          key={star}
          onClick={() => onChange(star)}
          className={star <= value ? 'text-yellow-500' : 'text-gray-300'}
        >
          ★
        </button>
      ))}
    </div>
  );
}
```

### B. Dashboard Widget Implementation
**Reference:** `@objectstack/spec` -> `dist/ui/dashboard.zod.d.ts`

```typescript
import { DashboardWidgetProps } from '@objectstack/spec/ui';

export function WelcomeCard({ config, user }: DashboardWidgetProps) {
  return (
    <div className="card p-4 bg-blue-50">
      <h3>Hello, {user.name}!</h3>
      <p>{config.welcomeMessage || 'Have a great day.'}</p>
    </div>
  );
}
```

---

## 3. Widget Registration

You must register the component map so the Server-Driven UI engine knows what to render.

```typescript
// src/components/registry.ts
import { RatingField } from './RatingField';
import { WelcomeCard } from './WelcomeCard';

export const widgetRegistry = {
  // Field Widgets (Maps to FieldType or Custom 'widget' property)
  'field:rating': RatingField,
  
  // Dashboard Widgets (Maps to widget 'type')
  'widget:welcome_card': WelcomeCard
};
```

## 4. Key Directives for AI

*   **Statelessness:** Widgets should rely on `props.value` and `props.onChange`. Avoid internal state unless necessary for transient UI interactions (like hover).
*   **Schema Awareness:** The widget must respect schema options (e.g., `field.required`, `field.readonly`, `field.options`).
*   **Validation:** `props.error` is the active validation message. Use it for the a11y state (`aria-invalid={!!error}`) and nothing else — the host renders the message text and the required marker, so a widget that renders either shows it twice.
*   **Accessibility:** Use standard ARIA roles and keyboard navigation (Shadcn UI/Radix primitives recommended).

---

**Instruction:**
When building a component, implementing the **Standard Props Interface** is non-negotiable. Ensure visual consistency with the host system (Tailwind classes).
