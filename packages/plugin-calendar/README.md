# @object-ui/plugin-calendar

Calendar view plugins for Object UI - includes both ObjectQL-integrated and standalone calendar components.

## Features

- **Calendar View** - Monthly calendar with event display
- **Event Management** - Create, edit, and delete events
- **Drag-and-Drop Rescheduling** - Move events to a different day in
  month view, or drag vertically in week/day views to change start
  time. Drag top/bottom edges to resize start/end times. Changes are
  persisted via `dataSource.update()` automatically (override with the
  `onEventDrop` prop).
- **Click-to-Create** - Click any day cell (month view) or click-drag
  on the time grid (week/day views) to open a quick-create dialog
  pre-filled with the selected date/range. New records are persisted
  via `dataSource.create()` and inserted optimistically into the
  calendar. Required picklist fields auto-default to their first
  option.
- **ObjectQL Integration** - Connect to ObjectStack data sources
- **Standalone Mode** - Use with static data or custom backends
- **Responsive** - Mobile-friendly calendar layouts
- **Customizable** - Tailwind CSS styling support

## Drag-and-Drop

### Month view

| Gesture | Effect |
| --- | --- |
| Drag the event pill body to another day cell | Shifts both `startDateField` and `endDateField` by the day delta. Grab cell → drop cell defines the delta, so dragging from any day of a multi-day span works as expected. |
| Drag the right-edge handle of a multi-day pill | Adjusts only `endDateField`; start is preserved. Refuses drops earlier than start. |

### Week / Day view (time grid)

The week and day views render a classic Google Calendar-style vertical
time grid with hour rows. Pointer-driven interactions:

| Gesture | Effect |
| --- | --- |
| Drag an event vertically | Shifts both `startDateField` and `endDateField` by the time delta (snapped to `slotMinutes`, default 30). |
| Drag the top edge of an event | Adjusts only `startDateField`; end is preserved. Refuses to drag past `end − slotMinutes`. |
| Drag the bottom edge of an event | Adjusts only `endDateField`; start is preserved. Refuses to drag past `start + slotMinutes`. |
| Click-drag on empty grid background | Opens the quick-create dialog with start/end pre-filled to the dragged time range. |

Pass `slotMinutes={15}` to change the snap granularity. Pass
`onTimeRangeSelect={(start, end) => …}` to handle drag-to-create
yourself instead of the default quick-create dialog.

When `ObjectCalendar` is bound to an object schema, the new dates are
persisted with `dataSource.update(objectName, id, patch)` automatically;
the local state is updated optimistically and rolled back if the
server call fails. To intercept (e.g. to confirm a status change) pass
`onEventDrop={(record, newStart, newEnd) => …}` — the default
persistence is skipped when you provide your own handler.

## Click-to-Create

Clicking an empty area of any day cell opens a small quick-create
dialog pre-filled with the clicked date. Type a title, press
<kbd>Enter</kbd> (or click **Create**), and the record is persisted
via `dataSource.create(objectName, payload)`. The payload includes:

- The configured `titleField` (defaults to `name`)
- `startDateField` and (if configured) `endDateField` set to the
  clicked day
- Auto-defaults for any other required fields the user hasn't supplied
  (first picklist option for `select`/`status`, `false` for booleans,
  `0` for numerics, or the field's `defaultValue`)

The new record is optimistically inserted into local state so it
appears immediately. To override (e.g. open your own create form), pass
`onDateClick={(day) => …}` — the default behaviour is skipped.

## Installation

```bash
pnpm add @object-ui/plugin-calendar
```

## Usage

### Automatic Registration (Side-Effect Import)

```typescript
// In your app entry point (e.g., App.tsx or main.tsx)
import '@object-ui/plugin-calendar';

// Now you can use calendar types in your schemas
const schema = {
  type: 'calendar-view',
  data: [
    {
      id: '1',
      title: 'Team Meeting',
      start: '2024-01-15T10:00:00',
      end: '2024-01-15T11:00:00'
    }
  ]
};
```

### What the side-effect import registers

Registration is *only* a side effect of importing the package — the single
`import '@object-ui/plugin-calendar'` above is the whole of it. There is no
components map to iterate over: importing the entry point runs the
`ComponentRegistry.register(...)` calls in `src/index.tsx` and
`src/calendar-view-renderer.tsx`, which claim these schema types:

| Schema `type` | Namespaced key | Renderer |
| --- | --- | --- |
| `object-calendar` | `plugin-calendar:object-calendar` | `ObjectCalendarRenderer` |
| `calendar` | `view:calendar` | `ObjectCalendarRenderer` |
| `calendar-view` | `plugin-calendar:calendar-view` | internal wrapper around `CalendarView` (not exported) |

Both spellings work — the namespaced key and the bare `type` fallback.

### Public exports

The package exports components and their types, not a registry map:

```typescript
import {
  ObjectCalendar, // ObjectQL-integrated calendar component
  CalendarView, // standalone calendar component
  ObjectCalendarRenderer, // the registered renderer for `object-calendar` / `calendar`
} from '@object-ui/plugin-calendar';

import type {
  ObjectCalendarComponentProps,
  CalendarViewProps,
  CalendarViewEvent,
} from '@object-ui/plugin-calendar';
```

To serve the calendar under a registry key of your own, register the exported
renderer under that key:

```typescript
import { ComponentRegistry } from '@object-ui/core';
import { ObjectCalendarRenderer } from '@object-ui/plugin-calendar';

ComponentRegistry.register('my-calendar', ObjectCalendarRenderer);
```

## Schema API

### CalendarView

Display a calendar computed from the node's `data` records. This is the full
authored surface: `CalendarViewSchema` in `@object-ui/types` declares 13 keys of
its own, converged on what the registered `calendar-view` renderer actually
reads (objectui#5667). Two of them — `data` and `className` — refine common
`BaseSchema` keys; the rest of `BaseSchema` (`id`, `visible`, ...) applies as on
any node.

```typescript
{
  type: 'calendar-view',
  data?: any,                       // records rendered as events (array, or a binding expression)
  titleField?: string,              // default 'title'
  startDateField?: string,          // default 'start'
  endDateField?: string,            // default 'end'
  allDayField?: string,             // default 'allDay'
  colorField?: string,              // default 'color'
  view?: CalendarViewMode,          // 'month' | 'week' | 'day' (default 'month')
  currentDate?: string | Date,      // ISO string authored; Date from a React host
  allowCreate?: boolean,            // default false — shows the "New event" button
  className?: string,               // Tailwind classes for the container
  onEventClick?: (event: CalendarEvent) => void,   // HOST-ONLY (see below)
  onViewChange?: (view: CalendarViewMode) => void  // HOST-ONLY (see below)
}
```

There is deliberately **no authorable `events` key**: the renderer computes its
events from `data` plus the field-name keys, and drops an authored `events`
(objectui#4433). Nine formerly declared keys — `events`, `defaultView`,
`defaultDate`, `date`, `views`, `editable`, `onEventCreate`, `onEventUpdate`,
`onDateChange` — were retired in objectui#5667 because nothing read them on the
authored-node path and no measured app authors them. `onDateClick` is **not**
on this schema — it is a `CalendarViewProps` component prop (see
[Drag-and-Drop](#drag-and-drop) and [Click-to-Create](#click-to-create)).

> **The handlers are host-only.** `onEventClick` and `onViewChange` are
> forwarded to the component only when the value really is a function, which
> authored JSON can never produce — supply them from a React host
> (`<SchemaRenderer ... onEventClick={fn} />`). Authored as JSON strings they
> are dropped, same as absent.

### Calendar Event Structure

Events are not authored directly — the renderer computes one event per record
in the node's `data` array, reading the fields the field-name keys point at:

```text
id:     record.id                 // falls back to record._id, then the array index
title:  record[titleField]        // default field 'title'
start:  record[startDateField]    // default field 'start' (ISO datetime string)
end:    record[endDateField]      // default field 'end' (optional)
allDay: record[allDayField]       // default field 'allDay'
color:  record[colorField]        // default field 'color'
data:   record                    // the whole record rides along
```

`@object-ui/types` still exports the `CalendarEvent` interface — it is the
declared payload type of the host-only `onEventClick` callback.

## Examples

### Basic Calendar

```typescript
const schema = {
  type: 'calendar-view',
  data: [
    {
      id: '1',
      title: 'Product Launch',
      start: '2024-02-15T09:00:00',
      end: '2024-02-15T17:00:00',
      color: 'bg-blue-500'
    },
    {
      id: '2',
      title: 'All-Hands Meeting',
      start: '2024-02-20T14:00:00',
      end: '2024-02-20T15:00:00',
      color: 'bg-green-500'
    }
  ]
};
```

The records above already use the default field names (`title`, `start`, `end`,
`color`), so no field-name keys are needed; point `titleField` /
`startDateField` / `endDateField` / `allDayField` / `colorField` at your own
fields when they differ.

### With ObjectQL Integration

```typescript
const schema = {
  type: 'object-calendar',
  object: 'events',
  titleField: 'name',
  startField: 'startDate',
  endField: 'endDate',
  colorField: 'category.color'
};
```

### Interactive Calendar

The handlers are host-only — a function can only come from a React host
building the node in code, never from authored JSON:

```typescript
const schema = {
  type: 'calendar-view',
  data: [],
  onEventClick: (event) => {
    console.log('Event clicked:', event);
    // Open event details modal
  },
  onViewChange: (view) => {
    console.log('View changed:', view);
    // React to the calendar switching between month/week/day
  }
};
```

Authored JSON reacts to clicks through the node's action channel instead
(`allowCreate: true` dispatches `{ type: 'create' }`; event clicks dispatch
`{ type: 'event-click' }`).

## ObjectQL Integration

When using with ObjectStack, the calendar can automatically fetch and display events:

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-auth-token'
});

const schema = {
  type: 'object-calendar',
  dataSource,
  object: 'calendar_events',
  fields: {
    title: 'title',
    start: 'start_time',
    end: 'end_time',
    color: 'category_color'
  }
};
```

## Customization

Style the calendar with Tailwind classes:

```typescript
const schema = {
  type: 'calendar-view',
  className: 'border rounded-lg shadow-lg',
  data: [...]
};
```

## TypeScript Support

The **authored** (JSON metadata) types live in `@object-ui/types`, not in this
package — this package imports them too, and does not re-export them:

```typescript
import type { CalendarViewSchema } from '@object-ui/types';

const schema: CalendarViewSchema = {
  type: 'calendar-view',
  data: [
    { id: '1', name: 'Meeting', begins: '2024-01-15T10:00:00', ends: '2024-01-15T11:00:00' }
  ],
  titleField: 'name',
  startDateField: 'begins',
  endDateField: 'ends',
  view: 'week',
  allowCreate: true
};
```

> **Two calendar event types — pick by which side you are on.**
> `@object-ui/types` exports **`CalendarEvent`**, the AUTHORING event
> (`id: string`, `start` / `end` accept ISO strings with `end` required, plus
> `description`) — since objectui#5667 it is no longer part of the authored
> surface (a `calendar-view` node carries `data` records, not events; see
> [Calendar Event Structure](#calendar-event-structure)), but it remains the
> declared payload type of the host-only `onEventClick` callback. This package
> exports **`CalendarViewEvent`** (`CalendarViewProps['events']`), the
> `CalendarView` **component's runtime** type: `id: string | number` and
> `start: Date` / `end?: Date`. They are not interchangeable — neither is
> assignable to the other.
>
> Both were spelled `CalendarEvent` until objectui#5044, where IDE auto-import
> chose between them at random and the wrong pick failed as a remote `TS2322`
> about `Date`. This package still exports `CalendarEvent` as a **`@deprecated`
> alias of `CalendarViewEvent`**, so existing importers keep compiling; write
> `CalendarViewEvent` in new code.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-calendar)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-calendar)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
