/**
 * Object Detail Tabs Widget
 *
 * Self-contained, schema-driven tabbed widget for the object detail page.
 * Organizes object configuration into logical tabs similar to Power Apps:
 * - Details: Object properties and basic information
 * - Fields: Field designer for managing object fields
 * - Relationships: Relationships and unique keys
 * - Data: Data preview and experience placeholders
 *
 * Schema: { type: 'object-detail-tabs', objectName: 'account' }
 *
 * @module components/schema/ObjectDetailTabsWidget
 */

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@object-ui/components';
import { Settings2, Columns, Link2, Table } from 'lucide-react';
import type { SchemaNode } from '@object-ui/core';
import { SchemaRenderer } from '@object-ui/react';

/** Schema props for object detail tabs widget. */
interface ObjectDetailTabsSchema extends SchemaNode {
  objectName: string;
}

export function ObjectDetailTabsWidget({ schema }: { schema: ObjectDetailTabsSchema }) {
  const objectName = schema.objectName;
  const [activeTab, setActiveTab] = useState('details');

  // Create schema objects for each widget
  const detailsSchema: SchemaNode & { objectName: string } = {
    type: 'object-properties',
    id: `${objectName}-properties`,
    objectName,
  };

  const fieldsSchema: SchemaNode & { objectName: string } = {
    type: 'object-field-designer',
    id: `${objectName}-field-designer`,
    objectName,
  };

  const relationshipsSchema: SchemaNode & { objectName: string } = {
    type: 'object-relationships',
    id: `${objectName}-relationships`,
    objectName,
  };

  const keysSchema: SchemaNode & { objectName: string } = {
    type: 'object-keys',
    id: `${objectName}-keys`,
    objectName,
  };

  const dataExperienceSchema: SchemaNode & { objectName: string } = {
    type: 'object-data-experience',
    id: `${objectName}-data-experience`,
    objectName,
  };

  const dataPreviewSchema: SchemaNode & { objectName: string } = {
    type: 'object-data-preview',
    id: `${objectName}-data-preview`,
    objectName,
  };

  return (
    <div className="w-full" data-testid="object-detail-tabs">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          <TabsTrigger
            value="details"
            className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger
            value="fields"
            className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Columns className="h-4 w-4 mr-2" />
            Fields
          </TabsTrigger>
          <TabsTrigger
            value="relationships"
            className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Relationships
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Table className="h-4 w-4 mr-2" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="space-y-6">
            <SchemaRenderer schema={detailsSchema} />
          </div>
        </TabsContent>

        <TabsContent value="fields" className="mt-6">
          <div className="space-y-6">
            <SchemaRenderer schema={fieldsSchema} />
          </div>
        </TabsContent>

        <TabsContent value="relationships" className="mt-6">
          <div className="space-y-6">
            <SchemaRenderer schema={relationshipsSchema} />
            <SchemaRenderer schema={keysSchema} />
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <div className="space-y-6">
            <SchemaRenderer schema={dataPreviewSchema} />
            <SchemaRenderer schema={dataExperienceSchema} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
