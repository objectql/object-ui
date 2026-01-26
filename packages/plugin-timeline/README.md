# @object-ui/plugin-timeline

Timeline component plugin for Object UI with support for vertical, horizontal, and Gantt-style timelines.

## Installation

```bash
npm install @object-ui/plugin-timeline
```

## Usage

### Vertical Timeline

```tsx
import {
  Timeline,
  TimelineItem,
  TimelineMarker,
  TimelineContent,
  TimelineTitle,
  TimelineTime,
  TimelineDescription
} from '@object-ui/plugin-timeline';

function App() {
  return (
    <Timeline>
      <TimelineItem>
        <TimelineMarker variant="success" />
        <TimelineContent>
          <TimelineTime>2024-01-15</TimelineTime>
          <TimelineTitle>Project Started</TimelineTitle>
          <TimelineDescription>
            Kickoff meeting and initial planning
          </TimelineDescription>
        </TimelineContent>
      </TimelineItem>
    </Timeline>
  );
}
```

### Gantt Timeline

```tsx
import {
  TimelineGantt,
  TimelineGanttHeader,
  TimelineGanttRow,
  TimelineGanttBar
} from '@object-ui/plugin-timeline';

// See examples in the source code for Gantt usage
```

## Schema-Driven Usage

This plugin automatically registers with ObjectUI's component registry when imported:

```tsx
import '@object-ui/plugin-timeline';

const schema = {
  component: 'timeline',
  variant: 'vertical',
  items: [
    {
      time: '2024-01-15',
      title: 'Project Started',
      description: 'Kickoff meeting',
      variant: 'success'
    }
  ]
};
```

## License

MIT © ObjectStack Inc.
