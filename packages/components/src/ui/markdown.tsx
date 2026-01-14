import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import { cn } from "@/lib/utils"

/**
 * Props for the Markdown component.
 * 
 * This component renders markdown content using react-markdown with GitHub Flavored Markdown support.
 * All content is sanitized to prevent XSS attacks.
 */
export interface MarkdownProps {
  /**
   * The markdown content to render. Supports GitHub Flavored Markdown including:
   * - Headers (H1-H6)
   * - Bold, italic, and inline code
   * - Links and images
   * - Lists (ordered, unordered, and nested)
   * - Tables
   * - Blockquotes
   * - Code blocks
   */
  content: string
  
  /**
   * Optional CSS class name to apply custom styling to the markdown container.
   * The component uses Tailwind CSS prose classes for typography by default.
   */
  className?: string
}

function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      data-slot="markdown"
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl",
        "prose-p:leading-relaxed prose-p:text-foreground",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:border",
        "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-ul:list-disc prose-ol:list-decimal",
        "prose-li:text-foreground prose-li:marker:text-muted-foreground",
        "prose-table:border prose-th:border prose-th:bg-muted prose-td:border",
        "prose-img:rounded-md prose-img:border",
        className
      )}
    >
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export { Markdown }
