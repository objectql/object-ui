import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SchemaRenderer, ComponentRegistry } from '../index';
import type { ComponentRenderer } from '../registry';

describe('@object-ui/renderer - SchemaRenderer', () => {
  beforeEach(() => {
    // Register a simple test component
    const TestButton: ComponentRenderer = ({ schema, className }) => (
      <button data-testid="test-button" className={className}>
        {schema.label || 'Button'}
      </button>
    );

    const TestInput: ComponentRenderer = ({ schema, className }) => (
      <input
        data-testid="test-input"
        type="text"
        placeholder={schema.placeholder}
        className={className}
      />
    );

    ComponentRegistry.register('button', TestButton);
    ComponentRegistry.register('input', TestInput);
  });

  describe('SchemaRenderer', () => {
    it('should render a simple component', () => {
      const schema = {
        type: 'button',
        label: 'Click me',
      };

      render(<SchemaRenderer schema={schema} />);
      
      const button = screen.getByTestId('test-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Click me');
    });

    it('should apply className from schema', () => {
      const schema = {
        type: 'button',
        label: 'Styled Button',
        className: 'bg-blue-500 text-white',
      };

      render(<SchemaRenderer schema={schema} />);
      
      const button = screen.getByTestId('test-button');
      expect(button).toHaveClass('bg-blue-500', 'text-white');
    });

    it('should handle unknown component types', () => {
      const schema = {
        type: 'unknown-component',
        someData: 'test',
      };

      render(<SchemaRenderer schema={schema} />);
      
      expect(screen.getByText(/Unknown component type:/)).toBeInTheDocument();
      const elements = screen.getAllByText(/unknown-component/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should return null for null schema', () => {
      const { container } = render(<SchemaRenderer schema={null as any} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render string schema as text', () => {
      const { container } = render(<SchemaRenderer schema={'Hello World' as any} />);
      expect(container).toHaveTextContent('Hello World');
    });

    it('should pass schema props to component', () => {
      const schema = {
        type: 'input',
        placeholder: 'Enter your name',
      };

      render(<SchemaRenderer schema={schema} />);
      
      const input = screen.getByTestId('test-input');
      expect(input).toHaveAttribute('placeholder', 'Enter your name');
    });
  });
});
