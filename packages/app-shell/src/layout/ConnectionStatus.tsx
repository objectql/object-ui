/**
 * ConnectionStatus
 *
 * Displays the current ObjectStack connection state in the header area.
 * Shows a subtle indicator when connected (auto-hides after a moment),
 * and a prominent one when reconnecting or in error state.
 */

import { useState, useEffect } from 'react';
import type { ConnectionState } from '@object-ui/data-objectstack';
import { cn } from '@object-ui/components';
import { Wifi, WifiOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';

interface ConnectionStatusProps {
  state: ConnectionState;
  className?: string;
}

const statusConfig: Record<ConnectionState, { labelKey: string; defaultValue: string; color: string; icon: typeof Wifi }> = {
  connected: { labelKey: 'topbar.connection.connected', defaultValue: 'Connected', color: 'text-green-500', icon: CheckCircle2 },
  connecting: { labelKey: 'topbar.connection.connecting', defaultValue: 'Connecting…', color: 'text-yellow-500', icon: Loader2 },
  reconnecting: { labelKey: 'topbar.connection.reconnecting', defaultValue: 'Reconnecting…', color: 'text-yellow-500', icon: Loader2 },
  disconnected: { labelKey: 'topbar.connection.disconnected', defaultValue: 'Disconnected', color: 'text-muted-foreground', icon: WifiOff },
  error: { labelKey: 'topbar.connection.error', defaultValue: 'Connection Error', color: 'text-destructive', icon: WifiOff },
};

export function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  const config = statusConfig[state];
  const { t } = useObjectTranslation();
  const label = t(config.labelKey, { defaultValue: config.defaultValue });
  const Icon = config.icon;
  const [showConnected, setShowConnected] = useState(false);

  // Briefly show "Connected" when transitioning to connected state
  useEffect(() => {
    if (state === 'connected') {
      setShowConnected(true);
      const timer = setTimeout(() => setShowConnected(false), 2000);
      return () => clearTimeout(timer);
    }
    setShowConnected(false);
  }, [state]);

  // Hide when connected (after the brief flash)
  if (state === 'connected' && !showConnected) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-opacity duration-300',
        config.color,
        state === 'connected' && 'bg-green-500/10',
        state === 'error' && 'bg-destructive/10',
        state === 'reconnecting' && 'bg-yellow-500/10',
        className
      )}
      title={label}
    >
      <Icon className={cn('h-3.5 w-3.5', (state === 'connecting' || state === 'reconnecting') && 'animate-spin')} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
