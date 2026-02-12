import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { AppShell, PageHeader, ResponsiveGrid } from '@object-ui/layout';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@object-ui/components';

/**
 * AppShell responsive layout stories.
 * Demonstrates the shell + responsive grid working together.
 *
 * Part of Q1 2026 roadmap §1.3 — Responsive layout stories in Storybook.
 */
const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The application shell provides a sidebar + main content area. ' +
          'Combine with ResponsiveGrid for fully responsive page layouts.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function SampleSidebar() {
  return (
    <nav className="p-4 space-y-2" aria-label="Main navigation">
      {['Dashboard', 'Contacts', 'Tasks', 'Reports', 'Settings'].map((item) => (
        <div
          key={item}
          className="px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer"
        >
          {item}
        </div>
      ))}
    </nav>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export const ResponsiveDashboard: Story = {
  name: 'Responsive Dashboard',
  args: {
    sidebar: <SampleSidebar />,
    children: (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Dashboard"
          description="Key metrics overview"
          action={<Button size="sm">Export</Button>}
        />
        <ResponsiveGrid columns={{ xs: 1, sm: 2, xl: 4 }} gap={4}>
          <MetricCard title="Revenue" value="$45,231" />
          <MetricCard title="Users" value="2,350" />
          <MetricCard title="Orders" value="1,247" />
          <MetricCard title="Growth" value="+12.5%" />
        </ResponsiveGrid>
        <ResponsiveGrid columns={{ xs: 1, lg: 2 }} gap={4}>
          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent><div className="h-48 bg-muted rounded" /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Analytics</CardTitle></CardHeader>
            <CardContent><div className="h-48 bg-muted rounded" /></CardContent>
          </Card>
        </ResponsiveGrid>
      </div>
    ),
  },
};

export const MinimalShell: Story = {
  name: 'Minimal (No Sidebar)',
  args: {
    children: (
      <div className="p-6">
        <PageHeader title="Settings" description="Manage your preferences" />
        <ResponsiveGrid columns={{ xs: 1, md: 2 }} gap={4}>
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Security</CardTitle></CardHeader>
            <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
          </Card>
        </ResponsiveGrid>
      </div>
    ),
  },
};
