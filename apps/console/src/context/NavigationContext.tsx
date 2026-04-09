/**
 * NavigationContext
 *
 * Provides global navigation state for the unified sidebar.
 * Tracks whether the user is in "Home" context (workspace view) or "App" context (specific app).
 * Used to determine which navigation menu to display in the UnifiedSidebar.
 *
 * @module
 */

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

export type NavigationContextType = 'home' | 'app';

interface NavigationContextValue {
  /** Current navigation context (home or app) */
  context: NavigationContextType;
  /** Set the navigation context */
  setContext: (context: NavigationContextType) => void;
  /** Current app name when in app context */
  currentAppName?: string;
  /** Set the current app name */
  setCurrentAppName: (appName?: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [context, setContext] = useState<NavigationContextType>('home');
  const [currentAppName, setCurrentAppName] = useState<string | undefined>();

  const value = useMemo(
    () => ({
      context,
      setContext,
      currentAppName,
      setCurrentAppName,
    }),
    [context, currentAppName]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Hook to access navigation context
 */
export function useNavigationContext(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
}
