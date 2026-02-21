export const EventData = {
  object: 'event',
  mode: 'upsert',
  records: [
    { _id: "e1", subject: "Weekly Standup", start: new Date("2024-02-05T09:00:00"), end: new Date("2024-02-05T10:00:00"), location: "Conference Room A", type: "meeting", status: "completed", organizer: "1", reminder: "min_15", description: "Team synchronization regarding Project Alpha", participants: ["1", "2", "5"] },
    { _id: "e2", subject: "Client Call - TechCorp", start: new Date("2024-02-06T14:00:00"), end: new Date("2024-02-06T15:00:00"), location: "Zoom", type: "call", status: "completed", organizer: "2", reminder: "min_5", description: "Reviewing Q1 Goals and Roadblocks", participants: ["2", "7"] },
    { _id: "e3", subject: "Project Review", start: new Date("2024-02-08T10:00:00"), end: new Date("2024-02-08T11:30:00"), location: "Board Room", type: "meeting", status: "completed", organizer: "1", reminder: "min_30", description: "Milestone review with stakeholders", participants: ["1", "3", "4"] },
    { _id: "e4", subject: "Lunch with Partners", start: new Date("2024-02-09T12:00:00"), end: new Date("2024-02-09T13:30:00"), location: "Downtown Cafe", type: "other", status: "completed", organizer: "2", description: "Networking event", participants: ["4", "6"] },
    { _id: "e5", subject: "Product Demo - Berlin Auto", start: new Date("2024-03-10T11:00:00"), end: new Date("2024-03-10T12:30:00"), location: "Online", type: "meeting", status: "scheduled", organizer: "1", reminder: "hour_1", is_private: false, description: "Showcasing the new automation suite capabilities", participants: ["5"] },
    { _id: "e6", subject: "Internal Training", start: new Date("2024-03-15T09:00:00"), end: new Date("2024-03-15T16:00:00"), location: "Training Center", type: "other", status: "scheduled", organizer: "1", is_all_day: true, reminder: "day_1", description: "Security compliance training for all staff", participants: ["1", "2", "3", "5", "6", "7"] },
  ]
};
