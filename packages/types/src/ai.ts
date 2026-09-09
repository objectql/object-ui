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

import type { BaseSchema } from './base.js';

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
   * RETIRED (objectui#8178, ADR-0049, director decision batch #78, 2026-09-07) —
   * `AIFormAssist` takes `({ schema, onApply, onRefresh })` and never reads
   * `formId`: the key named a form nothing looked up. Measured on the retiring
   * branch's own head, whole package: zero occurrences of the identifier in
   * `AIFormAssist.tsx`, with the sibling `showConfidence` (2 occurrences: the
   * destructure and its read) lit as the control, and zero `{...props}` /
   * `{...rest}` spreads anywhere in `@object-ui/plugin-ai` — the
   * `SchemaRenderer` prop channel objectui#8410 found (a renderer consuming a
   * key it never names) does not exist in this package, with
   * `components/src/renderers/disclosure/collapsible.tsx` lit as that
   * instrument's control.
   *
   * A tombstone rather than a plain removal on PRONG 2 of the discriminator
   * (objectui#5941, #7526, #7678): this package's README taught the key as
   * working, in the Quick Start, in the `AIFormAssist` API example and in the
   * schema-driven JSON example. {@link BaseSchema} carries `[key: string]: any`,
   * so a DELETED member is absorbed silently at ANY value — deletion here is not
   * a quieter refusal, it is no refusal — and the tombstone is what makes the
   * compile-time refusal exist, by name.
   *
   * ⛔ Not enforced instead (the ruling's words): implementing reads nobody asked
   * for is capability growth without pull. If an AI backend later needs the
   * form's identity as context, that is a feature card with its own business
   * case.
   * @deprecated Not part of this contract — the value was inert.
   */
  formId?: never;

  /**
   * RETIRED (objectui#8178, ADR-0049, director decision batch #78, 2026-09-07) — see
   * {@link AIFormAssistSchema.formId} for the measurement and the tombstone's
   * grounds. `AIFormAssist.tsx` has zero occurrences of `objectName`; the
   * component reaches no data source at all (it imports nothing from
   * `@object-ui/core`, so the shared record-source ladder that reads
   * `schema.objectName` for the grid/tree/map/calendar/gantt blocks is not on
   * any path a node of this type can take).
   * @deprecated Not part of this contract — the value was inert.
   */
  objectName?: never;

  /**
   * RETIRED (objectui#8178, ADR-0049, director decision batch #78, 2026-09-07) — see
   * {@link AIFormAssistSchema.formId}. Zero occurrences in `AIFormAssist.tsx`:
   * the suggestions the component renders come in already-formed on
   * `suggestions`, each carrying its own `fieldName`, so this key never chose
   * anything.
   * @deprecated Not part of this contract — the value was inert.
   */
  fields?: never;

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
   * RETIRED (objectui#8178, ADR-0049, director decision batch #78, 2026-09-07) — see
   * {@link AIFormAssistSchema.formId}. This one was a DEAD DESTRUCTURE rather
   * than an absent one: `AIFormAssist.tsx` destructured `autoFill = false` and
   * never referenced the binding again — the single occurrence of the identifier
   * in the file was that line, against `showConfidence` and `showReasoning` at
   * two each (destructure plus read). Nothing was ever filled automatically.
   * @deprecated Not part of this contract — the value was inert.
   */
  autoFill?: never;

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
   * RETIRED (objectui#8178, ADR-0049, director decision batch #78, 2026-09-07) — see
   * {@link AIFormAssistSchema.formId} for the measurement and the tombstone's
   * grounds. Zero occurrences in `AIRecommendations.tsx`, which renders the
   * `recommendations` it is handed and fetches nothing.
   * @deprecated Not part of this contract — the value was inert.
   */
  objectName?: never;

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
   * RETIRED (objectui#8178, ADR-0049, director decision batch #78, 2026-09-07) — the
   * sharpest member of the seven, and the reason the finding was filed. Its doc
   * comment read *"Maximum number of results to display"*, and
   * `AIRecommendations` renders EVERY item in `recommendations` — no slice, no
   * cap, zero occurrences of the identifier in the component. An author who
   * wrote `maxResults: 5` against a 50-item list got 50 rows and no diagnostic.
   *
   * ⛔ Not implemented as a slice instead: that is the Enforce direction the
   * ruling declined — nothing in the repo pulls on it. The renderer's docblock
   * now states that it renders every item, so the promise is withdrawn rather
   * than left unhonoured, and `AIRecommendations.rendersEveryItem-8178.test.tsx`
   * pins the behaviour. Cap the array before you hand it over.
   * @deprecated Not part of this contract — the value was inert.
   */
  maxResults?: never;

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
   * RETIRED (objectui#8178, ADR-0049, director decision batch #78, 2026-09-07) — see
   * {@link AIFormAssistSchema.formId} for the measurement and the tombstone's
   * grounds. Zero occurrences in `NLQueryInput.tsx`: the component collects a
   * query string and hands it to `onSubmit`, and any object scoping belongs to
   * the host that answers it.
   * @deprecated Not part of this contract — the value was inert.
   */
  objectName?: never;

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
