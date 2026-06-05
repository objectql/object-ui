/**
 * Dev-only harness for the lightweight list primitives (SDUI opt #1):
 * element:definition-list (compact key/value) and element:repeater (chrome-free
 * data-bound list). Bound to live showcase_category — the "simple data shouldn't
 * need a full data-grid" case. Not part of the product nav.
 */
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';

const defList = {
  type: 'element:definition-list',
  properties: {
    columns: 2,
    items: [
      { term: 'Status', description: 'Active' },
      { term: 'Owner', description: 'Ada Lovelace' },
      { term: 'Plan', description: 'Enterprise' },
      { term: 'Renewal', description: '2026-12-01' },
    ],
  },
};

const repeater = {
  type: 'element:repeater',
  properties: {
    object: 'showcase_category',
    titleField: 'name',
    fields: ['color'],
    limit: 10,
    emptyText: 'No categories',
  },
};

export const DevLists: React.FC = () => (
  <div className="mx-auto max-w-2xl space-y-8 p-6">
    <div>
      <h1 className="mb-3 text-lg font-semibold">Dev · element:definition-list</h1>
      <div className="rounded-lg border p-4">
        <SchemaRenderer schema={defList as any} />
      </div>
    </div>
    <div>
      <h1 className="mb-3 text-lg font-semibold">Dev · element:repeater (showcase_category)</h1>
      <div className="rounded-lg border p-4">
        <SchemaRenderer schema={repeater as any} />
      </div>
    </div>
  </div>
);

export default DevLists;
