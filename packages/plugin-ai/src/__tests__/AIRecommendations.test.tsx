import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIRecommendations } from '../AIRecommendations';
import type { AIRecommendationsSchema } from '@object-ui/types';

describe('AIRecommendations', () => {
  it('should render recommendations list', () => {
    const schema: AIRecommendationsSchema = {
      type: 'ai-recommendations',
      recommendations: [
        { id: '1', title: 'Product A', description: 'A great product', score: 0.95, category: 'Electronics' },
        { id: '2', title: 'Product B', description: 'Another product', score: 0.80 },
      ],
    };

    render(<AIRecommendations schema={schema} />);
    
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('Product B')).toBeInTheDocument();
    expect(screen.getByText('Electronics')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const schema: AIRecommendationsSchema = {
      type: 'ai-recommendations',
      loading: true,
    };

    render(<AIRecommendations schema={schema} />);
    
    expect(screen.getByText('Generating recommendations...')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    const schema: AIRecommendationsSchema = {
      type: 'ai-recommendations',
      recommendations: [],
      emptyMessage: 'No items to recommend',
    };

    render(<AIRecommendations schema={schema} />);
    
    expect(screen.getByText('No items to recommend')).toBeInTheDocument();
  });

  it('should show scores when enabled', () => {
    const schema: AIRecommendationsSchema = {
      type: 'ai-recommendations',
      showScores: true,
      recommendations: [
        { id: '1', title: 'Test', score: 0.87 },
      ],
    };

    render(<AIRecommendations schema={schema} />);
    
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('should render grid layout', () => {
    const schema: AIRecommendationsSchema = {
      type: 'ai-recommendations',
      layout: 'grid',
      recommendations: [
        { id: '1', title: 'Grid Item 1', score: 0.9 },
        { id: '2', title: 'Grid Item 2', score: 0.8 },
      ],
    };

    render(<AIRecommendations schema={schema} />);
    
    expect(screen.getByText('Grid Item 1')).toBeInTheDocument();
    expect(screen.getByText('Grid Item 2')).toBeInTheDocument();
  });
});
