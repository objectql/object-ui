/**
 * Tests for OnboardingWalkthrough component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingWalkthrough } from '../components/OnboardingWalkthrough';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('OnboardingWalkthrough', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('shows the onboarding dialog for first-time users', async () => {
    render(<OnboardingWalkthrough />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to ObjectUI')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('does not show the dialog if already dismissed', async () => {
    localStorageMock.setItem('objectui-onboarding-dismissed', new Date().toISOString());
    
    render(<OnboardingWalkthrough />);
    
    // Wait a bit then verify it's not shown
    await new Promise(r => setTimeout(r, 1000));
    expect(screen.queryByText('Welcome to ObjectUI')).not.toBeInTheDocument();
  });

  it('shows the first step initially', async () => {
    render(<OnboardingWalkthrough />);
    
    await waitFor(() => {
      expect(screen.getByText('Navigate Your Apps')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('navigates to the next step on Next click', async () => {
    render(<OnboardingWalkthrough />);
    
    await waitFor(() => {
      expect(screen.getByText('Navigate Your Apps')).toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByText('Next'));
    
    await waitFor(() => {
      expect(screen.getByText('Quick Search')).toBeInTheDocument();
    });
  });

  it('dismisses on Skip click and persists to localStorage', async () => {
    render(<OnboardingWalkthrough />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to ObjectUI')).toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByText('Skip'));
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'objectui-onboarding-dismissed',
      expect.any(String),
    );
  });

  it('shows Get Started on the last step', async () => {
    render(<OnboardingWalkthrough />);
    
    await waitFor(() => {
      expect(screen.getByText('Navigate Your Apps')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click through all steps
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    
    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });
  });
});
