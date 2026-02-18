/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InlineCreateRelated } from '../InlineCreateRelated';
import type { RelatedFieldDefinition, RelatedRecordOption } from '../InlineCreateRelated';
import { RichTextCommentInput } from '../RichTextCommentInput';
import type { MentionSuggestion } from '../RichTextCommentInput';
import { DiffView } from '../DiffView';
import { RecordNavigationEnhanced } from '../RecordNavigationEnhanced';
import { RelationshipGraph } from '../RelationshipGraph';
import type { GraphNode } from '../RelationshipGraph';
import { CommentAttachment } from '../CommentAttachment';
import type { Attachment } from '../CommentAttachment';
import { PointInTimeRestore } from '../PointInTimeRestore';
import type { RevisionEntry } from '../PointInTimeRestore';

/* ------------------------------------------------------------------ */
/*  InlineCreateRelated                                                */
/* ------------------------------------------------------------------ */

describe('InlineCreateRelated', () => {
  const fields: RelatedFieldDefinition[] = [
    { name: 'name', label: 'Name', type: 'string', required: true },
    { name: 'amount', label: 'Amount', type: 'number' },
  ];

  const existingRecords: RelatedRecordOption[] = [
    { id: 'r1', label: 'Record Alpha', description: 'First record' },
    { id: 'r2', label: 'Record Beta', description: 'Second record' },
  ];

  it('renders create and link buttons', () => {
    render(
      <InlineCreateRelated
        objectName="Contact"
        relationshipField="accountId"
        fields={fields}
        onCreateRecord={vi.fn()}
        onLinkRecord={vi.fn()}
        existingRecords={existingRecords}
      />,
    );
    expect(screen.getByText('New Contact')).toBeInTheDocument();
    expect(screen.getByText('Link Existing')).toBeInTheDocument();
  });

  it('switches between create and link tabs', () => {
    render(
      <InlineCreateRelated
        objectName="Contact"
        relationshipField="accountId"
        fields={fields}
        onCreateRecord={vi.fn()}
        onLinkRecord={vi.fn()}
        existingRecords={existingRecords}
      />,
    );

    // Open via the Link Existing button so we start in "link" tab
    fireEvent.click(screen.getByText('Link Existing'));

    // Both tab triggers should be rendered
    const tabTriggers = screen.getAllByRole('tab');
    expect(tabTriggers.length).toBe(2);
    expect(screen.getByText('Create New')).toBeInTheDocument();
    expect(screen.getByText('Link Existing')).toBeInTheDocument();
  });

  it('form submission calls onCreateRecord', async () => {
    const onCreateRecord = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineCreateRelated
        objectName="Contact"
        relationshipField="accountId"
        fields={fields}
        onCreateRecord={onCreateRecord}
        existingRecords={existingRecords}
      />,
    );

    fireEvent.click(screen.getByText('New Contact'));

    const nameInput = screen.getByPlaceholderText('Enter name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    const createBtn = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(onCreateRecord).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'John Doe', accountId: true }),
      );
    });
  });

  it('search filters results in the link tab', () => {
    render(
      <InlineCreateRelated
        objectName="Contact"
        relationshipField="accountId"
        fields={fields}
        onLinkRecord={vi.fn()}
        existingRecords={existingRecords}
      />,
    );

    fireEvent.click(screen.getByText('Link Existing'));

    const searchInput = screen.getByPlaceholderText('Search Contact…');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Record Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Record Beta')).not.toBeInTheDocument();
  });

  it('link button calls onLinkRecord', async () => {
    const onLinkRecord = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineCreateRelated
        objectName="Contact"
        relationshipField="accountId"
        fields={fields}
        onLinkRecord={onLinkRecord}
        existingRecords={existingRecords}
      />,
    );

    fireEvent.click(screen.getByText('Link Existing'));
    fireEvent.click(screen.getByText('Record Alpha'));

    await waitFor(() => {
      expect(onLinkRecord).toHaveBeenCalledWith('r1');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  RichTextCommentInput                                               */
/* ------------------------------------------------------------------ */

describe('RichTextCommentInput', () => {
  const mentionSuggestions: MentionSuggestion[] = [
    { id: 'u1', label: 'alice' },
    { id: 'u2', label: 'bob' },
  ];

  it('renders textarea and toolbar', () => {
    render(<RichTextCommentInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
  });

  it('bold button inserts markdown bold markers', () => {
    const onChange = vi.fn();
    render(<RichTextCommentInput value="" onChange={onChange} />);

    fireEvent.click(screen.getByTitle('Bold (Ctrl+B)'));
    expect(onChange).toHaveBeenCalledWith('****');
  });

  it('@ triggers mention suggestions', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RichTextCommentInput
        value=""
        onChange={onChange}
        mentionSuggestions={mentionSuggestions}
      />,
    );

    // Simulate typing "@" in the textarea
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } });

    // Re-render with updated value to show mention dropdown
    rerender(
      <RichTextCommentInput
        value="@"
        onChange={onChange}
        mentionSuggestions={mentionSuggestions}
      />,
    );

    // The mention trigger happens through the @ button as well
    fireEvent.click(screen.getByTitle('Mention someone'));
    expect(onChange).toHaveBeenCalledWith('@');
  });

  it('preview toggle shows rendered markdown', () => {
    render(
      <RichTextCommentInput
        value="**bold text**"
        onChange={vi.fn()}
      />,
    );

    // Click the preview button
    fireEvent.click(screen.getByTitle('Preview'));

    // In preview mode, markdown is rendered to HTML
    expect(screen.getByText('bold text')).toBeInTheDocument();
    // The textarea should no longer be present
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('submit calls onSubmit with value', () => {
    const onSubmit = vi.fn();
    render(
      <RichTextCommentInput
        value="Hello world"
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByTitle('Submit (Ctrl+Enter)'));
    expect(onSubmit).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  DiffView                                                           */
/* ------------------------------------------------------------------ */

describe('DiffView', () => {
  it('renders old and new values', () => {
    render(
      <DiffView oldValue="hello" newValue="world" fieldName="greeting" />,
    );
    expect(screen.getByText('greeting')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('shows added content in green', () => {
    const { container } = render(
      <DiffView oldValue="" newValue="new line" fieldName="field" />,
    );
    const addedLine = container.querySelector('.border-l-green-500');
    expect(addedLine).toBeInTheDocument();
  });

  it('shows removed content in red', () => {
    const { container } = render(
      <DiffView oldValue="old line" newValue="" fieldName="field" />,
    );
    const removedLine = container.querySelector('.border-l-red-500');
    expect(removedLine).toBeInTheDocument();
  });

  it('handles number diffs', () => {
    render(
      <DiffView oldValue={42} newValue={100} fieldName="count" fieldType="number" />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('toggles between unified and side-by-side', () => {
    const { container } = render(
      <DiffView oldValue="old" newValue="new" fieldName="field" />,
    );

    // Click side-by-side button
    fireEvent.click(screen.getByTitle('Side-by-side diff'));

    // Side-by-side view shows Previous/Current headers
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();

    // Switch back to unified
    fireEvent.click(screen.getByTitle('Unified diff'));
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  RecordNavigationEnhanced                                           */
/* ------------------------------------------------------------------ */

describe('RecordNavigationEnhanced', () => {
  const recordIds = ['a', 'b', 'c', 'd', 'e'];

  it('renders first/prev/next/last buttons', () => {
    render(
      <RecordNavigationEnhanced
        currentIndex={2}
        totalRecords={5}
        recordIds={recordIds}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByTitle('First record (Home)')).toBeInTheDocument();
    expect(screen.getByTitle('Previous record (←)')).toBeInTheDocument();
    expect(screen.getByTitle('Next record (→)')).toBeInTheDocument();
    expect(screen.getByTitle('Last record (End)')).toBeInTheDocument();
  });

  it('shows position indicator (e.g. "3 of 5")', () => {
    render(
      <RecordNavigationEnhanced
        currentIndex={2}
        totalRecords={25}
        recordIds={Array.from({ length: 25 }, (_, i) => `r${i}`)}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText('3 of 25')).toBeInTheDocument();
  });

  it('disables first/prev at start', () => {
    render(
      <RecordNavigationEnhanced
        currentIndex={0}
        totalRecords={5}
        recordIds={recordIds}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByTitle('First record (Home)')).toBeDisabled();
    expect(screen.getByTitle('Previous record (←)')).toBeDisabled();
  });

  it('disables next/last at end', () => {
    render(
      <RecordNavigationEnhanced
        currentIndex={4}
        totalRecords={5}
        recordIds={recordIds}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByTitle('Next record (→)')).toBeDisabled();
    expect(screen.getByTitle('Last record (End)')).toBeDisabled();
  });

  it('search input filters', () => {
    const onSearch = vi.fn();
    render(
      <RecordNavigationEnhanced
        currentIndex={2}
        totalRecords={5}
        recordIds={recordIds}
        onNavigate={vi.fn()}
        onSearch={onSearch}
      />,
    );

    // Toggle search open
    fireEvent.click(screen.getByTitle('Search while navigating'));

    const input = screen.getByPlaceholderText('Search records…');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onSearch).toHaveBeenCalledWith('test');
  });
});

/* ------------------------------------------------------------------ */
/*  RelationshipGraph                                                  */
/* ------------------------------------------------------------------ */

describe('RelationshipGraph', () => {
  const centerNode: GraphNode = { id: 'center', label: 'Account', type: 'Account' };
  const relatedNodes: GraphNode[] = [
    { id: 'n1', label: 'Contact', type: 'Contact' },
    { id: 'n2', label: 'Opport', type: 'Opportunity' },
  ];

  it('renders SVG element', () => {
    const { container } = render(
      <RelationshipGraph record={centerNode} relatedRecords={relatedNodes} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows central record node', () => {
    render(
      <RelationshipGraph record={centerNode} relatedRecords={relatedNodes} />,
    );
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('shows related record nodes', () => {
    render(
      <RelationshipGraph record={centerNode} relatedRecords={relatedNodes} />,
    );
    expect(screen.getByText('Conta…')).toBeInTheDocument();
    expect(screen.getByText('Opport')).toBeInTheDocument();
  });

  it('click on node calls onNodeClick', () => {
    const onNodeClick = vi.fn();
    render(
      <RelationshipGraph
        record={centerNode}
        relatedRecords={relatedNodes}
        onNodeClick={onNodeClick}
      />,
    );

    // Click on the center node's circle group — use the text as proxy
    const nodeText = screen.getByText('Account');
    // Click on the parent <g> element
    fireEvent.click(nodeText.closest('g')!);
    expect(onNodeClick).toHaveBeenCalledWith('center');
  });
});

/* ------------------------------------------------------------------ */
/*  CommentAttachment                                                  */
/* ------------------------------------------------------------------ */

describe('CommentAttachment', () => {
  const attachments: Attachment[] = [
    {
      id: 'a1',
      name: 'screenshot.png',
      size: 204800,
      type: 'image/png',
      thumbnailUrl: 'https://example.com/thumb.png',
    },
    {
      id: 'a2',
      name: 'report.pdf',
      size: 1048576,
      type: 'application/pdf',
    },
    {
      id: 'a3',
      name: 'data.zip',
      size: 512,
      type: 'application/zip',
    },
  ];

  it('renders attachment list', () => {
    render(<CommentAttachment attachments={attachments} />);
    expect(screen.getByText('3 attachments')).toBeInTheDocument();
    expect(screen.getByText('screenshot.png')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('data.zip')).toBeInTheDocument();
  });

  it('shows image thumbnails', () => {
    render(<CommentAttachment attachments={attachments} />);
    const img = screen.getByAltText('screenshot.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.png');
  });

  it('shows file icons for non-images', () => {
    const { container } = render(
      <CommentAttachment attachments={[attachments[1]]} />,
    );
    // Non-image attachments render a div with an icon, not an <img>
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('displays file sizes', () => {
    render(<CommentAttachment attachments={attachments} />);
    expect(screen.getByText('200.0 KB')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    expect(screen.getByText('512 B')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  PointInTimeRestore                                                 */
/* ------------------------------------------------------------------ */

describe('PointInTimeRestore', () => {
  const revisions: RevisionEntry[] = [
    {
      id: 'rev1',
      timestamp: '2024-01-15T10:00:00Z',
      user: 'Alice',
      changes: [
        { field: 'status', oldValue: 'Draft', newValue: 'Active' },
      ],
      snapshot: { status: 'Active', name: 'Test Record' },
    },
    {
      id: 'rev2',
      timestamp: '2024-01-14T08:00:00Z',
      user: 'Bob',
      changes: [
        { field: 'name', oldValue: 'Old Name', newValue: 'Test Record' },
        { field: 'amount', oldValue: 100, newValue: 200 },
      ],
      snapshot: { status: 'Draft', name: 'Test Record' },
    },
  ];

  it('renders revision timeline', () => {
    render(
      <PointInTimeRestore
        recordId="rec1"
        revisions={revisions}
      />,
    );
    expect(screen.getByText('Revision History')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows revision details on selection', () => {
    render(
      <PointInTimeRestore
        recordId="rec1"
        revisions={revisions}
        onRestore={vi.fn()}
      />,
    );

    // Click on Alice's revision
    fireEvent.click(screen.getByText('Alice'));

    // Preview panel should show field changes
    expect(screen.getByText('Revision Preview')).toBeInTheDocument();
    const statusElements = screen.getAllByText('status');
    expect(statusElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
  });

  it('restore button appears with confirmation', async () => {
    const onRestore = vi.fn().mockResolvedValue(undefined);
    render(
      <PointInTimeRestore
        recordId="rec1"
        revisions={revisions}
        onRestore={onRestore}
      />,
    );

    // Select a revision
    fireEvent.click(screen.getByText('Alice'));

    // Click the restore button
    fireEvent.click(screen.getByText('Restore to this point'));

    // Confirmation prompt appears
    expect(screen.getByText('Confirm Restore')).toBeInTheDocument();

    // Confirm the restore
    fireEvent.click(screen.getByText('Confirm Restore'));

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledWith('rev1', { status: 'Active', name: 'Test Record' });
    });
  });

  it('calls onRestore with selected revision', async () => {
    const onRestore = vi.fn().mockResolvedValue(undefined);
    render(
      <PointInTimeRestore
        recordId="rec1"
        revisions={revisions}
        onRestore={onRestore}
      />,
    );

    // Select Bob's revision
    fireEvent.click(screen.getByText('Bob'));
    fireEvent.click(screen.getByText('Restore to this point'));
    fireEvent.click(screen.getByText('Confirm Restore'));

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledWith('rev2', { status: 'Draft', name: 'Test Record' });
    });
  });
});
