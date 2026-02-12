import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ResponsiveGrid } from '@object-ui/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@object-ui/components';

/**
 * ResponsiveGrid stories demonstrating spec-aligned responsive layouts.
 * Uses BreakpointColumnMapSchema to configure columns per breakpoint.
 *
 * Part of Q1 2026 roadmap §1.3 — Responsive layout stories in Storybook.
 */
const meta = {
  title: 'Layout/ResponsiveGrid',
  component: ResponsiveGrid,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A responsive grid layout that consumes @objectstack/spec BreakpointColumnMapSchema. ' +
          'Columns adjust automatically at each breakpoint using pure Tailwind CSS.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ResponsiveGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Placeholder card for demos */
function DemoCard({ label }: { label: string }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-16 rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

const items = Array.from({ length: 6 }, (_, i) => (
  <DemoCard key={i} label={`Card ${i + 1}`} />
));

// --- Stories ---

export const Default: Story = {
  args: {
    columns: { xs: 1, sm: 2, lg: 3 },
    gap: 4,
    children: items,
  },
};

export const SingleColumn: Story = {
  args: {
    columns: { xs: 1 },
    gap: 4,
    children: items.slice(0, 3),
  },
};

export const TwoColumns: Story = {
  args: {
    columns: { xs: 1, sm: 2 },
    gap: 4,
    children: items.slice(0, 4),
  },
};

export const FourColumnGrid: Story = {
  args: {
    columns: { xs: 1, sm: 2, md: 3, lg: 4 },
    gap: 4,
    children: items,
  },
};

export const DashboardLayout: Story = {
  name: 'Dashboard Layout (1 → 2 → 4)',
  args: {
    columns: { xs: 1, sm: 2, xl: 4 },
    gap: 6,
    children: Array.from({ length: 8 }, (_, i) => (
      <DemoCard key={i} label={`Metric ${i + 1}`} />
    )),
  },
};

export const CompactGap: Story = {
  name: 'Compact Gap (gap-2)',
  args: {
    columns: { xs: 2, md: 3 },
    gap: 2,
    children: items,
  },
};

export const WideGap: Story = {
  name: 'Wide Gap (gap-8)',
  args: {
    columns: { xs: 1, md: 2 },
    gap: 8,
    children: items.slice(0, 4),
  },
};
