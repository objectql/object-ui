/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - AI Schema
 *
 * Defines AI-related UI component schemas for intelligent form assistance,
 * recommendations, natural language queries, and data insights.
 */

import type { BaseSchema } from './base';

/**
 * AI Provider Type
 */
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';

/**
 * AI Model Type
 */
export type AIModelType = 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'gemini-pro' | 'custom';

/**
 * AI Configuration
 */
export interface AIConfig {
  /**
   * AI provider to use
   */
  provider?: AIProvider;

  /**
   * Model identifier
   */
  model?: AIModelType | string;

  /**
   * Custom API endpoint URL
   */
  apiEndpoint?: string;

  /**
   * Sampling temperature (0-1)
   */
  temperature?: number;

  /**
   * Maximum tokens for response
   */
  maxTokens?: number;

  /**
   * System prompt for the AI model
   */
  systemPrompt?: string;
}

/**
 * AI Field Suggestion
 */
export interface AIFieldSuggestion {
  /**
   * Name of the field being suggested
   */
  fieldName: string;

  /**
   * Suggested value for the field
   */
  value: any;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Explanation for the suggestion
   */
  reasoning?: string;
}

/**
 * AI Form Assist Schema - Intelligent form field suggestions
 */
export interface AIFormAssistSchema extends BaseSchema {
  type: 'ai-form-assist';

  /**
   * Target form identifier
   */
  formId?: string;

  /**
   * Object name for context
   */
  objectName?: string;

  /**
   * Fields to provide suggestions for
   */
  fields?: string[];

  /**
   * Additional context for generating suggestions
   */
  context?: Record<string, any>;

  /**
   * AI configuration
   */
  config?: AIConfig;

  /**
   * Current suggestions
   */
  suggestions?: AIFieldSuggestion[];

  /**
   * Automatically fill fields with suggestions
   */
  autoFill?: boolean;

  /**
   * Show confidence scores for suggestions
   */
  showConfidence?: boolean;

  /**
   * Show reasoning for suggestions
   */
  showReasoning?: boolean;

  /**
   * Callback when a suggestion is applied
   */
  onApplySuggestion?: string;

  /**
   * Callback when a suggestion is rejected
   */
  onRejectSuggestion?: string;
}

/**
 * AI Recommendation Item
 */
export interface AIRecommendationItem {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Recommendation title
   */
  title: string;

  /**
   * Recommendation description
   */
  description?: string;

  /**
   * Relevance score (0-1)
   */
  score: number;

  /**
   * Recommendation category
   */
  category?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Action to perform when selected
   */
  action?: {
    /**
     * Action type
     */
    type: string;

    /**
     * Action target
     */
    target?: string;
  };
}

/**
 * AI Recommendations Schema - Intelligent content recommendations
 */
export interface AIRecommendationsSchema extends BaseSchema {
  type: 'ai-recommendations';

  /**
   * Object name for context
   */
  objectName?: string;

  /**
   * Additional context for generating recommendations
   */
  context?: Record<string, any>;

  /**
   * AI configuration
   */
  config?: AIConfig;

  /**
   * Current recommendations
   */
  recommendations?: AIRecommendationItem[];

  /**
   * Maximum number of results to display
   */
  maxResults?: number;

  /**
   * Show relevance scores
   */
  showScores?: boolean;

  /**
   * Display layout
   */
  layout?: 'list' | 'grid' | 'carousel';

  /**
   * Callback when a recommendation is selected
   */
  onSelect?: string;

  /**
   * Callback when a recommendation is dismissed
   */
  onDismiss?: string;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Message to display when no recommendations are available
   */
  emptyMessage?: string;
}

/**
 * Natural Language Query Result
 */
export interface NLQueryResult {
  /**
   * Original query string
   */
  query: string;

  /**
   * Parsed query representation
   */
  parsedQuery?: Record<string, any>;

  /**
   * Result data
   */
  data?: any[];

  /**
   * Column definitions for the result data
   */
  columns?: Array<{
    /**
     * Column name
     */
    name: string;

    /**
     * Display label
     */
    label?: string;

    /**
     * Column data type
     */
    type?: string;
  }>;

  /**
   * AI-generated summary of the results
   */
  summary?: string;

  /**
   * Confidence score for the query interpretation (0-1)
   */
  confidence?: number;
}

/**
 * Natural Language Query Schema - Query data using natural language
 */
export interface NLQuerySchema extends BaseSchema {
  type: 'nl-query';

  /**
   * Object name for context
   */
  objectName?: string;

  /**
   * Input placeholder text
   */
  placeholder?: string;

  /**
   * AI configuration
   */
  config?: AIConfig;

  /**
   * Current query result
   */
  result?: NLQueryResult;

  /**
   * Example queries to suggest
   */
  suggestions?: string[];

  /**
   * Show query history
   */
  showHistory?: boolean;

  /**
   * Query history entries
   */
  history?: Array<{
    /**
     * Query string
     */
    query: string;

    /**
     * Timestamp of the query
     */
    timestamp: string;
  }>;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Callback when a query is submitted
   */
  onSubmit?: string;
}

/**
 * AI Insights Schema - AI-generated data insights and analysis
 */
export interface AIInsightsSchema extends BaseSchema {
  type: 'ai-insights';

  /**
   * Object name for context
   */
  objectName?: string;

  /**
   * Data to analyze
   */
  data?: any[];

  /**
   * AI configuration
   */
  config?: AIConfig;

  /**
   * Generated insights
   */
  insights?: Array<{
    /**
     * Insight title
     */
    title: string;

    /**
     * Insight description
     */
    description: string;

    /**
     * Insight type
     */
    type: 'trend' | 'anomaly' | 'prediction' | 'recommendation';

    /**
     * Severity level
     */
    severity?: 'info' | 'warning' | 'critical';

    /**
     * Associated metric
     */
    metric?: {
      /**
       * Metric value
       */
      value: number;

      /**
       * Change from previous period
       */
      change?: number;

      /**
       * Unit of measurement
       */
      unit?: string;
    };
  }>;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Automatically refresh insights
   */
  autoRefresh?: boolean;

  /**
   * Auto-refresh interval (in seconds)
   */
  refreshInterval?: number;
}
