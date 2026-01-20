---
title: "Calendar View Component"
---

The `calendar-view` component is an Airtable-style calendar for displaying records as events. It provides three view modes: Month, Week, and Day.

## Features

- **Multiple View Modes**: Switch between Month, Week, and Day views
- **Flexible Data Mapping**: Map your data fields to event properties
- **Color Coding**: Support for color-coded events with custom color mappings
- **Interactive**: Click on events and dates (with callbacks)
- **Responsive**: Works seamlessly on different screen sizes

## Basic Usage

```json
{
  "type": "calendar-view",
  "data": [
    {
      "id": 1,
      "title": "Team Meeting",
      "start": "2026-01-13T10:00:00.000Z",
      "end": "2026-01-13T11:00:00.000Z",
      "color": "#3b82f6"
    }
  ]
}
```

## Properties

| Property | Type | Default | Description |
|:---|:---|:---|:---|
| `data` | `array` | `[]` | Array of record objects to display as events |
| `view` | `'month' \| 'week' \| 'day'` | `'month'` | Default view mode |
| `titleField` | `string` | `'title'` | Field name to use for event title |
| `startDateField` | `string` | `'start'` | Field name for event start date |
| `endDateField` | `string` | `'end'` | Field name for event end date (optional) |
| `allDayField` | `string` | `'allDay'` | Field name for all-day flag |
| `colorField` | `string` | `'color'` | Field name for event color |
| `colorMapping` | `object` | `{}` | Map field values to colors |
| `allowCreate` | `boolean` | `false` | Allow creating events by clicking on dates |
| `className` | `string` | - | Additional CSS classes |

## Data Structure

Each event object in the `data` array should have the following structure:

```typescript
{
  id: string | number;           // Unique identifier
  title: string;                 // Event title (or use custom titleField)
  start: string | Date;          // Start date/time (ISO string or Date)
  end?: string | Date;           // End date/time (optional)
  allDay?: boolean;              // Whether it's an all-day event
  color?: string;                // Event color (hex or CSS color)
  [key: string]: any;            // Any other custom data
}
```

## Examples

### Month View with Color Mapping

```json
{
  "type": "calendar-view",
  "className": "h-[600px] border rounded-lg",
  "view": "month",
  "colorField": "type",
  "colorMapping": {
    "meeting": "#3b82f6",
    "deadline": "#ef4444",
    "event": "#10b981"
  },
  "data": [
    {
      "id": 1,
      "title": "Team Standup",
      "start": "2026-01-13T09:00:00.000Z",
      "end": "2026-01-13T09:30:00.000Z",
      "type": "meeting"
    },
    {
      "id": 2,
      "title": "Project Deadline",
      "start": "2026-01-20T00:00:00.000Z",
      "type": "deadline",
      "allDay": true
    }
  ]
}
```

## View Modes

### Month View
Displays a full month calendar grid with events shown as colored bars on their respective dates. Perfect for getting a high-level overview of the month.

### Week View
Shows a week at a time with each day in a column. Events display with their times, ideal for detailed weekly planning.

### Day View
Displays a single day with hourly time slots from 12 AM to 11 PM. Events are positioned at their scheduled times, great for detailed daily schedules.

## Events & Callbacks

The calendar view supports several event callbacks through the `onAction` mechanism:

- `event_click`: Triggered when an event is clicked
- `date_click`: Triggered when a date cell is clicked
- `view_change`: Triggered when the view mode changes
- `navigate`: Triggered when navigating between dates

## Styling

The calendar view is fully styled with Tailwind CSS and supports custom styling through the `className` prop.

## Integration with ObjectQL

When used with ObjectQL, the calendar view can automatically fetch and display records from your database.
