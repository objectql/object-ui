import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Components / Edge Cases',
  component: SchemaRenderer,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

// ── Empty States ──────────────────────────────────────────────

export const EmptyStateDefault: Story = {
  name: 'Empty State – Default',
  render: renderStory,
  args: {
    type: 'empty',
    description: 'No items to display',
  } as any,
};

export const EmptyStateWithAction: Story = {
  name: 'Empty State – With Action',
  render: renderStory,
  args: {
    type: 'empty',
    description: 'No results found. Try a different search or create a new item.',
    children: [
      { type: 'button', content: 'Create New', variant: 'default', size: 'sm' },
    ],
  } as any,
};

// ── Loading / Spinner ─────────────────────────────────────────

export const SpinnerSmall: Story = {
  name: 'Spinner – Small',
  render: renderStory,
  args: {
    type: 'spinner',
    size: 'sm',
    className: 'text-primary',
  } as any,
};

export const SpinnerLarge: Story = {
  name: 'Spinner – Large',
  render: renderStory,
  args: {
    type: 'spinner',
    size: 'lg',
    className: 'text-primary',
  } as any,
};

export const LoadingWithText: Story = {
  name: 'Loading – With Text',
  render: renderStory,
  args: {
    type: 'loading',
    text: 'Please wait while we fetch your data…',
    className: 'h-[200px]',
  } as any,
};

// ── Overflow / Long Text ──────────────────────────────────────

const LONG_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.';

export const CardWithLongText: Story = {
  name: 'Card – Very Long Text',
  render: renderStory,
  args: {
    type: 'card',
    className: 'w-[350px]',
    title: 'This is an extremely long card title that should test how the component handles overflow and text wrapping gracefully',
    description: LONG_TEXT,
    children: [
      {
        type: 'text',
        content: LONG_TEXT + ' ' + LONG_TEXT,
      },
    ],
  } as any,
};

export const BadgeWithLongText: Story = {
  name: 'Badge – Very Long Text',
  render: renderStory,
  args: {
    type: 'badge',
    label: 'This is an unusually long badge label that tests truncation and overflow behaviour in tight layouts',
  } as any,
};

export const ButtonWithIconAndLongText: Story = {
  name: 'Button – Icon + Long Text',
  render: (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />,
  args: {
    type: 'button',
    props: { variant: 'default' },
    children: [
      { type: 'icon', name: 'download', className: 'mr-2 h-4 w-4' },
      {
        type: 'text',
        content: 'Download All Reports For The Current Financial Year Including Amendments',
      },
    ],
  } as any,
};

// ── RTL Layout ────────────────────────────────────────────────

export const RTLCard: Story = {
  name: 'RTL – Card Layout',
  render: (args: any) => (
    <div dir="rtl">
      <SchemaRenderer schema={args as unknown as BaseSchema} />
    </div>
  ),
  args: {
    type: 'card',
    className: 'w-[350px]',
    title: 'عنوان البطاقة',
    description: 'هذا النص باللغة العربية لاختبار تخطيط الاتجاه من اليمين إلى اليسار.',
    children: [
      { type: 'text', content: 'محتوى البطاقة الرئيسي يظهر هنا باللغة العربية.' },
    ],
    footer: [
      { type: 'button', props: { variant: 'outline' }, children: [{ type: 'text', content: 'إلغاء' }] },
      { type: 'button', children: [{ type: 'text', content: 'حفظ' }] },
    ],
  } as any,
};

export const RTLAlert: Story = {
  name: 'RTL – Alert',
  render: (args: any) => (
    <div dir="rtl">
      <SchemaRenderer schema={args as unknown as BaseSchema} />
    </div>
  ),
  args: {
    type: 'alert',
    variant: 'destructive',
    title: 'خطأ',
    description: 'انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مرة أخرى.',
    className: 'w-[400px]',
  } as any,
};
