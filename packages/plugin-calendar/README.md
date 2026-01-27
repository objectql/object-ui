# @object-ui/plugin-calendar

Calendar view plugins for Object UI - includes both ObjectQL-integrated and standalone calendar components.

## Features

- **Calendar View** - Monthly calendar with event display
- **Event Management** - Create, edit, and delete events
- **ObjectQL Integration** - Connect to ObjectStack data sources
- **Standalone Mode** - Use with static data or custom backends
- **Responsive** - Mobile-friendly calendar layouts
- **Customizable** - Tailwind CSS styling support

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

### Manual Registration

```typescript
import { calendarComponents } from '@object-ui/plugin-calendar';
import { ComponentRegistry } from '@object-ui/core';

// Register calendar components
Object.entries(calendarComponents).forEach(([type, component]) => {
  ComponentRegistry.register(type, component);
});
```

## Schema API

### CalendarView

Display a monthly calendar with events:

```typescript
{
  type: 'calendar-view',
  events?: CalendarEvent[],
  defaultDate?: string,           // ISO date string
  onEventClick?: (event) => void,
  onDateClick?: (date) => void,
  className?: string
}
```

### Calendar Event Structure

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
  onDateClick: (date) => {
    console.log('Date clicked:', date);
    // Create new event
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

```typescript
import type { CalendarViewSchema, CalendarEvent } from '@object-ui/plugin-calendar';

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

## License

MIT
