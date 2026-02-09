import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIFormAssist } from '../AIFormAssist';
import type { AIFormAssistSchema } from '@object-ui/types';

describe('AIFormAssist', () => {
  it('should render suggestions', () => {
    const schema: AIFormAssistSchema = {
      type: 'ai-form-assist',
      suggestions: [
        { fieldName: 'name', value: 'John Doe', confidence: 0.9 },
        { fieldName: 'email', value: 'john@example.com', confidence: 0.85 },
      ],
    };

    render(<AIFormAssist schema={schema} />);
    
    expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('should show confidence scores', () => {
    const schema: AIFormAssistSchema = {
      type: 'ai-form-assist',
      showConfidence: true,
      suggestions: [
        { fieldName: 'name', value: 'Test', confidence: 0.92 },
      ],
    };

    render(<AIFormAssist schema={schema} />);
    
    expect(screen.getByText('92% confidence')).toBeInTheDocument();
  });

  it('should show reasoning when enabled', () => {
    const schema: AIFormAssistSchema = {
      type: 'ai-form-assist',
      showReasoning: true,
      suggestions: [
        { 
          fieldName: 'city', 
          value: 'New York', 
          confidence: 0.75,
          reasoning: 'Based on previous entries for this user'
        },
      ],
    };

    render(<AIFormAssist schema={schema} />);
    
    expect(screen.getByText('Based on previous entries for this user')).toBeInTheDocument();
  });

  it('should render nothing when no suggestions', () => {
    const schema: AIFormAssistSchema = {
      type: 'ai-form-assist',
      suggestions: [],
    };

    const { container } = render(<AIFormAssist schema={schema} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should show suggestion count', () => {
    const schema: AIFormAssistSchema = {
      type: 'ai-form-assist',
      suggestions: [
        { fieldName: 'a', value: '1', confidence: 0.9 },
        { fieldName: 'b', value: '2', confidence: 0.8 },
        { fieldName: 'c', value: '3', confidence: 0.7 },
      ],
    };

    render(<AIFormAssist schema={schema} />);
    
    expect(screen.getByText('3 suggestions')).toBeInTheDocument();
  });
});
