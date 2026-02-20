import { ObjectSchema, Field } from '@objectstack/spec/data';

export const EventObject = ObjectSchema.create({
  name: 'event',
  label: 'Event',
  icon: 'calendar',
  description: 'Meetings, calls, and calendar events with participant tracking',
  fields: {
    subject: Field.text({ label: 'Subject', required: true, searchable: true }),
    start: Field.datetime({ label: 'Start', required: true }),
    end: Field.datetime({ label: 'End', required: true }),
    is_all_day: Field.boolean({ label: 'All Day Event', defaultValue: false }),
    location: Field.text({ label: 'Location' }),
    description: Field.richtext({ label: 'Description' }),
    participants: Field.lookup('contact', { label: 'Participants', multiple: true }),
    organizer: Field.lookup('user', { label: 'Organizer' }),
    type: Field.select([
      { value: 'meeting', label: 'Meeting', color: 'blue' },
      { value: 'call', label: 'Call', color: 'green' },
      { value: 'email', label: 'Email', color: 'purple' },
      { value: 'other', label: 'Other', color: 'gray' },
    ], { label: 'Type' }),
    status: Field.select([
      { value: 'scheduled', label: 'Scheduled', color: 'blue' },
      { value: 'completed', label: 'Completed', color: 'green' },
      { value: 'cancelled', label: 'Cancelled', color: 'red' },
    ], { label: 'Status', defaultValue: 'scheduled' }),
    is_private: Field.boolean({ label: 'Private', defaultValue: false }),
    reminder: Field.select([
      { value: 'none', label: 'None' },
      { value: 'min_5', label: '5 minutes' },
      { value: 'min_15', label: '15 minutes' },
      { value: 'min_30', label: '30 minutes' },
      { value: 'hour_1', label: '1 hour' },
      { value: 'day_1', label: '1 day' },
    ], { label: 'Reminder', defaultValue: 'min_15' })
  }
});
