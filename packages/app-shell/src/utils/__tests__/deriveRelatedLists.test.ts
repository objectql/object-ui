import { describe, it, expect } from 'vitest';
import { deriveRelatedLists } from '../deriveRelatedLists';

const project = { name: 'project', label: 'Project', fields: { name: { type: 'text' } } };

describe('deriveRelatedLists', () => {
  it('returns [] for missing object or empty registry', () => {
    expect(deriveRelatedLists(undefined, [])).toEqual([]);
    expect(deriveRelatedLists(project, [])).toEqual([]);
    expect(deriveRelatedLists(project, null as any)).toEqual([]);
  });

  it('derives a related list from a master_detail child (owned)', () => {
    const task = {
      name: 'task',
      label: 'Task',
      fields: { project: { type: 'master_detail', reference: 'project' } },
    };
    const out = deriveRelatedLists(project, [project, task]);
    expect(out).toEqual([
      {
        childObject: 'task',
        childLabel: 'Task',
        referenceField: 'project',
        isOwned: true,
      },
    ]);
  });

  it('derives a related list from a lookup child', () => {
    const note = {
      name: 'note',
      label: 'Note',
      fields: { project_id: { type: 'lookup', reference: 'project' } },
    };
    const out = deriveRelatedLists(project, [project, note]);
    expect(out[0]).toMatchObject({ childObject: 'note', referenceField: 'project_id', isOwned: false });
  });

  it('supports reference_to as well as reference', () => {
    const task = {
      name: 'task',
      fields: { project: { type: 'master_detail', reference_to: 'project' } },
    };
    const out = deriveRelatedLists(project, [project, task]);
    expect(out).toHaveLength(1);
    expect(out[0].childObject).toBe('task');
  });

  it('orders owned (master_detail) children before lookup children', () => {
    const note = { name: 'note', fields: { project_id: { type: 'lookup', reference: 'project' } } };
    const task = { name: 'task', fields: { project: { type: 'master_detail', reference: 'project' } } };
    // note declared before task, but task is owned → owned wins ordering
    const out = deriveRelatedLists(project, [project, note, task]);
    expect(out.map((r) => r.childObject)).toEqual(['task', 'note']);
  });

  it('suppresses a child when relatedList === false', () => {
    const task = {
      name: 'task',
      fields: { project: { type: 'master_detail', reference: 'project', relatedList: false } },
    };
    expect(deriveRelatedLists(project, [project, task])).toEqual([]);
  });

  it('skips audit FKs (created_by/updated_by/owner_id)', () => {
    const log = {
      name: 'log',
      fields: {
        created_by: { type: 'lookup', reference: 'project' },
        owner_id: { type: 'lookup', reference: 'project' },
      },
    };
    expect(deriveRelatedLists(project, [project, log])).toEqual([]);
  });

  it('carries relatedListTitle and relatedListColumns overrides', () => {
    const task = {
      name: 'task',
      label: 'Task',
      fields: {
        project: {
          type: 'master_detail',
          reference: 'project',
          relatedListTitle: 'Project Tasks',
          relatedListColumns: ['name', 'status'],
        },
      },
    };
    const out = deriveRelatedLists(project, [project, task]);
    expect(out[0]).toMatchObject({
      title: 'Project Tasks',
      columns: ['name', 'status'],
    });
  });

  it('dedupes to one related list per child object (first eligible FK wins)', () => {
    const assignment = {
      name: 'assignment',
      fields: {
        project: { type: 'master_detail', reference: 'project' },
        secondary_project: { type: 'lookup', reference: 'project' },
      },
    };
    const out = deriveRelatedLists(project, [project, assignment]);
    expect(out).toHaveLength(1);
    expect(out[0].referenceField).toBe('project');
  });

  it('skips a suppressed FK but still considers a sibling FK on the same child', () => {
    const assignment = {
      name: 'assignment',
      fields: {
        legacy_project: { type: 'lookup', reference: 'project', relatedList: false },
        project: { type: 'master_detail', reference: 'project' },
      },
    };
    const out = deriveRelatedLists(project, [project, assignment]);
    expect(out).toHaveLength(1);
    expect(out[0].referenceField).toBe('project');
  });

  it('ignores unrelated objects and self-references', () => {
    const other = { name: 'other', fields: { foo: { type: 'lookup', reference: 'somethingelse' } } };
    const selfRef = { name: 'project', fields: { parent: { type: 'tree', reference: 'project' } } };
    expect(deriveRelatedLists(project, [project, other, selfRef])).toEqual([]);
  });

  it('handles array-shaped fields', () => {
    const task = {
      name: 'task',
      label: 'Task',
      fields: [{ name: 'project', type: 'master_detail', reference: 'project' }],
    };
    const out = deriveRelatedLists(project, [project, task]);
    expect(out[0]).toMatchObject({ childObject: 'task', referenceField: 'project', isOwned: true });
  });
});
