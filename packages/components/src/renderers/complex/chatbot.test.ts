import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('Chatbot Component', () => {
  // Import all renderers to register them
  beforeAll(async () => {
    await import('./index');
  });

  it('should be registered in ComponentRegistry', () => {
    const chatbotRenderer = ComponentRegistry.get('chatbot');
    expect(chatbotRenderer).toBeDefined();
  });

  it('should have proper metadata', () => {
    const config = ComponentRegistry.getConfig('chatbot');
    expect(config).toBeDefined();
    expect(config?.label).toBe('Chatbot');
    expect(config?.inputs).toBeDefined();
    expect(config?.defaultProps).toBeDefined();
  });

  it('should have expected inputs', () => {
    const config = ComponentRegistry.getConfig('chatbot');
    const inputNames = config?.inputs?.map((input: any) => input.name) || [];
    
    expect(inputNames).toContain('messages');
    expect(inputNames).toContain('placeholder');
    expect(inputNames).toContain('showTimestamp');
    expect(inputNames).toContain('userAvatar');
    expect(inputNames).toContain('assistantAvatar');
  });

  it('should have sensible default props', () => {
    const config = ComponentRegistry.getConfig('chatbot');
    const defaults = config?.defaultProps;
    
    expect(defaults).toBeDefined();
    expect(defaults?.placeholder).toBe('Type your message...');
    expect(defaults?.showTimestamp).toBe(false);
    expect(defaults?.messages).toBeDefined();
    expect(Array.isArray(defaults?.messages)).toBe(true);
  });
});
