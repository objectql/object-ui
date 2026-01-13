import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import { ScrollArea } from "./scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Send } from "lucide-react"

// Message type definition
export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
  avatar?: string
  avatarFallback?: string
}

// Chatbot container props
export interface ChatbotProps extends React.HTMLAttributes<HTMLDivElement> {
  messages?: ChatMessage[]
  placeholder?: string
  onSendMessage?: (message: string) => void
  disabled?: boolean
  showTimestamp?: boolean
  userAvatar?: string
  userAvatarFallback?: string
  assistantAvatar?: string
  assistantAvatarFallback?: string
  maxHeight?: string
}

// Chatbot container component
const Chatbot = React.forwardRef<HTMLDivElement, ChatbotProps>(
  (
    {
      className,
      messages = [],
      placeholder = "Type your message...",
      onSendMessage,
      disabled = false,
      showTimestamp = false,
      userAvatar,
      userAvatarFallback = "You",
      assistantAvatar,
      assistantAvatarFallback = "AI",
      maxHeight = "500px",
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState("")
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Auto-scroll to bottom when new messages arrive
    React.useEffect(() => {
      if (scrollRef.current) {
        const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight
        }
      }
    }, [messages])

    const handleSend = () => {
      if (inputValue.trim() && onSendMessage) {
        onSendMessage(inputValue.trim())
        setInputValue("")
        inputRef.current?.focus()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col border rounded-lg bg-background overflow-hidden",
          className
        )}
        style={{ maxHeight }}
        {...props}
      >
        {/* Messages area */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No messages yet. Start a conversation!
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  showTimestamp={showTimestamp}
                  userAvatar={userAvatar}
                  userAvatarFallback={userAvatarFallback}
                  assistantAvatar={assistantAvatar}
                  assistantAvatarFallback={assistantAvatarFallback}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={disabled || !inputValue.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }
)
Chatbot.displayName = "Chatbot"

// Individual message component
interface ChatMessageProps {
  message: ChatMessage
  showTimestamp?: boolean
  userAvatar?: string
  userAvatarFallback?: string
  assistantAvatar?: string
  assistantAvatarFallback?: string
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimestamp,
  userAvatar,
  userAvatarFallback,
  assistantAvatar,
  assistantAvatarFallback,
}) => {
  const isUser = message.role === "user"
  const isSystem = message.role === "system"

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  const avatar = isUser 
    ? (message.avatar || userAvatar)
    : (message.avatar || assistantAvatar)
  
  const avatarFallback = isUser
    ? (message.avatarFallback || userAvatarFallback)
    : (message.avatarFallback || assistantAvatarFallback)

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatar} />
        <AvatarFallback className="text-xs">{avatarFallback}</AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-lg px-4 py-2 max-w-[70%] break-words",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        {showTimestamp && message.timestamp && (
          <span className="text-xs text-muted-foreground">
            {message.timestamp}
          </span>
        )}
      </div>
    </div>
  )
}

// Typing indicator component
export interface TypingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  avatarSrc?: string
  avatarFallback?: string
}

const TypingIndicator = React.forwardRef<HTMLDivElement, TypingIndicatorProps>(
  ({ className, avatarSrc, avatarFallback = "AI", ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex gap-3", className)} {...props}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback className="text-xs">{avatarFallback}</AvatarFallback>
        </Avatar>
        <div className="flex items-center bg-muted rounded-lg px-4 py-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></span>
          </div>
        </div>
      </div>
    )
  }
)
TypingIndicator.displayName = "TypingIndicator"

export { Chatbot, TypingIndicator, type ChatMessage as ChatbotMessage }
