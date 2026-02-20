export const EventView = {
  listViews: {
    all_events: {
      name: 'all_events',
      label: 'All Events',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'event' },
      columns: ['subject', 'start', 'end', 'location', 'type', 'status'],
      sort: [{ field: 'start', order: 'asc' as const }],
    },
    calendar: {
      name: 'calendar',
      label: 'Calendar',
      type: 'calendar' as const,
      data: { provider: 'object' as const, object: 'event' },
      columns: ['subject', 'start', 'end', 'type'],
      calendar: {
        startDateField: 'start',
        endDateField: 'end',
        titleField: 'subject',
      },
    },
    upcoming_meetings: {
      name: 'upcoming_meetings',
      label: 'Upcoming Meetings',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'event' },
      columns: ['subject', 'start', 'location', 'organizer'],
      filter: ['type', '=', 'meeting'],
      sort: [{ field: 'start', order: 'asc' as const }],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'event' },
    sections: [
      {
        label: 'Event Details',
        columns: '2' as const,
        fields: ['subject', 'type', 'status', 'location', 'is_all_day', 'is_private'],
      },
      {
        label: 'Schedule',
        columns: '2' as const,
        fields: ['start', 'end', 'reminder'],
      },
      {
        label: 'Participants',
        columns: '2' as const,
        fields: ['organizer', 'participants'],
      },
      {
        label: 'Description',
        columns: '1' as const,
        collapsible: true,
        fields: ['description'],
      },
    ],
  },
};
