import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsoleChatbotFab } from '../ConsoleChatbotFab';

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'topbar.openAssistant') return `Open ${String(options?.name)} assistant`;
      return String(options?.defaultValue ?? key);
    },
  }),
}));

describe('ConsoleChatbotFab', () => {
  it('keeps the lightweight FAB above the mobile bottom navigation', () => {
    render(<ConsoleChatbotFab appLabel="Workspace" objects={[]} />);

    const fab = screen.getByTestId('console-chatbot-fab');
    expect(fab).toHaveAccessibleName('Open Workspace assistant');
    expect(fab).toHaveClass('bottom-20');
    expect(fab).toHaveClass('sm:bottom-6');
  });

  it('ADR-0057 P3b — when onOpenDock is wired, the FAB launches the dock instead of the overlay', () => {
    const onOpenDock = vi.fn();
    render(<ConsoleChatbotFab appLabel="Workspace" objects={[]} onOpenDock={onOpenDock} />);

    // Still the lightweight launcher button (no heavy floating chatbot mounted).
    const fab = screen.getByTestId('console-chatbot-fab');
    fireEvent.click(fab);
    expect(onOpenDock).toHaveBeenCalledTimes(1);
    // The floating overlay is never armed in dock mode — the button stays.
    expect(screen.getByTestId('console-chatbot-fab')).toBeInTheDocument();
  });
});
