import { describe, it, expect } from 'vitest';
import type { SchemaNode, ComponentRendererProps } from '../index';

describe('@object-ui/protocol', () => {
  describe('SchemaNode', () => {
    it('should accept a valid schema node with required properties', () => {
      const schema: SchemaNode = {
        type: 'button',
      };

      expect(schema.type).toBe('button');
    });

    it('should accept a schema node with optional properties', () => {
      const schema: SchemaNode = {
        type: 'form',
        id: 'login-form',
        className: 'p-4 border rounded',
        data: { submitUrl: '/api/login' },
        body: [
          { type: 'input', name: 'username' },
          { type: 'input', name: 'password' },
        ],
      };

      expect(schema.type).toBe('form');
      expect(schema.id).toBe('login-form');
      expect(schema.className).toBe('p-4 border rounded');
      expect(schema.data).toEqual({ submitUrl: '/api/login' });
      expect(Array.isArray(schema.body)).toBe(true);
      expect((schema.body as SchemaNode[]).length).toBe(2);
    });

    it('should allow arbitrary additional properties', () => {
      const schema: SchemaNode = {
        type: 'input',
        label: 'Username',
        placeholder: 'Enter your username',
        required: true,
      };

      expect(schema.label).toBe('Username');
      expect(schema.placeholder).toBe('Enter your username');
      expect(schema.required).toBe(true);
    });

    it('should accept nested schema nodes', () => {
      const schema: SchemaNode = {
        type: 'container',
        body: {
          type: 'button',
          label: 'Click me',
        },
      };

      expect(schema.body).toEqual({
        type: 'button',
        label: 'Click me',
      });
    });
  });

  describe('ComponentRendererProps', () => {
    it('should accept props with required schema property', () => {
      const props: ComponentRendererProps = {
        schema: { type: 'button' },
      };

      expect(props.schema.type).toBe('button');
    });

    it('should accept props with additional properties', () => {
      const props: ComponentRendererProps = {
        schema: { type: 'input', name: 'email' },
        value: 'test@example.com',
        onChange: () => {},
        disabled: false,
      };

      expect(props.schema.type).toBe('input');
      expect(props.value).toBe('test@example.com');
      expect(typeof props.onChange).toBe('function');
      expect(props.disabled).toBe(false);
    });
  });
});
