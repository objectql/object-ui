import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';
import { KitchenSinkObject } from './src/objects/kitchen_sink.object';
import { AccountObject } from './src/objects/account.object';

export default defineStack({
  objects: [
    KitchenSinkObject,
    AccountObject
  ],
  apps: [
    App.create({
      name: 'kitchen_sink_app',
      label: 'Kitchen Sink',
      icon: 'layout',
      navigation: [
        {
          id: 'nav_kitchen',
          type: 'object',
          objectName: 'kitchen_sink',
          label: 'Components'
        },
        {
          id: 'nav_account',
          type: 'object',
          objectName: 'account',
          label: 'Reference Accounts'
        }
      ]
    })
  ],
  manifest: {
    id: 'com.example.kitchen-sink',
    version: '1.0.0',
    type: 'app',
    name: 'Kitchen Sink',
    description: 'Component Testing App',
    data: [
      {
        object: 'account',
        mode: 'upsert',
        records: [
          { _id: "1", name: "TechCorp" },
          { _id: "2", name: "Software Inc" }
        ]
      },
      {
        object: 'kitchen_sink',
        mode: 'upsert',
        records: [
          {
            _id: "1001",
            name: "Full Feature Test",
            description: "This record has every field populated.",
            amount: 42,
            price: 99.99,
            percent: 0.75,
            rating: 4,
            is_active: true,
            category: "opt_a",
            tags: ["col_red", "col_blue"],
            email: "test@example.com",
            url: "https://objectstack.org",
            phone: "+15551234567",
            code: "{\"foo\": \"bar\"}",
            due_date: "2024-12-31",
            account: "1"
          }
        ]
      }
    ]
  }
});
