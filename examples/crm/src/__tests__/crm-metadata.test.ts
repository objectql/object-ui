import { describe, it, expect } from 'vitest';

/** Resolve an I18nLabel (string or { key, defaultValue }) to a plain string for test assertions */
function resolveTitle(title: string | { key: string; defaultValue?: string } | undefined): string {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.defaultValue || title.key;
}

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

  describe('ProductView Airtable Parity', () => {
    const allProducts = ProductView.listViews.all_products;
    const activeProducts = ProductView.listViews.active_products;

    it('all_products uses detailed column configs with field, width, and type', () => {
      const cols = allProducts.columns as Array<Record<string, unknown>>;
      expect(cols.length).toBe(6);
      for (const col of cols) {
        expect(col).toHaveProperty('field');
        expect(col).toHaveProperty('width');
      }
    });

    it('is_active column has boolean type for Checkbox rendering', () => {
      const cols = allProducts.columns as Array<Record<string, unknown>>;
      const isActiveCol = cols.find((c) => c.field === 'is_active');
      expect(isActiveCol).toBeDefined();
      expect(isActiveCol!.type).toBe('boolean');
    });

    it('price column has currency type and right alignment', () => {
      const cols = allProducts.columns as Array<Record<string, unknown>>;
      const priceCol = cols.find((c) => c.field === 'price');
      expect(priceCol).toBeDefined();
      expect(priceCol!.type).toBe('currency');
      expect(priceCol!.align).toBe('right');
    });

    it('rowHeight is set to short for compact density', () => {
      expect(allProducts.rowHeight).toBe('short');
      expect(activeProducts.rowHeight).toBe('short');
    });

    it('SKU and CATEGORY columns are narrower than NAME', () => {
      const cols = allProducts.columns as Array<Record<string, unknown>>;
      const nameCol = cols.find((c) => c.field === 'name');
      const skuCol = cols.find((c) => c.field === 'sku');
      const catCol = cols.find((c) => c.field === 'category');
      expect((nameCol!.width as number)).toBeGreaterThan(skuCol!.width as number);
      expect((nameCol!.width as number)).toBeGreaterThan(catCol!.width as number);
    });

    it('has conditionalFormatting for stock=0 (red) and stock<5 (warning)', () => {
      const rules = allProducts.conditionalFormatting!;
      expect(rules.length).toBe(2);
      const zeroStock = rules.find((r: any) => r.condition?.includes('=== 0'));
      expect(zeroStock).toBeDefined();
      expect((zeroStock as any).style.backgroundColor).toBe('#fee2e2');
      const lowStock = rules.find((r: any) => r.condition?.includes('< 5'));
      expect(lowStock).toBeDefined();
      expect((lowStock as any).style.backgroundColor).toBe('#fef9c3');
    });

    it('active_products also uses detailed column configs', () => {
      const cols = activeProducts.columns as Array<Record<string, unknown>>;
      expect(cols.length).toBe(6);
      const priceCol = cols.find((c) => c.field === 'price');
      expect(priceCol!.type).toBe('currency');
      expect(priceCol!.align).toBe('right');
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
      const titles = CrmDashboard.widgets.map((w) => resolveTitle(w.title));
      for (const title of titles) {
        expect(typeof title).toBe('string');
        expect(title!.length).toBeGreaterThan(0);
      }
      expect(new Set(titles).size).toBe(titles.length);
    });

    it('all widgets have title', () => {
      for (const widget of CrmDashboard.widgets) {
        const title = resolveTitle(widget.title);
        expect(typeof title).toBe('string');
        expect(title!.length).toBeGreaterThan(0);
      }
    });

    it('metric widgets have title matching options.label', () => {
      const metrics = CrmDashboard.widgets.filter((w) => w.type === 'metric');
      for (const widget of metrics) {
        const opts = widget.options as { label?: string };
        expect(resolveTitle(widget.title)).toBe(opts.label);
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

    it('all chart widgets use provider: object for dynamic data', () => {
      const chartTypes = ['bar', 'area', 'donut', 'line', 'pie'];
      const charts = CrmDashboard.widgets.filter((w) => chartTypes.includes(w.type));
      expect(charts.length).toBeGreaterThanOrEqual(5);
      for (const widget of charts) {
        const data = (widget.options as any)?.data;
        expect(data).toBeDefined();
        expect(data.provider).toBe('object');
        expect(typeof data.object).toBe('string');
        expect(data.object.length).toBeGreaterThan(0);
      }
    });

    it('all chart widgets with provider: object have valid aggregate config', () => {
      const chartTypes = ['bar', 'area', 'donut', 'line', 'pie'];
      const charts = CrmDashboard.widgets.filter((w) => chartTypes.includes(w.type));
      for (const widget of charts) {
        const data = (widget.options as any)?.data;
        expect(data.aggregate).toBeDefined();
        expect(typeof data.aggregate.field).toBe('string');
        expect(typeof data.aggregate.function).toBe('string');
        expect(typeof data.aggregate.groupBy).toBe('string');
        expect(['sum', 'count', 'avg', 'min', 'max']).toContain(data.aggregate.function);
      }
    });

    it('table widget uses provider: object for dynamic data', () => {
      const tables = CrmDashboard.widgets.filter((w) => w.type === 'table');
      expect(tables.length).toBeGreaterThanOrEqual(1);
      for (const widget of tables) {
        const data = (widget.options as any)?.data;
        expect(data).toBeDefined();
        expect(data.provider).toBe('object');
        expect(typeof data.object).toBe('string');
      }
    });

    it('aggregate groupBy fields align with widget categoryField', () => {
      const chartTypes = ['bar', 'area', 'donut', 'line', 'pie'];
      const charts = CrmDashboard.widgets.filter((w) => chartTypes.includes(w.type));
      for (const widget of charts) {
        const data = (widget.options as any)?.data;
        if (data?.aggregate?.groupBy) {
          expect(data.aggregate.groupBy).toBe(widget.categoryField);
        }
      }
    });

    it('aggregate field names align with widget valueField', () => {
      const chartTypes = ['bar', 'area', 'donut', 'line', 'pie'];
      const charts = CrmDashboard.widgets.filter((w) => chartTypes.includes(w.type));
      for (const widget of charts) {
        const data = (widget.options as any)?.data;
        if (data?.aggregate?.field) {
          expect(data.aggregate.field).toBe(widget.valueField);
        }
      }
    });

    it('dashboard covers diverse aggregate functions (sum, count, avg, max)', () => {
      const chartTypes = ['bar', 'area', 'donut', 'line', 'pie'];
      const charts = CrmDashboard.widgets.filter((w) => chartTypes.includes(w.type));
      const aggFns = new Set(charts.map((w) => (w.options as any)?.data?.aggregate?.function));
      expect(aggFns.has('sum')).toBe(true);
      expect(aggFns.has('count')).toBe(true);
      expect(aggFns.has('avg')).toBe(true);
      expect(aggFns.has('max')).toBe(true);
    });

    it('dashboard includes cross-object widgets (order)', () => {
      const orderWidgets = CrmDashboard.widgets.filter((w) => w.object === 'order');
      expect(orderWidgets.length).toBeGreaterThanOrEqual(1);
      const data = (orderWidgets[0].options as any)?.data;
      expect(data.provider).toBe('object');
      expect(data.object).toBe('order');
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

  // ------------------------------------------------------------------
  // Enterprise Lookup Field Configuration
  // ------------------------------------------------------------------

  describe('Enterprise Lookup Metadata', () => {
    /** Extract all lookup fields from an object definition */
    function getLookupFields(obj: Record<string, any>): Array<[string, Record<string, any>]> {
      return Object.entries(obj.fields).filter(
        ([, f]: [string, any]) => f.type === 'lookup' || f.type === 'master_detail',
      ) as Array<[string, Record<string, any>]>;
    }

    it('every CRM lookup field has lookup_columns configured', () => {
      for (const obj of allObjects) {
        const lookups = getLookupFields(obj);
        for (const [fieldName, field] of lookups) {
          expect(field.lookup_columns, `${obj.name}.${fieldName} missing lookup_columns`).toBeDefined();
          expect(Array.isArray(field.lookup_columns)).toBe(true);
          expect(field.lookup_columns.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('every CRM lookup field has lookup_filters configured', () => {
      for (const obj of allObjects) {
        const lookups = getLookupFields(obj);
        for (const [fieldName, field] of lookups) {
          expect(field.lookup_filters, `${obj.name}.${fieldName} missing lookup_filters`).toBeDefined();
          expect(Array.isArray(field.lookup_filters)).toBe(true);
          expect(field.lookup_filters.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('every CRM lookup field has description_field configured', () => {
      for (const obj of allObjects) {
        const lookups = getLookupFields(obj);
        for (const [fieldName, field] of lookups) {
          expect(field.description_field, `${obj.name}.${fieldName} missing description_field`).toBeDefined();
          expect(typeof field.description_field).toBe('string');
        }
      }
    });

    it('lookup_columns include at least one column with a type hint for cell rendering', () => {
      for (const obj of allObjects) {
        const lookups = getLookupFields(obj);
        for (const [fieldName, field] of lookups) {
          const cols = field.lookup_columns as Array<string | Record<string, any>>;
          const typedCols = cols.filter(
            (c) => typeof c === 'object' && c.type,
          );
          expect(
            typedCols.length,
            `${obj.name}.${fieldName} has no typed columns for cell rendering`,
          ).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('lookup_columns cover diverse cell types (select, currency, boolean, date)', () => {
      const allTypedColumns: string[] = [];
      for (const obj of allObjects) {
        const lookups = getLookupFields(obj);
        for (const [, field] of lookups) {
          const cols = field.lookup_columns as Array<string | Record<string, any>>;
          for (const c of cols) {
            if (typeof c === 'object' && c.type) {
              allTypedColumns.push(c.type);
            }
          }
        }
      }
      const uniqueTypes = new Set(allTypedColumns);
      expect(uniqueTypes.has('select')).toBe(true);
      expect(uniqueTypes.has('currency')).toBe(true);
      expect(uniqueTypes.has('boolean')).toBe(true);
      expect(uniqueTypes.has('date')).toBe(true);
    });

    it('lookup_filters have valid operator values', () => {
      const validOperators = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'in', 'notIn'];
      for (const obj of allObjects) {
        const lookups = getLookupFields(obj);
        for (const [fieldName, field] of lookups) {
          for (const filter of field.lookup_filters) {
            expect(filter).toHaveProperty('field');
            expect(filter).toHaveProperty('operator');
            expect(filter).toHaveProperty('value');
            expect(
              validOperators,
              `${obj.name}.${fieldName} filter operator "${filter.operator}" invalid`,
            ).toContain(filter.operator);
          }
        }
      }
    });

    it('lookup_filters cover diverse operators (eq, ne, in, notIn)', () => {
      const allOperators: string[] = [];
      for (const obj of allObjects) {
        const lookups = getLookupFields(obj);
        for (const [, field] of lookups) {
          for (const filter of field.lookup_filters) {
            allOperators.push(filter.operator);
          }
        }
      }
      const uniqueOps = new Set(allOperators);
      expect(uniqueOps.has('eq')).toBe(true);
      expect(uniqueOps.has('in')).toBe(true);
      expect(uniqueOps.has('notIn')).toBe(true);
      expect(uniqueOps.has('ne')).toBe(true);
    });

    it('account.owner references user with active-only filter', () => {
      const owner = (AccountObject.fields as any).owner;
      expect(owner.reference).toBe('user');
      expect(owner.description_field).toBe('email');
      expect(owner.lookup_filters).toEqual([{ field: 'active', operator: 'eq', value: true }]);
    });

    it('opportunity.account references account with type filter', () => {
      const account = (OpportunityObject.fields as any).account;
      expect(account.reference).toBe('account');
      expect(account.description_field).toBe('industry');
      const typeFilter = account.lookup_filters.find((f: any) => f.field === 'type');
      expect(typeFilter).toBeDefined();
      expect(typeFilter.operator).toBe('in');
      expect(typeFilter.value).toContain('Customer');
    });

    it('order_item.product filters active products only', () => {
      const product = (OrderItemObject.fields as any).product;
      expect(product.reference).toBe('product');
      expect(product.description_field).toBe('sku');
      expect(product.lookup_filters).toEqual([{ field: 'is_active', operator: 'eq', value: true }]);
      const cols = product.lookup_columns as Array<Record<string, any>>;
      expect(cols.find((c) => c.field === 'price')?.type).toBe('currency');
      expect(cols.find((c) => c.field === 'stock')?.type).toBe('number');
      expect(cols.find((c) => c.field === 'is_active')?.type).toBe('boolean');
    });

    it('opportunity_contact.opportunity filters out closed stages', () => {
      const opp = (OpportunityContactObject.fields as any).opportunity;
      expect(opp.reference).toBe('opportunity');
      const stageFilter = opp.lookup_filters.find((f: any) => f.field === 'stage');
      expect(stageFilter).toBeDefined();
      expect(stageFilter.operator).toBe('notIn');
      expect(stageFilter.value).toContain('closed_won');
      expect(stageFilter.value).toContain('closed_lost');
    });

    it('opportunity.contacts has lookup_page_size for multi-select', () => {
      const contacts = (OpportunityObject.fields as any).contacts;
      expect(contacts.lookup_page_size).toBe(15);
    });
  });

  // ------------------------------------------------------------------
  // Enterprise Query Parameter Injection & Filter Bar Integration
  // ------------------------------------------------------------------

  describe('Enterprise Query Parameter & Filter Bar Compatibility', () => {
    /**
     * Simulate RecordPickerDialog's lookupFiltersToRecord conversion.
     * This mirrors the internal function in RecordPickerDialog.tsx to verify
     * that CRM metadata produces correct $filter query parameters.
     */
    function lookupFiltersToRecord(
      filters: Array<{ field: string; operator: string; value: unknown }>,
    ): Record<string, any> {
      const result: Record<string, any> = {};
      for (const f of filters) {
        switch (f.operator) {
          case 'eq': result[f.field] = f.value; break;
          case 'ne': result[f.field] = { $ne: f.value }; break;
          case 'gt': result[f.field] = { $gt: f.value }; break;
          case 'lt': result[f.field] = { $lt: f.value }; break;
          case 'gte': result[f.field] = { $gte: f.value }; break;
          case 'lte': result[f.field] = { $lte: f.value }; break;
          case 'contains': result[f.field] = { $contains: f.value }; break;
          case 'in': result[f.field] = { $in: f.value }; break;
          case 'notIn': result[f.field] = { $nin: f.value }; break;
        }
      }
      return result;
    }

    /**
     * Simulate LookupField's mapFieldTypeToFilterType conversion.
     * This mirrors the internal function in LookupField.tsx to verify
     * CRM lookup_columns produce valid filter bar configurations.
     */
    function mapFieldTypeToFilterType(fieldType: string): string | undefined {
      const mapping: Record<string, string> = {
        text: 'text', number: 'number', currency: 'number',
        percent: 'number', select: 'select', status: 'select',
        date: 'date', datetime: 'date', boolean: 'boolean',
      };
      return mapping[fieldType];
    }

    it('account.owner lookup_filters produce correct $filter for active users', () => {
      const owner = (AccountObject.fields as any).owner;
      const $filter = lookupFiltersToRecord(owner.lookup_filters);
      expect($filter).toEqual({ active: true });
    });

    it('contact.account lookup_filters produce $in for type restriction', () => {
      const account = (ContactObject.fields as any).account;
      const $filter = lookupFiltersToRecord(account.lookup_filters);
      expect($filter).toEqual({ type: { $in: ['Customer', 'Partner'] } });
    });

    it('order_item.order lookup_filters produce $ne for cancelled exclusion', () => {
      const order = (OrderItemObject.fields as any).order;
      const $filter = lookupFiltersToRecord(order.lookup_filters);
      expect($filter).toEqual({ status: { $ne: 'cancelled' } });
    });

    it('opportunity_contact.opportunity lookup_filters produce $nin for closed stages', () => {
      const opp = (OpportunityContactObject.fields as any).opportunity;
      const $filter = lookupFiltersToRecord(opp.lookup_filters);
      expect($filter).toEqual({ stage: { $nin: ['closed_won', 'closed_lost'] } });
    });

    it('typed lookup_columns produce valid filter bar configurations', () => {
      const product = (OrderItemObject.fields as any).product;
      const cols = product.lookup_columns as Array<{ field: string; type?: string; label?: string }>;

      const filterColumns = cols
        .filter((c) => c.type)
        .map((c) => ({
          field: c.field,
          label: c.label,
          type: mapFieldTypeToFilterType(c.type!),
        }))
        .filter((c) => c.type !== undefined);

      // Product lookup should produce filter bar entries for select, currency(→number), number, boolean
      expect(filterColumns.length).toBeGreaterThanOrEqual(3);
      const types = filterColumns.map((c) => c.type);
      expect(types).toContain('select');   // category
      expect(types).toContain('number');   // price, stock
      expect(types).toContain('boolean');  // is_active
    });

    it('opportunity.account typed columns map to valid filter bar types', () => {
      const account = (OpportunityObject.fields as any).account;
      const cols = account.lookup_columns as Array<{ field: string; type?: string }>;

      const filterTypes = cols
        .filter((c) => c.type)
        .map((c) => mapFieldTypeToFilterType(c.type!))
        .filter(Boolean);

      // account columns have select + currency(→number) types
      expect(filterTypes).toContain('select');
      expect(filterTypes).toContain('number');
    });

    it('all CRM lookup_filters convert to valid $filter records without errors', () => {
      for (const obj of allObjects) {
        const lookups = Object.entries(obj.fields).filter(
          ([, f]: [string, any]) => f.type === 'lookup' || f.type === 'master_detail',
        );
        for (const [fieldName, field] of lookups) {
          const f = field as any;
          if (!f.lookup_filters) continue;
          const $filter = lookupFiltersToRecord(f.lookup_filters);
          expect(
            Object.keys($filter).length,
            `${obj.name}.${fieldName} lookup_filters produced empty $filter`,
          ).toBeGreaterThan(0);
        }
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
      expect(enLocale.dashboard.widgets.avgDealSizeByStage).toBeDefined();
      expect(enLocale.dashboard.widgets.ordersByStatus).toBeDefined();
    });
  });
});
