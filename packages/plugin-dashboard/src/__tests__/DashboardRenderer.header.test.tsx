import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardRenderer } from '../DashboardRenderer';
import type { DashboardSchema } from '@object-ui/types';

// Mock SchemaRenderer to avoid pulling in the full renderer tree
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: { schema: any }) => (
    <div data-testid="schema-renderer">{schema?.type ?? 'unknown'}</div>
  ),
}));

describe('DashboardRenderer header', () => {
  const baseSchema: DashboardSchema = {
    type: 'dashboard',
    name: 'test_dashboard',
    title: 'Sales Dashboard',
    description: 'Monthly overview of sales data',
    widgets: [],
  };

  it('should render title when showTitle is not false', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: { showTitle: true },
    };
    render(<DashboardRenderer schema={schema} />);

    expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
  });

  it('should not render title when showTitle is false', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: { showTitle: false },
    };
    render(<DashboardRenderer schema={schema} />);

    expect(screen.queryByText('Sales Dashboard')).not.toBeInTheDocument();
  });

  it('should render description when showDescription is not false', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: { showDescription: true },
    };
    render(<DashboardRenderer schema={schema} />);

    expect(screen.getByText('Monthly overview of sales data')).toBeInTheDocument();
  });

  it('should not render description when showDescription is false', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: { showDescription: false },
    };
    render(<DashboardRenderer schema={schema} />);

    expect(screen.queryByText('Monthly overview of sales data')).not.toBeInTheDocument();
  });

  it('should render action buttons', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: {
        actions: [
          { label: 'Export', action: 'export' },
          { label: 'Share', action: 'share' },
        ],
      },
    };
    render(<DashboardRenderer schema={schema} />);

    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('should render recordCount badge when prop provided', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: {},
    };
    const onRefresh = vi.fn();
    render(<DashboardRenderer schema={schema} onRefresh={onRefresh} recordCount={1234} />);

    expect(screen.getByText('1,234 records')).toBeInTheDocument();
  });

  it('should set data-user-actions attribute when userActions provided', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: {},
    };
    const userActions = { sort: true, search: false, filter: true };
    const { container } = render(
      <DashboardRenderer schema={schema} userActions={userActions} />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-user-actions')).toBe(JSON.stringify(userActions));
  });

  it('should not render header section when schema.header is undefined', () => {
    const schema: DashboardSchema = {
      ...baseSchema,
      header: undefined,
    };
    render(<DashboardRenderer schema={schema} />);

    // Neither title nor description should appear in a header context
    // The title text itself should not be rendered since there is no header
    expect(screen.queryByText('Sales Dashboard')).not.toBeInTheDocument();
  });
});
