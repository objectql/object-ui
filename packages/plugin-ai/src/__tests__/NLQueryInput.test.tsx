import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NLQueryInput } from '../NLQueryInput';
import type { NLQuerySchema } from '@object-ui/types';

describe('NLQueryInput', () => {
  it('should render query input', () => {
    const schema: NLQuerySchema = {
      type: 'nl-query',
      placeholder: 'Ask about sales data...',
    };

    render(<NLQueryInput schema={schema} />);
    
    expect(screen.getByPlaceholderText('Ask about sales data...')).toBeInTheDocument();
    expect(screen.getByText('Ask')).toBeInTheDocument();
  });

  it('should render suggestions', () => {
    const schema: NLQuerySchema = {
      type: 'nl-query',
      suggestions: [
        'Show total sales this month',
        'List top customers',
        'Revenue by product category',
      ],
    };

    render(<NLQueryInput schema={schema} />);
    
    expect(screen.getByText('Show total sales this month')).toBeInTheDocument();
    expect(screen.getByText('List top customers')).toBeInTheDocument();
  });

  it('should render query result', () => {
    const schema: NLQuerySchema = {
      type: 'nl-query',
      result: {
        query: 'Show total sales',
        summary: 'Total sales for the current period',
        confidence: 0.92,
        data: [
          { product: 'Widget A', sales: 100 },
          { product: 'Widget B', sales: 200 },
        ],
        columns: [
          { name: 'product', label: 'Product' },
          { name: 'sales', label: 'Sales' },
        ],
      },
    };

    render(<NLQueryInput schema={schema} />);
    
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('92% match')).toBeInTheDocument();
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('should render query history', () => {
    const schema: NLQuerySchema = {
      type: 'nl-query',
      showHistory: true,
      history: [
        { query: 'Show revenue', timestamp: '2026-02-01T10:00:00Z' },
        { query: 'List customers', timestamp: '2026-02-02T10:00:00Z' },
      ],
    };

    render(<NLQueryInput schema={schema} />);
    
    expect(screen.getByText('Recent Queries')).toBeInTheDocument();
    expect(screen.getByText('Show revenue')).toBeInTheDocument();
    expect(screen.getByText('List customers')).toBeInTheDocument();
  });
});
