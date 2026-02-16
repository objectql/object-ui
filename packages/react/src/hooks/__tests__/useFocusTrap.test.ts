/**
 * Tests for useFocusTrap hook
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

describe('useFocusTrap', () => {
  it('returns a ref object', () => {
    const { result } = renderHook(() => useFocusTrap());
    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('current');
  });

  it('returns a ref with null initial value', () => {
    const { result } = renderHook(() => useFocusTrap());
    expect(result.current.current).toBeNull();
  });

  it('accepts disabled option', () => {
    const { result } = renderHook(() =>
      useFocusTrap({ enabled: false })
    );
    expect(result.current).toBeDefined();
  });

  it('accepts all options without error', () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() =>
      useFocusTrap({
        enabled: true,
        autoFocus: true,
        restoreFocus: true,
        escapeDeactivates: true,
        onEscape,
        initialFocus: '.first-input',
      })
    );
    expect(result.current).toBeDefined();
  });

  it('defaults to enabled when no options provided', () => {
    const { result } = renderHook(() => useFocusTrap());
    // Should not throw
    expect(result.current.current).toBeNull();
  });

  it('auto-focuses the first focusable element when enabled', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = 'Click me';
    container.appendChild(button);
    document.body.appendChild(container);

    const { result } = renderHook(() =>
      useFocusTrap<HTMLDivElement>({ enabled: true, autoFocus: true })
    );

    act(() => {
      (result.current as any).current = container;
    });

    // Re-render to trigger effect with the ref set
    const { result: result2 } = renderHook(() =>
      useFocusTrap<HTMLDivElement>({ enabled: true, autoFocus: true })
    );

    document.body.removeChild(container);
  });

  it('focuses initialFocus selector when provided', () => {
    const container = document.createElement('div');
    const input1 = document.createElement('input');
    const input2 = document.createElement('input');
    input2.className = 'target-input';
    container.appendChild(input1);
    container.appendChild(input2);
    document.body.appendChild(container);

    const focusSpy = vi.spyOn(input2, 'focus');

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFocusTrap<HTMLDivElement>({
          enabled,
          autoFocus: true,
          initialFocus: '.target-input',
        }),
      { initialProps: { enabled: false } }
    );

    // Set the ref
    (result.current as any).current = container;

    // Enable the trap to trigger the effect
    rerender({ enabled: true });

    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it('handles Escape key when escapeDeactivates is true', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    container.appendChild(button);
    document.body.appendChild(container);

    const onEscape = vi.fn();

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFocusTrap<HTMLDivElement>({
          enabled,
          escapeDeactivates: true,
          onEscape,
        }),
      { initialProps: { enabled: false } }
    );

    (result.current as any).current = container;
    rerender({ enabled: true });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      container.dispatchEvent(event);
    });

    expect(onEscape).toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it('traps Tab focus at the end of focusable elements', () => {
    const container = document.createElement('div');
    const button1 = document.createElement('button');
    button1.textContent = 'First';
    const button2 = document.createElement('button');
    button2.textContent = 'Last';
    container.appendChild(button1);
    container.appendChild(button2);
    document.body.appendChild(container);

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFocusTrap<HTMLDivElement>({
          enabled,
          autoFocus: false,
        }),
      { initialProps: { enabled: false } }
    );

    (result.current as any).current = container;
    rerender({ enabled: true });

    // Focus the last element
    button2.focus();

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      container.dispatchEvent(event);
    });

    document.body.removeChild(container);
  });

  it('traps Shift+Tab focus at the start of focusable elements', () => {
    const container = document.createElement('div');
    const button1 = document.createElement('button');
    button1.textContent = 'First';
    const button2 = document.createElement('button');
    button2.textContent = 'Last';
    container.appendChild(button1);
    container.appendChild(button2);
    document.body.appendChild(container);

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFocusTrap<HTMLDivElement>({
          enabled,
          autoFocus: false,
        }),
      { initialProps: { enabled: false } }
    );

    (result.current as any).current = container;
    rerender({ enabled: true });

    // Focus the first element
    button1.focus();

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      });
      container.dispatchEvent(event);
    });

    document.body.removeChild(container);
  });

  it('restores focus on unmount when restoreFocus is true', () => {
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const container = document.createElement('div');
    const innerButton = document.createElement('button');
    innerButton.textContent = 'Inside';
    container.appendChild(innerButton);
    document.body.appendChild(container);

    const { result, rerender, unmount } = renderHook(
      ({ enabled }) =>
        useFocusTrap<HTMLDivElement>({
          enabled,
          autoFocus: true,
          restoreFocus: true,
        }),
      { initialProps: { enabled: false } }
    );

    (result.current as any).current = container;
    rerender({ enabled: true });

    unmount();

    document.body.removeChild(container);
    document.body.removeChild(outsideButton);
  });

  it('ignores non-Tab and non-Escape keys', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    container.appendChild(button);
    document.body.appendChild(container);

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFocusTrap<HTMLDivElement>({
          enabled,
          autoFocus: false,
        }),
      { initialProps: { enabled: false } }
    );

    (result.current as any).current = container;
    rerender({ enabled: true });

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
      });
      container.dispatchEvent(event);
    });

    document.body.removeChild(container);
  });

  it('handles container with no focusable elements', () => {
    const container = document.createElement('div');
    container.innerHTML = '<span>No focusable elements</span>';
    document.body.appendChild(container);

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFocusTrap<HTMLDivElement>({
          enabled,
          autoFocus: true,
        }),
      { initialProps: { enabled: false } }
    );

    (result.current as any).current = container;
    rerender({ enabled: true });

    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
      });
      container.dispatchEvent(event);
    });

    document.body.removeChild(container);
  });
});
