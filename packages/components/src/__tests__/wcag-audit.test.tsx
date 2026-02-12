/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Comprehensive WCAG 2.1 AA audit for all ObjectUI Shadcn components.
 *
 * Runs axe-core against every UI primitive and custom component to verify
 * WCAG 2.1 AA compliance. Part of Q1 2026 roadmap §1.2.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import React from 'react';

// UI primitives
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  AspectRatio,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Progress,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Slider,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Spinner,
  Empty,
  EmptyTitle,
  EmptyDescription,
  Kbd,
} from '@object-ui/components';

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container);
  const violations = (results as any).violations || [];
  if (violations.length > 0) {
    const messages = violations.map(
      (v: any) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))`
    );
    throw new Error(`Expected no accessibility violations, but found ${violations.length}:\n${messages.join('\n')}`);
  }
}

describe('WCAG 2.1 AA Audit — UI Primitives', () => {
  // ---------- Layout & Structure ----------

  it('Accordion', async () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content for section 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Section 2</AccordionTrigger>
          <AccordionContent>Content for section 2</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    await expectNoViolations(container);
  });

  it('Alert', async () => {
    const { container } = render(
      <Alert>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>This is an alert description.</AlertDescription>
      </Alert>
    );
    await expectNoViolations(container);
  });

  it('AspectRatio', async () => {
    const { container } = render(
      <AspectRatio ratio={16 / 9}>
        <div>Content</div>
      </AspectRatio>
    );
    await expectNoViolations(container);
  });

  it('Avatar', async () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="" alt="User avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    await expectNoViolations(container);
  });

  it('Badge variants', async () => {
    const { container } = render(
      <div>
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>
    );
    await expectNoViolations(container);
  });

  it('Breadcrumb', async () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    await expectNoViolations(container);
  });

  it('Button variants', async () => {
    const { container } = render(
      <div>
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Destructive</Button>
        <Button disabled>Disabled</Button>
      </div>
    );
    await expectNoViolations(container);
  });

  it('Card', async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent><p>Content</p></CardContent>
        <CardFooter><Button>Action</Button></CardFooter>
      </Card>
    );
    await expectNoViolations(container);
  });

  // ---------- Form Controls ----------

  it('Checkbox with label', async () => {
    const { container } = render(
      <div className="flex items-center space-x-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms</Label>
      </div>
    );
    await expectNoViolations(container);
  });

  it('Input with label', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" type="text" />
      </div>
    );
    await expectNoViolations(container);
  });

  it('RadioGroup', async () => {
    const { container } = render(
      <RadioGroup defaultValue="option-1" aria-label="Choose option">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option-1" id="r1" />
          <Label htmlFor="r1">Option 1</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option-2" id="r2" />
          <Label htmlFor="r2">Option 2</Label>
        </div>
      </RadioGroup>
    );
    await expectNoViolations(container);
  });

  it('Select', async () => {
    const { container } = render(
      <Select>
        <SelectTrigger aria-label="Select a fruit">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>
    );
    await expectNoViolations(container);
  });

  it('Slider', async () => {
    // Radix Slider renders an internal thumb with role="slider".
    // The aria-label on Root propagates to the thumb element.
    const { container } = render(
      <Slider defaultValue={[50]} max={100} step={1} aria-label="Volume" />
    );
    await expectNoViolations(container);
  });

  it('Switch with label', async () => {
    const { container } = render(
      <div className="flex items-center space-x-2">
        <Switch id="airplane-mode" />
        <Label htmlFor="airplane-mode">Airplane Mode</Label>
      </div>
    );
    await expectNoViolations(container);
  });

  it('Textarea with label', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" placeholder="Type your message" />
      </div>
    );
    await expectNoViolations(container);
  });

  // ---------- Navigation ----------

  it('Pagination', async () => {
    const { container } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    await expectNoViolations(container);
  });

  it('Tabs', async () => {
    const { container } = render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );
    await expectNoViolations(container);
  });

  // ---------- Data Display ----------

  it('Table', async () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>alice@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    await expectNoViolations(container);
  });

  it('Progress', async () => {
    const { container } = render(
      <Progress value={66} aria-label="Upload progress" />
    );
    await expectNoViolations(container);
  });

  it('Separator', async () => {
    const { container } = render(
      <div>
        <p>Above</p>
        <Separator />
        <p>Below</p>
      </div>
    );
    await expectNoViolations(container);
  });

  it('ScrollArea', async () => {
    const { container } = render(
      <ScrollArea className="h-[200px] w-[200px]">
        <div style={{ height: 400 }}>Scrollable content</div>
      </ScrollArea>
    );
    await expectNoViolations(container);
  });

  it('Skeleton loading state', async () => {
    const { container } = render(
      <div role="status" aria-label="Loading">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    );
    await expectNoViolations(container);
  });

  // ---------- Toggles & Interactions ----------

  it('Toggle', async () => {
    const { container } = render(
      <Toggle aria-label="Toggle bold">
        <span>B</span>
      </Toggle>
    );
    await expectNoViolations(container);
  });

  it('ToggleGroup', async () => {
    const { container } = render(
      <ToggleGroup type="single" aria-label="Text alignment">
        <ToggleGroupItem value="left" aria-label="Align left">L</ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center">C</ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right">R</ToggleGroupItem>
      </ToggleGroup>
    );
    await expectNoViolations(container);
  });

  it('Collapsible', async () => {
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button>Toggle</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>
    );
    await expectNoViolations(container);
  });

  // ---------- Overlays ----------

  it('Tooltip', async () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Tooltip text</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    await expectNoViolations(container);
  });

  it('Dialog', async () => {
    const { container } = render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description text.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    await expectNoViolations(container);
  });
});

describe('WCAG 2.1 AA Audit — Custom Components', () => {
  it('Spinner', async () => {
    const { container } = render(<Spinner aria-label="Loading" />);
    await expectNoViolations(container);
  });

  it('Empty state', async () => {
    const { container } = render(
      <Empty>
        <EmptyTitle>No results</EmptyTitle>
        <EmptyDescription>Try a different search.</EmptyDescription>
      </Empty>
    );
    await expectNoViolations(container);
  });

  it('Kbd', async () => {
    const { container } = render(
      <p>Press <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> to save</p>
    );
    await expectNoViolations(container);
  });
});
