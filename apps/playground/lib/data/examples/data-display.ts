import enterpriseTable from './data-display/enterprise-table.json';
import dataTableSimple from './data-display/data-table-simple.json';
import calendarView from './data-display/calendar-view.json';
import alertMessages from './data-display/alert-messages.json';
import badgeLabels from './data-display/badge-labels.json';
import avatarProfiles from './data-display/avatar-profiles.json';
import listViews from './data-display/list-views.json';
import markdownRenderer from './data-display/markdown-renderer.json';
import treeHierarchy from './data-display/tree-hierarchy.json';

export const dataDisplay = {
  'enterprise-table': JSON.stringify(enterpriseTable, null, 2),
  'data-table-simple': JSON.stringify(dataTableSimple, null, 2),
  'calendar-view': JSON.stringify(calendarView, null, 2),
  'alert-messages': JSON.stringify(alertMessages, null, 2),
  'badge-labels': JSON.stringify(badgeLabels, null, 2),
  'avatar-profiles': JSON.stringify(avatarProfiles, null, 2),
  'list-views': JSON.stringify(listViews, null, 2),
  'markdown-renderer': JSON.stringify(markdownRenderer, null, 2),
  'tree-hierarchy': JSON.stringify(treeHierarchy, null, 2)
};
