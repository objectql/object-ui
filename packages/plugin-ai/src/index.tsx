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
      { name: 'formId', type: 'string' },
      { name: 'objectName', type: 'string' },
      { name: 'fields', type: 'array' },
      { name: 'suggestions', type: 'code' },
      { name: 'autoFill', type: 'boolean' },
      { name: 'showConfidence', type: 'boolean' },
      { name: 'showReasoning', type: 'boolean' },
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
      { name: 'objectName', type: 'string' },
      { name: 'recommendations', type: 'code' },
      { name: 'maxResults', type: 'number' },
      { name: 'showScores', type: 'boolean' },
      { name: 'layout', type: 'enum', enum: [
        { label: 'List', value: 'list' },
        { label: 'Grid', value: 'grid' },
        { label: 'Carousel', value: 'carousel' },
      ] },
      { name: 'emptyMessage', type: 'string' },
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
      { name: 'objectName', type: 'string' },
      { name: 'placeholder', type: 'string' },
      { name: 'suggestions', type: 'array' },
      { name: 'showHistory', type: 'boolean' },
    ]
  }
);
