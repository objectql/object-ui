import gridLayout from './layouts/grid-layout.json';
import dashboard from './layouts/dashboard.json';
import tabsDemo from './layouts/tabs-demo.json';

export const layouts = {
  'grid-layout': JSON.stringify(gridLayout, null, 2),
  'dashboard': JSON.stringify(dashboard, null, 2),
  'tabs-demo': JSON.stringify(tabsDemo, null, 2)
};
