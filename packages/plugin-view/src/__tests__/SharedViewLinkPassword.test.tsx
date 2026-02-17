/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@object-ui/components', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Input: React.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Share2: () => <span>ShareIcon</span>,
  Copy: () => <span>CopyIcon</span>,
  Check: () => <span>CheckIcon</span>,
  Lock: () => <span>LockIcon</span>,
  Calendar: () => <span>CalendarIcon</span>,
}));

import { SharedViewLink } from '../SharedViewLink';

describe('SharedViewLink - Password & Expiration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Share button', () => {
    render(<SharedViewLink objectName="tasks" />);
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('renders password input field in the popover', () => {
    render(<SharedViewLink objectName="tasks" />);
    const passwordInput = screen.getByPlaceholderText('Enter password...');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('renders expiration dropdown with options', () => {
    render(<SharedViewLink objectName="tasks" />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Verify options are present
    const options = screen.getAllByRole('option');
    const optionTexts = options.map(o => o.textContent);
    expect(optionTexts).toContain('Never');
    expect(optionTexts).toContain('1 day');
    expect(optionTexts).toContain('7 days');
    expect(optionTexts).toContain('30 days');
    expect(optionTexts).toContain('90 days');
  });

  it('shows "Password protected" badge after generating link with a password', async () => {
    render(<SharedViewLink objectName="tasks" baseUrl="https://example.com" />);

    // Type a password
    const passwordInput = screen.getByPlaceholderText('Enter password...');
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // Click Generate Link
    const generateBtn = screen.getByText('Generate Link');
    fireEvent.click(generateBtn);

    // After link is generated, "Password protected" badge should appear
    await waitFor(() => {
      expect(screen.getByText('Password protected')).toBeInTheDocument();
    });
  });

  it('shows expiration badge after generating link with expiration set', async () => {
    render(<SharedViewLink objectName="tasks" baseUrl="https://example.com" />);

    // Select 7 days expiration
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '7' } });

    // Click Generate Link
    const generateBtn = screen.getByText('Generate Link');
    fireEvent.click(generateBtn);

    // After link is generated, expiration badge should appear
    await waitFor(() => {
      expect(screen.getByText(/Expires in 7 days/)).toBeInTheDocument();
    });
  });

  it('shows singular "day" for 1 day expiration', async () => {
    render(<SharedViewLink objectName="tasks" baseUrl="https://example.com" />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    const generateBtn = screen.getByText('Generate Link');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Expires in 1 day$/)).toBeInTheDocument();
    });
  });

  it('calls onShare callback with password and expiresAt options', async () => {
    const onShare = vi.fn();
    render(
      <SharedViewLink
        objectName="tasks"
        baseUrl="https://example.com"
        onShare={onShare}
      />
    );

    // Set password
    const passwordInput = screen.getByPlaceholderText('Enter password...');
    fireEvent.change(passwordInput, { target: { value: 'mypass' } });

    // Set expiration to 30 days
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '30' } });

    // Generate
    const generateBtn = screen.getByText('Generate Link');
    fireEvent.click(generateBtn);

    expect(onShare).toHaveBeenCalledTimes(1);
    const [url, options] = onShare.mock.calls[0];

    // URL should contain share path
    expect(url).toContain('/share/tasks/');
    expect(url).toContain('token=');

    // Options should include password and expiresAt
    expect(options.password).toBe('mypass');
    expect(options.expiresAt).toBeDefined();
    // expiresAt should be a valid ISO date string roughly 30 days from now
    const expiresAt = new Date(options.expiresAt);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('calls onShare without password and expiresAt when neither is set', () => {
    const onShare = vi.fn();
    render(
      <SharedViewLink
        objectName="tasks"
        baseUrl="https://example.com"
        onShare={onShare}
      />
    );

    const generateBtn = screen.getByText('Generate Link');
    fireEvent.click(generateBtn);

    expect(onShare).toHaveBeenCalledTimes(1);
    const [, options] = onShare.mock.calls[0];
    expect(options.password).toBeUndefined();
    expect(options.expiresAt).toBeUndefined();
  });
});
