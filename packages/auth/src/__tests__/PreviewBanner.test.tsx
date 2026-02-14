/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { PreviewBanner } from '../PreviewBanner';

describe('PreviewBanner', () => {
  it('should render banner message when in preview mode', async () => {
    render(
      <AuthProvider
        authUrl="/api/auth"
        previewMode={{ bannerMessage: 'You are in a demo.' }}
      >
        <PreviewBanner />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    expect(screen.getByRole('status').textContent).toBe('You are in a demo.');
  });

  it('should render default message when bannerMessage is not provided', async () => {
    render(
      <AuthProvider authUrl="/api/auth" previewMode={{}}>
        <PreviewBanner />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    expect(screen.getByRole('status').textContent).toBe('You are in preview mode.');
  });

  it('should not render when not in preview mode', async () => {
    render(
      <AuthProvider authUrl="/api/auth" enabled={false}>
        <PreviewBanner />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
