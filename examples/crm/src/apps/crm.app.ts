import { App } from '@objectstack/spec/ui';

export const CrmApp = App.create({
  name: 'crm_app',
  label: 'CRM',
  icon: 'briefcase',
  description: 'Sales pipeline, accounts, and customer management',
  branding: {
    primaryColor: '#3B82F6',
    logo: 'https://objectstack.com/logo.svg',
    favicon: 'https://objectstack.com/favicon.ico',
  },
  navigation: [
    {
      id: 'nav_dashboard',
      type: 'dashboard',
      dashboardName: 'crm_dashboard',
      label: 'Dashboard',
      icon: 'layout-dashboard'
    },
    {
      id: 'nav_contacts',
      type: 'object',
      objectName: 'contact',
      label: 'Contacts',
      icon: 'users'
    },
    {
      id: 'nav_accounts',
      type: 'object',
      objectName: 'account',
      label: 'Accounts',
      icon: 'building-2'
    },
    {
      id: 'nav_opportunities',
      type: 'object',
      objectName: 'opportunity',
      label: 'Opportunities',
      icon: 'trending-up'
    },
    {
      id: 'nav_pipeline',
      type: 'object',
      objectName: 'opportunity',
      viewName: 'pipeline',
      label: 'Pipeline',
      icon: 'kanban-square'
    },
    {
      id: 'nav_projects',
      type: 'object',
      objectName: 'project_task',
      label: 'Projects',
      icon: 'kanban-square'
    },
    {
      id: 'nav_events',
      type: 'object',
      objectName: 'event',
      viewName: 'calendar',
      label: 'Calendar',
      icon: 'calendar'
    },
    {
      id: 'nav_sales',
      type: 'group',
      label: 'Sales',
      icon: 'banknote',
      children: [
         {
            id: 'nav_orders',
            type: 'object',
            objectName: 'order',
            label: 'Orders',
            icon: 'shopping-cart'
         },
         {
            id: 'nav_products',
            type: 'object',
            objectName: 'product',
            label: 'Products',
            icon: 'package'
         },
         {
            id: 'nav_order_items',
            type: 'object',
            objectName: 'order_item',
            label: 'Line Items',
            icon: 'list-ordered'
         }
      ]
    },
    {
      id: 'nav_reports',
      type: 'group',
      label: 'Reports',
      icon: 'file-bar-chart',
      children: [
        {
          id: 'nav_sales_report',
          type: 'report',
          reportName: 'sales_report',
          label: 'Sales Report',
          icon: 'bar-chart-3'
        },
        {
          id: 'nav_pipeline_report',
          type: 'report',
          reportName: 'pipeline_report',
          label: 'Pipeline Report',
          icon: 'pie-chart'
        }
      ]
    },
    {
      id: 'nav_getting_started',
      type: 'page',
      pageName: 'crm_getting_started',
      label: 'Getting Started',
      icon: 'rocket'
    },
    {
      id: 'nav_settings',
      type: 'page',
      pageName: 'crm_settings',
      label: 'Settings',
      icon: 'settings'
    },
    {
      id: 'nav_help',
      type: 'page',
      pageName: 'crm_help',
      label: 'Help',
      icon: 'help-circle'
    }
  ]
});
