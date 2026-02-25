/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from '@object-ui/components';
import type { ApprovalProcessSchema, ApprovalHistoryItem } from '@object-ui/types';
import { Check, X, MessageSquare, Clock, User, ArrowRight, RefreshCw } from 'lucide-react';

export interface ApprovalProcessProps {
  schema: ApprovalProcessSchema;
}

/**
 * ApprovalProcess - Displays and manages approval workflows
 * Shows current approval status, history, and action buttons for pending approvals.
 */
export const ApprovalProcess: React.FC<ApprovalProcessProps> = ({ schema }) => {
  const { 
    currentNodeId,
    approvalRule,
    history = [],
    data,
    showHistory = true,
    showComments = true,
  } = schema;

  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = (action: 'approve' | 'reject' | 'reassign') => {
    setIsSubmitting(true);
    console.log(`Approval action: ${action}`, { 
      currentNodeId, 
      comment, 
      data 
    });
    // Simulate async action
    setTimeout(() => {
      setIsSubmitting(false);
      setComment('');
    }, 500);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'approve':
      case 'approved':
        return <Badge variant="default" className="bg-green-500">Approved</Badge>;
      case 'reject':
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'reassign':
      case 'reassigned':
        return <Badge variant="secondary">Reassigned</Badge>;
      case 'comment':
        return <Badge variant="outline">Comment</Badge>;
      case 'escalate':
      case 'escalated':
        return <Badge variant="secondary" className="bg-orange-500 text-white">Escalated</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Approval
            {approvalRule && (
              <Badge variant="outline" className="ml-2">
                {approvalRule.type === 'any' && 'Any approver'}
                {approvalRule.type === 'all' && 'All must approve'}
                {approvalRule.type === 'majority' && 'Majority approval'}
                {approvalRule.type === 'sequential' && 'Sequential'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Summary */}
          {data && Object.keys(data).length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Request Details</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground">{key}: </span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comment Input */}
          {showComments && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                Comment
              </Label>
              <Input
                value={comment}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComment(e.target.value)}
                placeholder="Add a comment (optional)"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => handleAction('approve')} 
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleAction('reject')}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleAction('reassign')}
              disabled={isSubmitting}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reassign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approval History */}
      {showHistory && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((item: ApprovalHistoryItem, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="mt-0.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.actorName || item.actor}</span>
                      {getActionBadge(item.action)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {item.comment && (
                      <p className="text-sm text-muted-foreground mt-1">{item.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty History */}
      {showHistory && history.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No approval history yet
          </CardContent>
        </Card>
      )}
    </div>
  );
};
