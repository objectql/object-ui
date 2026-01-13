import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('Chatbot Component', () => {
  it('should be registered in ComponentRegistry', () => {
    const chatbotRenderer = ComponentRegistry.get('chatbot');
    expect(chatbotRenderer).toBeDefined();
  });

  it('should have proper metadata', () => {
    const metadata = ComponentRegistry.getMetadata('chatbot');
    expect(metadata).toBeDefined();
    expect(metadata?.label).toBe('Chatbot');
    expect(metadata?.inputs).toBeDefined();
    expect(metadata?.defaultProps).toBeDefined();
  });

  it('should have expected inputs', () => {
    const metadata = ComponentRegistry.getMetadata('chatbot');
    const inputNames = metadata?.inputs?.map((input: any) => input.name) || [];
    
    expect(inputNames).toContain('messages');
    expect(inputNames).toContain('placeholder');
    expect(inputNames).toContain('showTimestamp');
    expect(inputNames).toContain('userAvatar');
    expect(inputNames).toContain('assistantAvatar');
  });

  it('should have sensible default props', () => {
    const metadata = ComponentRegistry.getMetadata('chatbot');
    const defaults = metadata?.defaultProps;
    
    expect(defaults).toBeDefined();
    expect(defaults?.placeholder).toBe('Type your message...');
    expect(defaults?.showTimestamp).toBe(false);
    expect(defaults?.messages).toBeDefined();
    expect(Array.isArray(defaults?.messages)).toBe(true);
  });
});
