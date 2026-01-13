import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/ui/button';

describe('@object-ui/ui - Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should apply default variant and size', () => {
    render(<Button data-testid="button">Default Button</Button>);
    const button = screen.getByTestId('button');
    expect(button).toHaveAttribute('data-variant', 'default');
    expect(button).toHaveAttribute('data-size', 'default');
  });

  it('should apply variant classes', () => {
    render(
      <>
        <Button data-testid="default" variant="default">Default</Button>
        <Button data-testid="destructive" variant="destructive">Destructive</Button>
        <Button data-testid="outline" variant="outline">Outline</Button>
        <Button data-testid="secondary" variant="secondary">Secondary</Button>
        <Button data-testid="ghost" variant="ghost">Ghost</Button>
        <Button data-testid="link" variant="link">Link</Button>
      </>
    );

    expect(screen.getByTestId('default')).toHaveAttribute('data-variant', 'default');
    expect(screen.getByTestId('destructive')).toHaveAttribute('data-variant', 'destructive');
    expect(screen.getByTestId('outline')).toHaveAttribute('data-variant', 'outline');
    expect(screen.getByTestId('secondary')).toHaveAttribute('data-variant', 'secondary');
    expect(screen.getByTestId('ghost')).toHaveAttribute('data-variant', 'ghost');
    expect(screen.getByTestId('link')).toHaveAttribute('data-variant', 'link');
  });

  it('should apply size classes', () => {
    render(
      <>
        <Button data-testid="default" size="default">Default</Button>
        <Button data-testid="sm" size="sm">Small</Button>
        <Button data-testid="lg" size="lg">Large</Button>
        <Button data-testid="icon" size="icon">Icon</Button>
      </>
    );

    expect(screen.getByTestId('default')).toHaveAttribute('data-size', 'default');
    expect(screen.getByTestId('sm')).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('lg')).toHaveAttribute('data-size', 'lg');
    expect(screen.getByTestId('icon')).toHaveAttribute('data-size', 'icon');
  });

  it('should apply custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByText('Custom')).toHaveClass('custom-class');
  });

  it('should handle disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });

  it('should handle onClick events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
