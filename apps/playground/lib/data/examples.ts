/**
 * Predefined JSON schema examples for the Object UI Playground
 * Organized by category to showcase different capabilities
 */

import { primitives } from './examples/primitives';
import { basic } from './examples/basic';
import { layouts } from './examples/layouts';
import { forms } from './examples/forms';
import { dataDisplay } from './examples/data-display';
import { feedback } from './examples/feedback';
import { disclosure } from './examples/disclosure';
import { complex } from './examples/complex';
import { dashboards } from './examples/dashboards';
import { plugins } from './examples/plugins';

export const examples = {
  ...primitives,
  ...basic,
  ...layouts,
  ...forms,
  ...dataDisplay,
  ...feedback,
  ...disclosure,
  ...complex,
  ...dashboards,
  ...plugins
};

export type ExampleKey = keyof typeof examples;

export const exampleCategories = {
  'Dashboards': ['analytics-dashboard', 'ecommerce-dashboard', 'project-management'],
  'Plugins': ['plugins-showcase', 'code-editor-demo', 'charts-demo'],
  'Basic': ['text-typography', 'image-gallery', 'icon-showcase', 'divider-demo'],
  'Primitives': ['simple-page', 'input-states', 'button-variants'],
  'Forms': ['form-demo', 'airtable-form', 'form-controls', 'date-time-pickers', 'file-upload-demo', 'input-otp-demo', 'toggle-group-demo'],
  'Layouts': ['grid-layout', 'dashboard', 'tabs-demo'],
  'Data Display': ['calendar-view', 'enterprise-table', 'data-table-simple', 'alert-messages', 'badge-labels', 'avatar-profiles', 'list-views', 'markdown-renderer', 'tree-hierarchy'],
  'Feedback': ['loading-states', 'progress-indicators', 'skeleton-loading'],
  'Disclosure': ['accordion-faq', 'collapsible-sections'],
  'Complex': ['kanban-board', 'carousel-gallery', 'timeline-events', 'table-basic']
};
