import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarNav, type NavItem, type NavGroup } from '../SidebarNav';
import { SidebarProvider } from '@object-ui/components';
import {
  Home,
  Users,
  FolderOpen,
  BarChart,
  Settings,
  HelpCircle,
  Mail,
  Calendar,
  FileText,
  Shield,
} from 'lucide-react';

/**
 * SidebarNav stories demonstrating badges, nested items, search, and NavGroups.
 *
 * Part of Console integration: consume new engine schema capabilities
 * (HeaderBar, ViewSwitcher, SidebarNav, Airtable UX).
 */
const meta = {
  title: 'Layout/SidebarNav',
  component: SidebarNav,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/dashboard']}>
        <SidebarProvider defaultOpen style={{ height: '600px', border: '1px solid hsl(var(--border))' }}>
          <Story />
        </SidebarProvider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Navigation sidebar with React Router integration. Supports badges, nested collapsible items, grouped navigation, and built-in search filtering.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SidebarNav>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Basic flat items
// ---------------------------------------------------------------------------
const basicItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Contacts', href: '/contacts', icon: Users },
  { title: 'Projects', href: '/projects', icon: FolderOpen },
  { title: 'Reports', href: '/reports', icon: BarChart },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export const Default: Story = {
  args: {
    items: basicItems,
    title: 'My App',
  },
};

// ---------------------------------------------------------------------------
// With Badges
// ---------------------------------------------------------------------------
const itemsWithBadges: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Inbox', href: '/inbox', icon: Mail, badge: 12, badgeVariant: 'destructive' },
  { title: 'Contacts', href: '/contacts', icon: Users, badge: 342 },
  { title: 'Projects', href: '/projects', icon: FolderOpen, badge: '3 new', badgeVariant: 'outline' },
  { title: 'Calendar', href: '/calendar', icon: Calendar },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export const WithBadges: Story = {
  args: {
    items: itemsWithBadges,
    title: 'CRM App',
  },
};

// ---------------------------------------------------------------------------
// Nested Items (collapsible children)
// ---------------------------------------------------------------------------
const nestedItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  {
    title: 'Projects',
    href: '/projects',
    icon: FolderOpen,
    badge: 5,
    children: [
      { title: 'Active', href: '/projects/active' },
      { title: 'Archived', href: '/projects/archived' },
      { title: 'Templates', href: '/projects/templates', badge: 2 },
    ],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart,
    children: [
      { title: 'Sales', href: '/reports/sales' },
      { title: 'Marketing', href: '/reports/marketing', badge: 'New', badgeVariant: 'outline' },
      { title: 'Finance', href: '/reports/finance' },
    ],
  },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export const NestedItems: Story = {
  args: {
    items: nestedItems,
    title: 'Enterprise App',
  },
};

// ---------------------------------------------------------------------------
// NavGroup — grouped navigation
// ---------------------------------------------------------------------------
const groupedItems: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Inbox', href: '/inbox', icon: Mail, badge: 5, badgeVariant: 'destructive' },
    ],
  },
  {
    label: 'Content',
    items: [
      { title: 'Documents', href: '/documents', icon: FileText, badge: 23 },
      { title: 'Projects', href: '/projects', icon: FolderOpen },
      { title: 'Calendar', href: '/calendar', icon: Calendar },
    ],
  },
  {
    label: 'Admin',
    items: [
      { title: 'Users', href: '/admin/users', icon: Users },
      { title: 'Permissions', href: '/admin/permissions', icon: Shield },
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export const GroupedNavigation: Story = {
  args: {
    items: groupedItems,
  },
};

// ---------------------------------------------------------------------------
// Search Enabled
// ---------------------------------------------------------------------------
export const WithSearch: Story = {
  args: {
    items: groupedItems,
    searchEnabled: true,
    searchPlaceholder: 'Filter navigation...',
  },
};

// ---------------------------------------------------------------------------
// Full featured: badges + nested + groups + search
// ---------------------------------------------------------------------------
const fullFeaturedGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Inbox', href: '/inbox', icon: Mail, badge: 8, badgeVariant: 'destructive' },
      {
        title: 'Projects',
        href: '/projects',
        icon: FolderOpen,
        badge: 3,
        children: [
          { title: 'Design System', href: '/projects/design' },
          { title: 'API v2', href: '/projects/api', badge: 'WIP', badgeVariant: 'outline' },
          { title: 'Mobile App', href: '/projects/mobile' },
        ],
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        title: 'Reports',
        href: '/reports',
        icon: BarChart,
        children: [
          { title: 'Revenue', href: '/reports/revenue' },
          { title: 'Users', href: '/reports/users', badge: 'New', badgeVariant: 'outline' },
        ],
      },
      { title: 'Calendar', href: '/calendar', icon: Calendar },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Settings', href: '/settings', icon: Settings },
      { title: 'Help', href: '/help', icon: HelpCircle },
    ],
  },
];

export const FullFeatured: Story = {
  args: {
    items: fullFeaturedGroups,
    searchEnabled: true,
    searchPlaceholder: 'Search navigation...',
  },
};
