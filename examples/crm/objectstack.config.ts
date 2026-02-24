import { defineStack } from '@objectstack/spec';
import { AccountObject } from './src/objects/account.object';
import { ContactObject } from './src/objects/contact.object';
import { OpportunityObject } from './src/objects/opportunity.object';
import { ProductObject } from './src/objects/product.object';
import { OrderObject } from './src/objects/order.object';
import { OrderItemObject } from './src/objects/order_item.object';
import { UserObject } from './src/objects/user.object';
import { ProjectObject } from './src/objects/project.object';
import { EventObject } from './src/objects/event.object';
import { OpportunityContactObject } from './src/objects/opportunity_contact.object';
import { AccountView } from './src/views/account.view';
import { ContactView } from './src/views/contact.view';
import { OpportunityView } from './src/views/opportunity.view';
import { ProductView } from './src/views/product.view';
import { OrderView } from './src/views/order.view';
import { OrderItemView } from './src/views/order_item.view';
import { UserView } from './src/views/user.view';
import { EventView } from './src/views/event.view';
import { ProjectView } from './src/views/project.view';
import { OpportunityContactView } from './src/views/opportunity_contact.view';
import { AccountActions } from './src/actions/account.actions';
import { ContactActions } from './src/actions/contact.actions';
import { OpportunityActions } from './src/actions/opportunity.actions';
import { ProductActions } from './src/actions/product.actions';
import { OrderActions } from './src/actions/order.actions';
import { OrderItemActions } from './src/actions/order_item.actions';
import { UserActions } from './src/actions/user.actions';
import { ProjectActions } from './src/actions/project.actions';
import { EventActions } from './src/actions/event.actions';
import { OpportunityContactActions } from './src/actions/opportunity_contact.actions';
import { SalesReport } from './src/reports/sales.report';
import { PipelineReport } from './src/reports/pipeline.report';
import { HelpPage } from './src/pages/help.page';
import { SettingsPage } from './src/pages/settings.page';
import { GettingStartedPage } from './src/pages/getting_started.page';
import { CrmDashboard } from './src/dashboards/crm.dashboard';
import { CrmApp } from './src/apps/crm.app';
import { AccountData } from './src/data/account.data';
import { ContactData } from './src/data/contact.data';
import { OpportunityData } from './src/data/opportunity.data';
import { UserData } from './src/data/user.data';
import { ProductData } from './src/data/product.data';
import { OrderData } from './src/data/order.data';
import { ProjectTaskData } from './src/data/project_task.data';
import { EventData } from './src/data/event.data';
import { OrderItemData } from './src/data/order_item.data';
import { OpportunityContactData } from './src/data/opportunity_contact.data';

export default defineStack({
  objects: [
    AccountObject,
    ContactObject,
    OpportunityObject,
    ProductObject,
    OrderObject,
    OrderItemObject,
    UserObject,
    ProjectObject,
    EventObject,
    OpportunityContactObject
  ],
  views: [
    AccountView,
    ContactView,
    OpportunityView,
    ProductView,
    OrderView,
    OrderItemView,
    UserView,
    EventView,
    ProjectView,
    OpportunityContactView,
  ],
  reports: [
    SalesReport,
    PipelineReport,
  ],
  actions: [
    ...AccountActions,
    ...ContactActions,
    ...OpportunityActions,
    ...ProductActions,
    ...OrderActions,
    ...OrderItemActions,
    ...UserActions,
    ...ProjectActions,
    ...EventActions,
    ...OpportunityContactActions,
  ],
  pages: [
    HelpPage,
    SettingsPage,
    GettingStartedPage,
  ],
  apps: [
    CrmApp,
  ],
  dashboards: [
    CrmDashboard,
  ] as any,
  manifest: {
    id: 'com.example.crm',
    version: '1.0.0',
    type: 'app',
    name: 'CRM Example',
    description: 'CRM App Definition',
    data: [
      AccountData,
      ContactData,
      OpportunityData,
      UserData,
      ProductData,
      OrderData,
      ProjectTaskData,
      EventData,
      OrderItemData,
      OpportunityContactData,
    ]
  },
  plugins: [],
}, { strict: false }); // Defer validation to `objectstack compile` CLI
