# @object-ui/plugin-ai

AI-powered components for Object UI — form assistance, recommendations, and natural language queries.

## Features

- 🤖 **AI Form Assist** - Intelligent field suggestions and auto-fill for forms
- 💡 **AI Recommendations** - Display AI-generated recommendations in list, grid, or carousel layouts
- 🗣️ **Natural Language Query** - Let users query data using natural language
- 📦 **Auto-registered** - Components register with `ComponentRegistry` on import
- 🎯 **Type-Safe** - Full TypeScript support

## Installation

```bash
npm install @object-ui/plugin-ai
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

Every component in this package takes exactly one schema object plus optional
callbacks — `schema` carries the configuration, the callbacks carry the
behaviour. The schema types ship from `@object-ui/types`.

```tsx
import { AIFormAssist, AIRecommendations, NLQueryInput } from '@object-ui/plugin-ai';
import type {
  AIFormAssistSchema,
  AIRecommendationItem,
  AIRecommendationsSchema,
  NLQuerySchema,
} from '@object-ui/types';

declare const recommendationsData: AIRecommendationItem[];

const contactAssist: AIFormAssistSchema = {
  type: 'ai-form-assist',
  formId: 'new-contact',
  objectName: 'Contact',
  fields: ['name', 'email', 'company'],
  showConfidence: true,
};

function SmartForm() {
  return (
    <div>
      <AIFormAssist schema={contactAssist} />
    </div>
  );
}

const productPicks: AIRecommendationsSchema = {
  type: 'ai-recommendations',
  objectName: 'Product',
  maxResults: 5,
  layout: 'grid',
  recommendations: recommendationsData,
};

function RecommendationsPanel() {
  return <AIRecommendations schema={productPicks} />;
}

const orderSearch: NLQuerySchema = {
  type: 'nl-query',
  objectName: 'Order',
  placeholder: 'Ask a question about your orders...',
  suggestions: ['Show orders from last week', 'Top customers by revenue'],
};

function SearchBar() {
  return <NLQueryInput schema={orderSearch} />;
}
```

## API

### AIFormAssist

AI-powered form field suggestions and auto-fill. Props: `schema`, plus the
optional `onApply` and `onRefresh` callbacks.

```tsx
import { AIFormAssist } from '@object-ui/plugin-ai';
import type { AIFormAssistSchema } from '@object-ui/types';

const leadAssist: AIFormAssistSchema = {
  type: 'ai-form-assist',
  formId: 'new-lead',
  objectName: 'Lead',
  fields: ['name', 'email', 'phone'],
  autoFill: false,
  showConfidence: true,
  showReasoning: false,
};

const assistPanel = (
  <AIFormAssist
    schema={leadAssist}
    onApply={(suggestion) => console.log(suggestion.fieldName, suggestion.value)}
  />
);
```

### AIRecommendations

Display AI-generated recommendations. Props: `schema`, plus the optional
`onSelect` and `onDismiss` callbacks.

```tsx
import { AIRecommendations } from '@object-ui/plugin-ai';
import type { AIRecommendationItem, AIRecommendationsSchema } from '@object-ui/types';

declare const data: AIRecommendationItem[];

const productPicks: AIRecommendationsSchema = {
  type: 'ai-recommendations',
  objectName: 'Product',
  recommendations: data,
  maxResults: 10,
  layout: 'list', // 'list' | 'grid' | 'carousel'
  showScores: false,
  emptyMessage: 'No recommendations available',
};

const panel = (
  <AIRecommendations schema={productPicks} onSelect={(item) => console.log(item.id)} />
);
```

### NLQueryInput

Natural language query input for data exploration. Props: `schema`, plus the
optional `onSubmit` callback.

```tsx
import { NLQueryInput } from '@object-ui/plugin-ai';
import type { NLQuerySchema } from '@object-ui/types';

const orderSearch: NLQuerySchema = {
  type: 'nl-query',
  objectName: 'Order',
  placeholder: 'Ask anything...',
  suggestions: ['Recent orders', 'Revenue by month'],
  showHistory: false,
};

const searchBar = <NLQueryInput schema={orderSearch} onSubmit={(query) => console.log(query)} />;
```

## Schema-Driven Usage

Components auto-register with `ComponentRegistry` on import. The registry key is
the schema's `type`, and it is **not** always the component name — `NLQueryInput`
registers as `nl-query`:

| Component | Registry `type` | Schema type |
|---|---|---|
| `AIFormAssist` | `ai-form-assist` | `AIFormAssistSchema` |
| `AIRecommendations` | `ai-recommendations` | `AIRecommendationsSchema` |
| `NLQueryInput` | `nl-query` | `NLQuerySchema` |

```json
{
  "type": "ai-form-assist",
  "formId": "new-contact",
  "objectName": "Contact",
  "fields": ["name", "email"],
  "showConfidence": true
}
```

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-ai)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-ai)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
