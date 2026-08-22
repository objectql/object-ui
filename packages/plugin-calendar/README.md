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
  events: [
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
  CalendarEvent,
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

Display a monthly calendar with events. This is a **partial summary**: the full
contract is `CalendarViewSchema` in `@object-ui/types`, which declares 13 keys of
its own on top of the common `BaseSchema` keys (`className`, `id`, `data`,
`visible`, ...).

```typescript
{
  type: 'calendar-view',
  events: CalendarEvent[],          // REQUIRED — the only required key besides `type`
  defaultView?: CalendarViewMode,   // 'month' | 'week' | 'day' | 'agenda' (default 'month')
  view?: CalendarViewMode,          // controlled
  views?: CalendarViewMode[],       // default ['month', 'week', 'day']
  defaultDate?: string | Date,
  date?: string | Date,             // controlled
  editable?: boolean,               // default false
  onEventClick?: (event: CalendarEvent) => void,
  onDateChange?: (date: Date) => void,
  onViewChange?: (view: CalendarViewMode) => void,
  className?: string                // from `BaseSchema`, not `CalendarViewSchema`
}
```

`onEventCreate` and `onEventUpdate` complete the 13; see `CalendarViewSchema` for
their signatures. `onDateClick` is **not** on this schema — it is a
`CalendarViewProps` component prop (see [Drag-and-Drop](#drag-and-drop) and
[Click-to-Create](#click-to-create)).

> **The type is not the renderer.** `CalendarViewSchema` is the shape
> `@object-ui/types` publishes for this node, not a description of what the
> registered `calendar-view` renderer reads. That renderer builds its events from
> the node's `data` array plus the `titleField` / `startDateField` /
> `endDateField` / `colorField` / `allDayField` inputs, and **drops an authored
> `events` key** (objectui#4433) — so the type's one required key does nothing
> when written as JSON. Of the keys above it also reads `view` and `className`;
> the handlers only ever arrive from a React host
> (`<SchemaRenderer ... onEventClick={fn} />`), because JSON cannot carry a
> function.

### Calendar Event Structure

The authored event shape, declared by `@object-ui/types`:

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  start: string;                  // ISO datetime string
  end: string;                    // ISO datetime string
  description?: string;
  color?: string;                 // Tailwind color class
  allDay?: boolean;
}
```

## Examples

### Basic Calendar

```typescript
const schema = {
  type: 'calendar-view',
  events: [
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

```typescript
const schema = {
  type: 'calendar-view',
  events: [],
  onEventClick: (event) => {
    console.log('Event clicked:', event);
    // Open event details modal
  },
  onDateChange: (date) => {
    console.log('Visible date changed:', date);
    // React to the calendar moving to another month/week/day
  }
};
```

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
  events: [...]
};
```

## TypeScript Support

The **authored** (JSON metadata) types live in `@object-ui/types`, not in this
package — this package imports them too, and does not re-export them:

```typescript
import type { CalendarViewSchema, CalendarEvent } from '@object-ui/types';

const event: CalendarEvent = {
  id: '1',
  title: 'Meeting',
  start: '2024-01-15T10:00:00',
  end: '2024-01-15T11:00:00'
};

const schema: CalendarViewSchema = {
  type: 'calendar-view',
  events: [event]
};
```

> **Two different `CalendarEvent` types, same name.** The one above, from
> `@object-ui/types`, is the *authored* event: `id: string` and
> `start` / `end` accept ISO strings — that is the shape documented under
> [Calendar Event Structure](#calendar-event-structure) and the one a
> `calendar-view` schema carries. This package also exports a `CalendarEvent`
> (`CalendarViewProps['events']`), which is the `CalendarView` **component's
> runtime** type: `id: string | number` and `start: Date` / `end?: Date`. Use
> the `@object-ui/types` one for metadata and the plugin one when you render
> `CalendarView` yourself in React; they are not interchangeable.

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-calendar)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-calendar)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
