/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { cn } from "@object-ui/components"
import { Button, Input, ScrollArea, Avatar, AvatarFallback, AvatarImage } from "@object-ui/components"
import { Send, Trash2, Paperclip, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import remarkGfm from "remark-gfm"

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
  avatar?: string
  avatarFallback?: string
  streaming?: boolean
}

export interface ChatbotEnhancedProps extends React.HTMLAttributes<HTMLDivElement> {
  messages?: ChatMessage[]
  placeholder?: string
  onSendMessage?: (message: string, files?: File[]) => void
  onClear?: () => void
  disabled?: boolean
  showTimestamp?: boolean
  userAvatarUrl?: string
  userAvatarFallback?: string
  assistantAvatarUrl?: string
  assistantAvatarFallback?: string
  maxHeight?: string
  enableMarkdown?: boolean
  enableFileUpload?: boolean
  acceptedFileTypes?: string
  maxFileSize?: number
  onStreamingUpdate?: (messageId: string, content: string) => void
}

function MessageContent({ content, enableMarkdown }: { content: string; enableMarkdown?: boolean }) {
  if (!enableMarkdown) {
    return <div className="whitespace-pre-wrap">{content}</div>
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm dark:prose-invert max-w-none"
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              className="rounded-md my-2"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={cn("bg-muted px-1 py-0.5 rounded text-sm", className)} {...props}>
              {children}
            </code>
          )
        },
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        a: ({ href, children }) => (
          <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 italic my-2 text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full divide-y divide-border">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider bg-muted">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-sm border-t border-border">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

const ChatbotEnhanced = React.forwardRef<HTMLDivElement, ChatbotEnhancedProps>(
  (
    {
      className,
      messages = [],
      placeholder = "Type your message...",
      onSendMessage,
      onClear,
      disabled = false,
      showTimestamp = false,
      userAvatarUrl,
      userAvatarFallback = "You",
      assistantAvatarUrl,
      assistantAvatarFallback = "AI",
      maxHeight = "500px",
      enableMarkdown = true,
      enableFileUpload = false,
      acceptedFileTypes = "image/*,.pdf,.doc,.docx,.txt",
      maxFileSize = 10 * 1024 * 1024, // 10MB
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState("")
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

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
      if ((inputValue.trim() || selectedFiles.length > 0) && onSendMessage) {
        onSendMessage(inputValue.trim(), selectedFiles)
        setInputValue("")
        setSelectedFiles([])
        inputRef.current?.focus()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Validate file sizes and MIME types
    const validFiles = files.filter(file => {
      // Size validation
      if (file.size > maxFileSize) {
        console.warn(`File ${file.name} exceeds ${maxFileSize / 1024 / 1024}MB limit`)
        return false
      }
      
      // Basic MIME type validation
      const acceptedTypes = acceptedFileTypes.split(',').map(t => t.trim())
      const matchesType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase())
        }
        if (type.endsWith('/*')) {
          const category = type.split('/')[0]
          return file.type.startsWith(category + '/')
        }
        return file.type === type
      })
      
      if (!matchesType) {
        console.warn(`File ${file.name} type ${file.type} not accepted`)
        return false
      }
      
      return true
    })
    
    if (validFiles.length < files.length) {
      console.warn(`${files.length - validFiles.length} file(s) were rejected`)
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles])
  }

    const handleRemoveFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleClear = () => {
      if (onClear) {
        onClear()
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
        {/* Header with clear button */}
        {onClear && messages.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <span className="text-sm text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Messages area */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                Start a conversation...
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role !== "user" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={message.avatar || assistantAvatarUrl} />
                      <AvatarFallback>{message.avatarFallback || assistantAvatarFallback}</AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-[80%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <MessageContent content={message.content} enableMarkdown={enableMarkdown} />
                    {showTimestamp && message.timestamp && (
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp}
                      </div>
                    )}
                    {message.streaming && (
                      <div className="flex gap-1 mt-2">
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={message.avatar || userAvatarUrl} />
                      <AvatarFallback>{message.avatarFallback || userAvatarFallback}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-background border rounded px-2 py-1 text-xs"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => handleRemoveFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="flex items-center gap-2 p-4 border-t">
          {enableFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedFileTypes}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
          
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
            disabled={disabled || (!inputValue.trim() && selectedFiles.length === 0)}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }
)

ChatbotEnhanced.displayName = "ChatbotEnhanced"

export { ChatbotEnhanced }
