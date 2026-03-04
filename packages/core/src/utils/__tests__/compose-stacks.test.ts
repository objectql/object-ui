/**
 * Tests for composeStacks utility
 *
 * Validates that composeStacks correctly merges multiple stack definitions:
 * - Concatenates arrays (objects, views, actions, apps, dashboards, reports, pages)
 * - Handles duplicate object names via objectConflict option
 * - Merges listViews from views into objects
 * - Merges actions into objects via objectName field
 * - Merges manifest.data arrays
 */
import { describe, it, expect } from 'vitest';
import { composeStacks } from '../compose-stacks';

describe('composeStacks', () => {
  // ── Basic merging ─────────────────────────────────────────────────────

  it('should merge objects from multiple stacks', () => {
    const a = { objects: [{ name: 'account', label: 'Account', fields: {} }] };
    const b = { objects: [{ name: 'contact', label: 'Contact', fields: {} }] };

    const result = composeStacks([a, b]);
    expect(result.objects).toHaveLength(2);
    expect(result.objects.map((o: any) => o.name)).toEqual(['account', 'contact']);
  });

  it('should merge arrays (apps, dashboards, reports, pages, views)', () => {
    const a = {
      apps: [{ name: 'app_a' }],
      dashboards: [{ name: 'dash_a' }],
      reports: [{ name: 'report_a' }],
      pages: [{ name: 'page_a' }],
      views: [{ listViews: {} }],
    };
    const b = {
      apps: [{ name: 'app_b' }],
      dashboards: [{ name: 'dash_b' }],
      reports: [{ name: 'report_b' }],
      pages: [{ name: 'page_b' }],
      views: [{ listViews: {} }],
    };

    const result = composeStacks([a, b]);
    expect(result.apps).toHaveLength(2);
    expect(result.dashboards).toHaveLength(2);
    expect(result.reports).toHaveLength(2);
    expect(result.pages).toHaveLength(2);
    expect(result.views).toHaveLength(2);
  });

  it('should merge manifest.data from multiple stacks', () => {
    const a = { manifest: { data: [{ object: 'account', mode: 'upsert', records: [] }] } };
    const b = { manifest: { data: [{ object: 'contact', mode: 'upsert', records: [] }] } };

    const result = composeStacks([a, b]);
    expect(result.manifest.data).toHaveLength(2);
    expect(result.manifest.data[0].object).toBe('account');
    expect(result.manifest.data[1].object).toBe('contact');
  });

  it('should handle empty stacks gracefully', () => {
    const result = composeStacks([{}, {}]);
    expect(result.objects).toEqual([]);
    expect(result.apps).toEqual([]);
    expect(result.manifest.data).toEqual([]);
  });

  // ── Object deduplication ──────────────────────────────────────────────

  it('should override duplicate objects by default (last wins)', () => {
    const a = { objects: [{ name: 'account', label: 'CRM Account', fields: { name: {} } }] };
    const b = { objects: [{ name: 'account', label: 'KS Account', fields: { name: {} } }] };

    const result = composeStacks([a, b]);
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].label).toBe('KS Account');
  });

  it('should throw on duplicate objects when objectConflict is "error"', () => {
    const a = { objects: [{ name: 'account', label: 'CRM Account', fields: {} }] };
    const b = { objects: [{ name: 'account', label: 'KS Account', fields: {} }] };

    expect(() => composeStacks([a, b], { objectConflict: 'error' })).toThrow(
      'duplicate object name "account"'
    );
  });

  // ── Views → Objects merging ───────────────────────────────────────────

  it('should merge listViews from views into corresponding objects', () => {
    const stack = {
      objects: [{ name: 'todo_task', label: 'Task', fields: {} }],
      views: [
        {
          listViews: {
            all: {
              name: 'all',
              label: 'All Tasks',
              type: 'grid',
              data: { provider: 'object', object: 'todo_task' },
            },
            board: {
              name: 'board',
              label: 'Board',
              type: 'kanban',
              data: { provider: 'object', object: 'todo_task' },
            },
          },
        },
      ],
    };

    const result = composeStacks([stack]);
    const taskObj = result.objects.find((o: any) => o.name === 'todo_task');
    expect(taskObj.listViews).toBeDefined();
    expect(taskObj.listViews.all.label).toBe('All Tasks');
    expect(taskObj.listViews.board.label).toBe('Board');
  });

  it('should not overwrite existing listViews on objects', () => {
    const stack = {
      objects: [
        {
          name: 'todo_task',
          label: 'Task',
          fields: {},
          listViews: { existing: { name: 'existing', label: 'Existing View', type: 'grid', data: { provider: 'object', object: 'todo_task' } } },
        },
      ],
      views: [
        {
          listViews: {
            new_view: {
              name: 'new_view',
              label: 'New View',
              type: 'grid',
              data: { provider: 'object', object: 'todo_task' },
            },
          },
        },
      ],
    };

    const result = composeStacks([stack]);
    const taskObj = result.objects.find((o: any) => o.name === 'todo_task');
    expect(taskObj.listViews.existing).toBeDefined();
    expect(taskObj.listViews.new_view).toBeDefined();
  });

  // ── Actions → Objects merging ─────────────────────────────────────────

  it('should merge actions into objects via objectName', () => {
    const stack = {
      objects: [{ name: 'account', label: 'Account', fields: {} }],
      actions: [
        { name: 'account_send_email', objectName: 'account', label: 'Send Email' },
        { name: 'account_merge', objectName: 'account', label: 'Merge' },
      ],
    };

    const result = composeStacks([stack]);
    const accountObj = result.objects.find((o: any) => o.name === 'account');
    expect(accountObj.actions).toHaveLength(2);
    expect(accountObj.actions[0].label).toBe('Send Email');
    expect(accountObj.actions[1].label).toBe('Merge');
  });

  it('should not merge actions that lack objectName', () => {
    const stack = {
      objects: [{ name: 'account', label: 'Account', fields: {} }],
      actions: [
        { name: 'orphan_action', label: 'No Target' },
      ],
    };

    const result = composeStacks([stack]);
    const accountObj = result.objects.find((o: any) => o.name === 'account');
    expect(accountObj.actions).toBeUndefined();
  });

  it('should append to existing actions on objects', () => {
    const stack = {
      objects: [
        { name: 'account', label: 'Account', fields: {}, actions: [{ name: 'existing', label: 'Existing' }] },
      ],
      actions: [
        { name: 'account_new', objectName: 'account', label: 'New Action' },
      ],
    };

    const result = composeStacks([stack]);
    const accountObj = result.objects.find((o: any) => o.name === 'account');
    expect(accountObj.actions).toHaveLength(2);
    expect(accountObj.actions[0].label).toBe('Existing');
    expect(accountObj.actions[1].label).toBe('New Action');
  });

  // ── Cross-stack merging ───────────────────────────────────────────────

  it('should merge actions from one stack into objects from another', () => {
    const objectStack = { objects: [{ name: 'contact', label: 'Contact', fields: {} }] };
    const actionStack = {
      actions: [
        { name: 'contact_send_email', objectName: 'contact', label: 'Send Email' },
      ],
    };

    const result = composeStacks([objectStack, actionStack]);
    const contactObj = result.objects.find((o: any) => o.name === 'contact');
    expect(contactObj.actions).toHaveLength(1);
  });

  // ── Integration: CRM + Todo + Kitchen Sink pattern ────────────────────

  it('should compose three example-like stacks without conflict', () => {
    const crm = {
      objects: [
        { name: 'account', label: 'Account', fields: {} },
        { name: 'contact', label: 'Contact', fields: {} },
      ],
      views: [{
        listViews: {
          all_accounts: { name: 'all_accounts', label: 'All Accounts', type: 'grid', data: { provider: 'object', object: 'account' } },
        },
      }],
      actions: [
        { name: 'account_send_email', objectName: 'account', label: 'Send Email' },
        { name: 'contact_log_call', objectName: 'contact', label: 'Log Call' },
      ],
      apps: [{ name: 'crm_app' }],
      manifest: { data: [{ object: 'account', mode: 'upsert', records: [{ name: 'Acme' }] }] },
    };

    const todo = {
      objects: [{ name: 'todo_task', label: 'Task', fields: {} }],
      views: [{
        listViews: {
          all: { name: 'all', label: 'All Tasks', type: 'grid', data: { provider: 'object', object: 'todo_task' } },
        },
      }],
      actions: [
        { name: 'todo_task_complete', objectName: 'todo_task', label: 'Complete' },
      ],
      apps: [{ name: 'todo_app' }],
      manifest: { data: [{ object: 'todo_task', mode: 'upsert', records: [{ subject: 'Test' }] }] },
    };

    const ks = {
      objects: [
        { name: 'ks_account', label: 'Account', fields: {} },
        { name: 'showcase', label: 'Showcase', fields: {} },
      ],
      actions: [
        { name: 'showcase_archive', objectName: 'showcase', label: 'Archive' },
      ],
      apps: [{ name: 'showcase_app' }],
    };

    const result = composeStacks([crm, todo, ks]);

    // No duplicate account objects — CRM has 'account', KS has 'ks_account'
    expect(result.objects).toHaveLength(5);
    expect(result.objects.map((o: any) => o.name).sort()).toEqual([
      'account', 'contact', 'ks_account', 'showcase', 'todo_task',
    ]);

    // Actions merged correctly
    const account = result.objects.find((o: any) => o.name === 'account');
    expect(account.actions).toHaveLength(1);
    expect(account.listViews.all_accounts).toBeDefined();

    const task = result.objects.find((o: any) => o.name === 'todo_task');
    expect(task.actions).toHaveLength(1);
    expect(task.listViews.all).toBeDefined();

    const showcase = result.objects.find((o: any) => o.name === 'showcase');
    expect(showcase.actions).toHaveLength(1);

    // Apps merged
    expect(result.apps).toHaveLength(3);

    // Manifest data merged
    expect(result.manifest.data).toHaveLength(2);
  });

  it('should detect conflicting object names with objectConflict: "error"', () => {
    // Simulates a scenario where two plugins define 'account' without prefixing
    const crm = {
      objects: [{ name: 'account', label: 'CRM Account', fields: {} }],
    };
    const ks = {
      objects: [{ name: 'account', label: 'KS Account', fields: {} }],
    };

    expect(() => composeStacks([crm, ks], { objectConflict: 'error' })).toThrow(
      'duplicate object name "account"'
    );
  });

  it('should allow prefixed object names to coexist without conflict', () => {
    // After renaming: CRM keeps 'account', Kitchen Sink uses 'ks_account'
    const crm = {
      objects: [{ name: 'account', label: 'CRM Account', fields: {} }],
    };
    const ks = {
      objects: [{ name: 'ks_account', label: 'KS Account', fields: {} }],
    };

    const result = composeStacks([crm, ks], { objectConflict: 'error' });
    expect(result.objects).toHaveLength(2);
    expect(result.objects.map((o: any) => o.name).sort()).toEqual(['account', 'ks_account']);
  });
});
