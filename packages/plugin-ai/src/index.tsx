/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { AIFormAssist } from './AIFormAssist';
import { AIRecommendations } from './AIRecommendations';
import { NLQueryInput } from './NLQueryInput';

export { AIFormAssist, AIRecommendations, NLQueryInput };

// Register AI form assist component
ComponentRegistry.register(
  'ai-form-assist',
  AIFormAssist,
  {
    label: 'AI Form Assist',
    category: 'AI',
    inputs: [
      { name: 'formId', type: 'string', label: 'Form ID' },
      { name: 'objectName', type: 'string', label: 'Object Name' },
      { name: 'fields', type: 'array', label: 'Fields to suggest' },
      { name: 'suggestions', type: 'code', label: 'Suggestions Data' },
      { name: 'autoFill', type: 'boolean', label: 'Auto Fill', defaultValue: false },
      { name: 'showConfidence', type: 'boolean', label: 'Show Confidence', defaultValue: true },
      { name: 'showReasoning', type: 'boolean', label: 'Show Reasoning', defaultValue: false },
    ]
  }
);

// Register AI recommendations component
ComponentRegistry.register(
  'ai-recommendations',
  AIRecommendations,
  {
    label: 'AI Recommendations',
    category: 'AI',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name' },
      { name: 'recommendations', type: 'code', label: 'Recommendations Data' },
      { name: 'maxResults', type: 'number', label: 'Max Results', defaultValue: 10 },
      { name: 'showScores', type: 'boolean', label: 'Show Scores', defaultValue: false },
      { name: 'layout', type: 'enum', label: 'Layout', enum: [
        { label: 'List', value: 'list' },
        { label: 'Grid', value: 'grid' },
        { label: 'Carousel', value: 'carousel' },
      ], defaultValue: 'list' },
      { name: 'emptyMessage', type: 'string', label: 'Empty Message' },
    ]
  }
);

// Register NL Query component
ComponentRegistry.register(
  'nl-query',
  NLQueryInput,
  {
    label: 'Natural Language Query',
    category: 'AI',
    inputs: [
      { name: 'objectName', type: 'string', label: 'Object Name' },
      { name: 'placeholder', type: 'string', label: 'Placeholder Text' },
      { name: 'suggestions', type: 'array', label: 'Example Queries' },
      { name: 'showHistory', type: 'boolean', label: 'Show History', defaultValue: false },
    ]
  }
);
