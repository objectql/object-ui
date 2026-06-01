// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ObjectFormCanvas } from './ObjectFormCanvas';

afterEach(cleanup);

/** Draft with three fields, two declared sections (one empty). */
function draftWithGroups() {
  return {
    name: 'account',
    fields: {
      first_name: { type: 'text', label: 'First Name', group: 'profile', required: true },
      email: { type: 'email', label: 'Email', group: 'profile' },
      notes: { type: 'textarea', label: 'Notes' }, // ungrouped
    },
    fieldGroups: [
      { key: 'profile', label: 'Profile' },
      { key: 'meta', label: 'Metadata' }, // declared but empty
    ],
  };
}

describe('ObjectFormCanvas — review toolbar', () => {
  it('summarizes field / required / section counts', () => {
    const { container } = render(
      <ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={vi.fn()} />,
    );
    // 3 fields · 1 required · 2 sections
    const text = container.textContent ?? '';
    expect(text).toMatch(/3\s*fields/);
    expect(text).toMatch(/1\s*required/);
    expect(text).toMatch(/2\s*sections/);
  });
});

describe('ObjectFormCanvas — section rendering', () => {
  it('renders declared sections (incl. empty) while editing, with the empty-section hint', () => {
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={vi.fn()} />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Ungrouped')).toBeInTheDocument();
    // The empty "Metadata" section advertises itself as a drop target.
    expect(screen.getByText('Drag fields here, or add one below')).toBeInTheDocument();
  });

  it('hides the empty-declared section and group chrome when read-only (no onPatch)', () => {
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    // Empty declared group is dropped in read-only mode.
    expect(screen.queryByText('Metadata')).not.toBeInTheDocument();
    // No authoring affordances.
    expect(screen.queryByText('Add section')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove section' })).not.toBeInTheDocument();
  });

  it('renders a flat list (no headers) when no groups are declared', () => {
    const draft = { name: 'x', fields: { a: { type: 'text', label: 'A' } } };
    render(<ObjectFormCanvas objectName="x" draft={draft} onPatch={vi.fn()} />);
    expect(screen.queryByText('Ungrouped')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse section' })).not.toBeInTheDocument();
  });
});

describe('ObjectFormCanvas — section operations', () => {
  it('Add section appends a new fieldGroup via onPatch', () => {
    const onPatch = vi.fn();
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={onPatch} />);
    fireEvent.click(screen.getByText('Add section'));
    expect(onPatch).toHaveBeenCalledTimes(1);
    const patch = onPatch.mock.calls[0][0];
    expect(patch.fieldGroups).toHaveLength(3);
    expect(patch.fieldGroups[2]).toMatchObject({ label: 'Section 3' });
  });

  it('Remove section drops the group AND clears member fields’ group', () => {
    const onPatch = vi.fn();
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={onPatch} />);
    // Profile is the first removable section.
    const removeBtns = screen.getAllByRole('button', { name: 'Remove section' });
    fireEvent.click(removeBtns[0]);
    const patch = onPatch.mock.calls[0][0];
    expect(patch.fieldGroups.map((g: any) => g.key)).toEqual(['meta']);
    // first_name / email lose their group; fields payload is a record (input shape).
    expect(patch.fields.first_name.group).toBeUndefined();
    expect(patch.fields.email.group).toBeUndefined();
    expect(patch.fields.notes).toBeDefined();
  });

  it('move-up is disabled for the first section, enabled for later ones', () => {
    const onPatch = vi.fn();
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={onPatch} />);
    const upButtons = screen.getAllByRole('button', { name: 'Move section up' });
    // First declared group (Profile) cannot move up.
    expect(upButtons[0]).toBeDisabled();
    // Second declared group (Metadata) can.
    expect(upButtons[1]).not.toBeDisabled();
    fireEvent.click(upButtons[1]);
    expect(onPatch.mock.calls[0][0].fieldGroups.map((g: any) => g.key)).toEqual(['meta', 'profile']);
  });
});

describe('ObjectFormCanvas — collapse', () => {
  it('collapsing a section hides its field rows', () => {
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={vi.fn()} />);
    expect(screen.getByText('First Name')).toBeInTheDocument();
    const collapseButtons = screen.getAllByRole('button', { name: 'Collapse section' });
    fireEvent.click(collapseButtons[0]); // collapse Profile
    expect(screen.queryByText('First Name')).not.toBeInTheDocument();
    // Header stays.
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('Collapse all toggles every section, then Expand all restores them', () => {
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={vi.fn()} />);
    fireEvent.click(screen.getByText('Collapse all'));
    expect(screen.queryByText('First Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Expand all'));
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });
});

describe('ObjectFormCanvas — inline section rename', () => {
  it('commits a renamed section label via onPatch', () => {
    const onPatch = vi.fn();
    render(<ObjectFormCanvas objectName="account" draft={draftWithGroups()} onPatch={onPatch} />);
    fireEvent.doubleClick(screen.getByText('Profile'));
    const input = screen.getByDisplayValue('Profile') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Contact' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(patch.fieldGroups.find((g: any) => g.key === 'profile').label).toBe('Contact');
  });
});

describe('ObjectFormCanvas — empty state', () => {
  it('shows the empty canvas + a single Add field affordance', () => {
    render(<ObjectFormCanvas objectName="x" draft={{ name: 'x', fields: {} }} onPatch={vi.fn()} />);
    expect(screen.getByText('No fields yet')).toBeInTheDocument();
    // No toolbar / sections when there are zero fields.
    expect(screen.queryByText('fields')).not.toBeInTheDocument();
  });
});
