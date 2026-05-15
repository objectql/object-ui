/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { cn } from "@object-ui/components"
import { Button } from "@object-ui/components"
import { MessageCircle, X } from "lucide-react"
import { useFloatingChatbot } from "./FloatingChatbotProvider"
import { useObjectTranslation } from "@object-ui/react"

function useChatbotLabel() {
  try {
    const { t } = useObjectTranslation();
    return (key: 'openChat' | 'closeChat', fallback: string) => {
      const v = t(`common.${key}`);
      return !v || v === `common.${key}` ? fallback : v;
    };
  } catch {
    return (_k: string, fallback: string) => fallback;
  }
}

export interface FloatingChatbotTriggerProps {
  /** Position of the FAB */
  position?: "bottom-right" | "bottom-left"
  /** Size of the trigger button in pixels */
  size?: number
  /** Custom className */
  className?: string
}

/**
 * Floating Action Button (FAB) trigger for the chatbot.
 * Renders a circular button fixed to the viewport corner.
 */
export function FloatingChatbotTrigger({
  position = "bottom-right",
  size = 56,
  className,
}: FloatingChatbotTriggerProps) {
  const { isOpen, toggle } = useFloatingChatbot()
  const label = useChatbotLabel()

  return (
    <Button
      onClick={toggle}
      className={cn(
        "fixed z-50 rounded-full shadow-lg transition-transform hover:scale-105",
        position === "bottom-right" ? "right-6 bottom-6" : "left-6 bottom-6",
        className
      )}
      style={{ width: size, height: size }}
      size="icon"
      aria-label={isOpen ? label('closeChat', 'Close chat') : label('openChat', 'Open chat')}
      data-testid="floating-chatbot-trigger"
    >
      {isOpen ? (
        <X className="h-6 w-6" />
      ) : (
        <MessageCircle className="h-6 w-6" />
      )}
    </Button>
  )
}
