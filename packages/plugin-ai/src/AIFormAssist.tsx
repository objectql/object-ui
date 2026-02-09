/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@object-ui/components';
import type { AIFormAssistSchema, AIFieldSuggestion } from '@object-ui/types';
import { Sparkles, Check, X, RefreshCw, Lightbulb } from 'lucide-react';

export interface AIFormAssistProps {
  schema: AIFormAssistSchema;
}

/**
 * AIFormAssist - AI-powered form filling assistant
 * Provides intelligent field suggestions based on context and historical data.
 */
export const AIFormAssist: React.FC<AIFormAssistProps> = ({ schema }) => {
  const {
    suggestions: initialSuggestions = [],
    showConfidence = true,
    showReasoning = false,
    autoFill = false,
  } = schema;

  const [suggestions, setSuggestions] = useState<AIFieldSuggestion[]>(initialSuggestions);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApply = (suggestion: AIFieldSuggestion) => {
    console.log('Apply suggestion:', suggestion);
    setAppliedFields(prev => new Set(prev).add(suggestion.fieldName));
  };

  const handleApplyAll = () => {
    console.log('Apply all suggestions:', suggestions);
    setAppliedFields(new Set(suggestions.map(s => s.fieldName)));
  };

  const handleDismiss = (fieldName: string) => {
    setSuggestions(prev => prev.filter(s => s.fieldName !== fieldName));
  };

  const handleRefresh = () => {
    setLoading(true);
    console.log('Refreshing AI suggestions...');
    // Simulate AI response
    setTimeout(() => setLoading(false), 1000);
  };

  if (dismissed || suggestions.length === 0) {
    return null;
  }

  const pendingSuggestions = suggestions.filter(s => !appliedFields.has(s.fieldName));
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.5) return 'secondary';
    return 'outline';
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            AI Suggestions
            <Badge variant="secondary" className="text-xs">
              {pendingSuggestions.length} suggestion{pendingSuggestions.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={loading}
              className="h-7"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {pendingSuggestions.length > 1 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleApplyAll}
                className="h-7 text-xs"
              >
                Apply All
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDismissed(true)}
              className="h-7"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {pendingSuggestions.map((suggestion) => (
          <div
            key={suggestion.fieldName}
            className="flex items-center gap-3 p-2 rounded-md bg-white border text-sm"
          >
            <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{suggestion.fieldName}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono text-blue-600 truncate">
                  {typeof suggestion.value === 'object' 
                    ? JSON.stringify(suggestion.value) 
                    : String(suggestion.value)}
                </span>
              </div>
              {showConfidence && (
                <div className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                  {Math.round(suggestion.confidence * 100)}% confidence
                </div>
              )}
              {showReasoning && suggestion.reasoning && (
                <div className="text-xs text-muted-foreground mt-1">
                  {suggestion.reasoning}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => handleApply(suggestion)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDismiss(suggestion.fieldName)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {/* Applied suggestions feedback */}
        {appliedFields.size > 0 && (
          <div className="text-xs text-green-600 flex items-center gap-1 pt-1">
            <Check className="h-3 w-3" />
            {appliedFields.size} suggestion{appliedFields.size !== 1 ? 's' : ''} applied
          </div>
        )}
      </CardContent>
    </Card>
  );
};
