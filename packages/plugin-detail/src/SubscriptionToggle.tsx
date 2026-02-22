/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button } from '@object-ui/components';
import { Bell, BellOff } from 'lucide-react';
import type { RecordSubscription } from '@object-ui/types';

export interface SubscriptionToggleProps {
  /** Current subscription state */
  subscription: RecordSubscription;
  /** Called when user toggles subscription */
  onToggle?: (subscribed: boolean) => void | Promise<void>;
  className?: string;
}

/**
 * SubscriptionToggle — Bell icon toggle for record notification subscriptions.
 * Aligned with @objectstack/spec RecordSubscriptionSchema.
 */
export const SubscriptionToggle: React.FC<SubscriptionToggleProps> = ({
  subscription,
  onToggle,
  className,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleToggle = React.useCallback(async () => {
    if (!onToggle) return;
    setIsLoading(true);
    try {
      await onToggle(!subscription.subscribed);
    } finally {
      setIsLoading(false);
    }
  }, [onToggle, subscription.subscribed]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', className)}
      onClick={handleToggle}
      disabled={isLoading || !onToggle}
      aria-label={subscription.subscribed ? 'Unsubscribe from notifications' : 'Subscribe to notifications'}
      title={subscription.subscribed ? 'Subscribed — click to unsubscribe' : 'Subscribe to notifications'}
    >
      {subscription.subscribed ? (
        <Bell className="h-4 w-4 text-primary" />
      ) : (
        <BellOff className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
};
