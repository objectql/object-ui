/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label } from '@object-ui/components';
import type { ReportSchedule, ReportScheduleFrequency, ReportExportFormat } from '@object-ui/types';
import { Calendar, Clock, Mail } from 'lucide-react';

export interface ScheduleConfigProps {
  schedule?: ReportSchedule;
  onChange?: (schedule: ReportSchedule) => void;
}

export const ScheduleConfig: React.FC<ScheduleConfigProps> = ({ schedule: initialSchedule, onChange }) => {
  const [schedule, setSchedule] = useState<ReportSchedule>(initialSchedule || {
    enabled: false,
    frequency: 'weekly',
    time: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recipients: [],
    formats: ['pdf'],
  });

  const handleChange = (updates: Partial<ReportSchedule>) => {
    const updated = { ...schedule, ...updates };
    setSchedule(updated);
    onChange?.(updated);
  };

  const frequencyOptions: { value: ReportScheduleFrequency; label: string }[] = [
    { value: 'once', label: 'Once' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const formatOptions: { value: ReportExportFormat; label: string }[] = [
    { value: 'pdf', label: 'PDF' },
    { value: 'excel', label: 'Excel' },
    { value: 'csv', label: 'CSV' },
    { value: 'html', label: 'HTML' },
  ];

  const dayOfWeekOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Schedule Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="schedule-enabled"
            checked={schedule.enabled || false}
            onChange={(e) => handleChange({ enabled: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="schedule-enabled">Enable Scheduled Report</Label>
        </div>

        {schedule.enabled && (
          <>
            {/* Frequency */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <select
                className="w-full border rounded-md p-2 bg-background"
                value={schedule.frequency || 'weekly'}
                onChange={(e) => handleChange({ frequency: e.target.value as ReportScheduleFrequency })}
              >
                {frequencyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Day of Week (for weekly) */}
            {schedule.frequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <select
                  className="w-full border rounded-md p-2 bg-background"
                  value={schedule.dayOfWeek ?? 1}
                  onChange={(e) => handleChange({ dayOfWeek: Number(e.target.value) })}
                >
                  {dayOfWeekOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Day of Month (for monthly) */}
            {schedule.frequency === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={schedule.dayOfMonth ?? 1}
                  onChange={(e) => handleChange({ dayOfMonth: Number(e.target.value) })}
                />
              </div>
            )}

            {/* Time */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time
              </Label>
              <Input
                type="time"
                value={schedule.time || '09:00'}
                onChange={(e) => handleChange({ time: e.target.value })}
              />
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={schedule.timezone || ''}
                onChange={(e) => handleChange({ timezone: e.target.value })}
                placeholder="e.g. America/New_York"
              />
            </div>

            {/* Export Formats */}
            <div className="space-y-2">
              <Label>Export Formats</Label>
              <div className="flex flex-wrap gap-2">
                {formatOptions.map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={schedule.formats?.includes(opt.value) || false}
                      onChange={(e) => {
                        const formats = schedule.formats || [];
                        handleChange({
                          formats: e.target.checked
                            ? [...formats, opt.value]
                            : formats.filter(f => f !== opt.value)
                        });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Recipients
              </Label>
              <Input
                placeholder="email1@example.com, email2@example.com"
                value={schedule.recipients?.join(', ') || ''}
                onChange={(e) => handleChange({
                  recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
              />
            </div>

            {/* Email Subject */}
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <Input
                value={schedule.subject || ''}
                onChange={(e) => handleChange({ subject: e.target.value })}
                placeholder="Scheduled Report: {report_title}"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
