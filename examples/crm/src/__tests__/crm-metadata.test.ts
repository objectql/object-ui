import { describe, it, expect } from 'vitest';

// --- Metadata imports ---
import { AccountObject } from '../objects/account.object';
import { ContactObject } from '../objects/contact.object';
import { OpportunityObject } from '../objects/opportunity.object';
import { ProductObject } from '../objects/product.object';
import { OrderObject } from '../objects/order.object';
import { OrderItemObject } from '../objects/order_item.object';
import { UserObject } from '../objects/user.object';
import { ProjectObject } from '../objects/project.object';
import { EventObject } from '../objects/event.object';
import { OpportunityContactObject } from '../objects/opportunity_contact.object';

import { AccountView } from '../views/account.view';
import { ContactView } from '../views/contact.view';
import { OpportunityView } from '../views/opportunity.view';
import { ProductView } from '../views/product.view';
import { OrderView } from '../views/order.view';
import { OrderItemView } from '../views/order_item.view';
import { UserView } from '../views/user.view';
import { EventView } from '../views/event.view';
import { ProjectView } from '../views/project.view';
import { OpportunityContactView } from '../views/opportunity_contact.view';

import { AccountActions } from '../actions/account.actions';
import { ContactActions } from '../actions/contact.actions';
import { OpportunityActions } from '../actions/opportunity.actions';
import { ProductActions } from '../actions/product.actions';
import { OrderActions } from '../actions/order.actions';
import { OrderItemActions } from '../actions/order_item.actions';
import { UserActions } from '../actions/user.actions';
import { ProjectActions } from '../actions/project.actions';
import { EventActions } from '../actions/event.actions';
import { OpportunityContactActions } from '../actions/opportunity_contact.actions';

import { CrmDashboard } from '../dashboards/crm.dashboard';
import { SalesReport } from '../reports/sales.report';
import { PipelineReport } from '../reports/pipeline.report';
import { GettingStartedPage } from '../pages/getting_started.page';
import { SettingsPage } from '../pages/settings.page';
import { HelpPage } from '../pages/help.page';
import { CrmApp } from '../apps/crm.app';

// --- i18n imports ---
import { crmLocales, type CrmTranslationKeys } from '../i18n';

// ====================================================================
// 1. Metadata Spec Compliance Tests
// ====================================================================

const allObjects = [
  AccountObject, ContactObject, OpportunityObject, ProductObject,
  OrderObject, OrderItemObject, UserObject, ProjectObject,
  EventObject, OpportunityContactObject,
];

const allViews = [
  AccountView, ContactView, OpportunityView, ProductView,
  OrderView, OrderItemView, UserView, EventView,
  ProjectView, OpportunityContactView,
];

const allActions = [
  ...AccountActions, ...ContactActions, ...OpportunityActions,
  ...ProductActions, ...OrderActions, ...OrderItemActions,
  ...UserActions, ...ProjectActions, ...EventActions,
  ...OpportunityContactActions,
];

describe('CRM Metadata Spec Compliance', () => {

  describe('Objects', () => {
    it('all objects have name, label, and fields', () => {
      for (const obj of allObjects) {
        expect(obj).toHaveProperty('name');
        expect(obj).toHaveProperty('label');
        expect(obj).toHaveProperty('fields');
        expect(typeof obj.name).toBe('string');
        expect(typeof obj.label).toBe('string');
        expect(typeof obj.fields).toBe('object');
      }
    });

    it('all objects have at least one required field', () => {
      for (const obj of allObjects) {
        const fields = Object.values(obj.fields) as Array<{ required?: boolean }>;
        const hasRequired = fields.some((f) => f.required === true);
        expect(hasRequired).toBe(true);
      }
    });
  });

  describe('Views', () => {
    it('all views have listViews and form sections', () => {
      for (const view of allViews) {
        expect(view).toHaveProperty('listViews');
        expect(view).toHaveProperty('form');
        expect(view.form).toHaveProperty('sections');
      }
    });

    it('form section columns are valid string enum values', () => {
      for (const view of allViews) {
        for (const section of view.form.sections) {
          if (section.columns !== undefined) {
            expect(['1', '2', '3', '4']).toContain(section.columns);
          }
        }
      }
    });

    it('list views have required fields (name, type, data, columns)', () => {
      for (const view of allViews) {
        for (const lv of Object.values(view.listViews) as Array<Record<string, unknown>>) {
          expect(lv).toHaveProperty('name');
          expect(lv).toHaveProperty('type');
          expect(lv).toHaveProperty('data');
          expect(lv).toHaveProperty('columns');
        }
      }
    });
  });

  describe('Actions', () => {
    it('all actions have name, label, type, and locations', () => {
      for (const action of allActions) {
        expect(action).toHaveProperty('name');
        expect(action).toHaveProperty('label');
        expect(action).toHaveProperty('type');
        expect(action).toHaveProperty('locations');
        expect(action.type).toBe('api');
      }
    });

    it('action variants use @objectstack/spec allowed values', () => {
      for (const action of allActions) {
        if ('variant' in action) {
          expect(['primary', 'secondary', 'danger', 'ghost', 'link']).toContain(action.variant);
        }
      }
    });

    it('danger actions have confirmText', () => {
      for (const action of allActions) {
        if ('variant' in action && action.variant === 'danger') {
          expect(action).toHaveProperty('confirmText');
        }
      }
    });
  });

  describe('Dashboard', () => {
    it('has name and label', () => {
      expect(CrmDashboard.name).toBe('crm_dashboard');
      expect(CrmDashboard.label).toBeDefined();
    });

    it('has widgets array', () => {
      expect(Array.isArray(CrmDashboard.widgets)).toBe(true);
      expect(CrmDashboard.widgets.length).toBeGreaterThan(0);
    });

    it('all widgets have type and layout', () => {
      for (const widget of CrmDashboard.widgets) {
        expect(widget).toHaveProperty('type');
        expect(widget).toHaveProperty('layout');
        expect(widget.layout).toHaveProperty('x');
        expect(widget.layout).toHaveProperty('y');
        expect(widget.layout).toHaveProperty('w');
        expect(widget.layout).toHaveProperty('h');
      }
    });

    it('all widgets have unique title', () => {
      const titles = CrmDashboard.widgets.map((w) => w.title);
      for (const title of titles) {
        expect(typeof title).toBe('string');
        expect(title!.length).toBeGreaterThan(0);
      }
      expect(new Set(titles).size).toBe(titles.length);
    });

    it('all widgets have title', () => {
      for (const widget of CrmDashboard.widgets) {
        expect(typeof widget.title).toBe('string');
        expect(widget.title!.length).toBeGreaterThan(0);
      }
    });

    it('metric widgets have title matching options.label', () => {
      const metrics = CrmDashboard.widgets.filter((w) => w.type === 'metric');
      for (const widget of metrics) {
        const opts = widget.options as { label?: string };
        expect(widget.title).toBe(opts.label);
      }
    });

    it('all widgets have object data binding', () => {
      for (const widget of CrmDashboard.widgets) {
        expect(typeof widget.object).toBe('string');
        expect(widget.object!.length).toBeGreaterThan(0);
      }
    });

    it('chart widgets have categoryField, valueField, and aggregate', () => {
      const chartTypes = ['bar', 'area', 'donut', 'line', 'pie'];
      const charts = CrmDashboard.widgets.filter((w) => chartTypes.includes(w.type));
      for (const widget of charts) {
        expect(typeof widget.categoryField).toBe('string');
        expect(typeof widget.valueField).toBe('string');
        expect(typeof widget.aggregate).toBe('string');
      }
    });
  });

  describe('Reports', () => {
    it('reports have name, label, and columns', () => {
      for (const report of [SalesReport, PipelineReport]) {
        expect(report).toHaveProperty('name');
        expect(report).toHaveProperty('label');
        expect(report).toHaveProperty('columns');
        expect(Array.isArray(report.columns)).toBe(true);
      }
    });
  });

  describe('Pages', () => {
    it('all pages have name, label, type, and regions', () => {
      for (const page of [GettingStartedPage, SettingsPage, HelpPage]) {
        expect(page).toHaveProperty('name');
        expect(page).toHaveProperty('label');
        expect(page).toHaveProperty('type');
        expect(page).toHaveProperty('regions');
        expect(['app', 'utility', 'record', 'home', 'dashboard']).toContain(page.type);
      }
    });
  });

  describe('App', () => {
    it('has name, label, description, and navigation', () => {
      expect(CrmApp).toHaveProperty('name');
      expect(CrmApp).toHaveProperty('label');
      expect(CrmApp).toHaveProperty('description');
      expect(CrmApp).toHaveProperty('navigation');
      expect(Array.isArray(CrmApp.navigation)).toBe(true);
    });

    it('navigation items have id, type, and label', () => {
      const items = CrmApp.navigation as Array<Record<string, unknown>>;
      for (const item of items) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('label');
      }
    });
  });
});

// ====================================================================
// 2. i18n Completeness Tests
// ====================================================================

const SUPPORTED_LOCALES = ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'ru', 'ar'] as const;
const enLocale = crmLocales.en;

/** Collect all leaf keys from a nested object as dot-separated paths */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Resolve a dot-path into a nested object */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

describe('CRM i18n Completeness', () => {
  it('all 10 locales are exported', () => {
    for (const code of SUPPORTED_LOCALES) {
      expect(crmLocales[code]).toBeDefined();
    }
  });

  it('all locales have top-level sections matching English', () => {
    const enTopKeys = Object.keys(enLocale).sort();
    for (const code of SUPPORTED_LOCALES) {
      const locale = crmLocales[code];
      const localeTopKeys = Object.keys(locale).sort();
      expect(localeTopKeys).toEqual(enTopKeys);
    }
  });

  it('all locales cover every key defined in the English locale', () => {
    const enKeys = collectKeys(enLocale as unknown as Record<string, unknown>);
    expect(enKeys.length).toBeGreaterThan(100);

    for (const code of SUPPORTED_LOCALES) {
      if (code === 'en') continue;
      const locale = crmLocales[code] as unknown as Record<string, unknown>;
      const missingKeys: string[] = [];
      for (const key of enKeys) {
        const val = resolvePath(locale, key);
        if (val === undefined) {
          missingKeys.push(key);
        }
      }
      expect(missingKeys).toEqual([]);
    }
  });

  it('all locales have non-empty string values for leaf keys', () => {
    for (const code of SUPPORTED_LOCALES) {
      const locale = crmLocales[code] as unknown as Record<string, unknown>;
      const leafKeys = collectKeys(locale);
      for (const key of leafKeys) {
        const val = resolvePath(locale, key);
        expect(typeof val).toBe('string');
        expect((val as string).length).toBeGreaterThan(0);
      }
    }
  });

  describe('Object labels coverage', () => {
    const objectNames = allObjects.map((o) => o.name);

    it('English locale has a label for every CRM object', () => {
      for (const name of objectNames) {
        const objectKey = name as keyof typeof enLocale.objects;
        expect(enLocale.objects[objectKey]).toBeDefined();
        expect(enLocale.objects[objectKey].label).toBeDefined();
      }
    });
  });

  describe('Navigation labels coverage', () => {
    it('English locale has all navigation labels', () => {
      const navKeys = Object.keys(enLocale.navigation);
      expect(navKeys.length).toBeGreaterThanOrEqual(17);
      expect(navKeys).toContain('dashboard');
      expect(navKeys).toContain('contacts');
      expect(navKeys).toContain('accounts');
      expect(navKeys).toContain('opportunities');
      expect(navKeys).toContain('pipeline');
      expect(navKeys).toContain('settings');
      expect(navKeys).toContain('help');
    });
  });

  describe('Action labels coverage', () => {
    it('English locale has a label for every CRM action', () => {
      for (const action of allActions) {
        const actionKey = action.name as keyof typeof enLocale.actions;
        expect(enLocale.actions[actionKey]).toBeDefined();
        expect(enLocale.actions[actionKey].label).toBeDefined();
      }
    });
  });

  describe('Dashboard widget labels coverage', () => {
    it('English locale has widget labels for all dashboard KPIs', () => {
      expect(enLocale.dashboard.widgets.totalRevenue).toBeDefined();
      expect(enLocale.dashboard.widgets.activeDeals).toBeDefined();
      expect(enLocale.dashboard.widgets.winRate).toBeDefined();
      expect(enLocale.dashboard.widgets.avgDealSize).toBeDefined();
      expect(enLocale.dashboard.widgets.revenueTrends).toBeDefined();
      expect(enLocale.dashboard.widgets.leadSource).toBeDefined();
      expect(enLocale.dashboard.widgets.pipelineByStage).toBeDefined();
      expect(enLocale.dashboard.widgets.topProducts).toBeDefined();
      expect(enLocale.dashboard.widgets.recentOpportunities).toBeDefined();
      expect(enLocale.dashboard.widgets.revenueByAccount).toBeDefined();
    });
  });
});
