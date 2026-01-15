import analyticsDashboard from './dashboards/analytics-dashboard.json';
import ecommerceDashboard from './dashboards/ecommerce-dashboard.json';
import projectManagement from './dashboards/project-management.json';

export const dashboards = {
  'analytics-dashboard': JSON.stringify(analyticsDashboard, null, 2),
  'ecommerce-dashboard': JSON.stringify(ecommerceDashboard, null, 2),
  'project-management': JSON.stringify(projectManagement, null, 2)
};
