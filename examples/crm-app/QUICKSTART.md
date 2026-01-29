# CRM App - Quick Start Guide

Get the CRM demo running in **3 minutes** with MSW (Mock Service Worker).

## Prerequisites

- Node.js 18+ and pnpm installed
- Basic understanding of React

## Installation

### 1. Clone and Install

```bash
# From the repository root
pnpm install
```

### 2. Navigate to Example

```bash
cd examples/crm-app
```

### 3. Start Development Server

```bash
pnpm dev
```

The application will start at `http://localhost:5173`.

## What You'll See

### 🏠 Dashboard Page
- Revenue: $125,000
- Active Leads: 45
- Open Deals: 12
- Recent contacts list

### 👥 Contacts Page
- Grid view of all contacts
- Search and filter capabilities
- Click any row to view details
- Create new contacts with the form

### 💼 Opportunities Page
- Sales opportunities pipeline
- Stage-based tracking
- Amount and close date information

## How It Works

### MSW Service Worker

When you run `pnpm dev`, the app automatically:

1. Starts the MSW service worker in the browser
2. Loads the ObjectStack Runtime with in-memory database
3. Seeds initial data (3 contacts, 3 opportunities)
4. Intercepts all `/api/v1/*` requests
5. Handles CRUD operations in memory

**No backend server needed!** Everything runs in your browser.

### Browser Console Logs

Open DevTools Console to see:

```
🛑 Bootstrapping Mock Server...
[MSW] Starting ObjectStack Runtime (Browser Mode)...
[MSW] Loaded Config: Found 2
[MSW] Objects in Config: contact, opportunity, account
[Kernel] Bootstrapping...
[Kernel] Bootstrap Complete
[MockServer] Initializing mock data...
🔌 Connecting Clients...
🚀 Rendering App...
```

## Making Changes

### Add a New Contact

1. Navigate to `/contacts`
2. Scroll to "Object Form (Create Contact)" section
3. Fill in the form:
   - Name: "John Doe"
   - Email: "john@example.com"
   - Phone: "555-1234"
   - Company: "Acme Corp"
4. Click "Create"

The contact will be added to the in-memory database and appear in the grid immediately.

### Edit Contact Data

Contact data is defined in `examples/crm/objectstack.config.ts`:

```typescript
data: [
  {
    object: 'contact',
    mode: 'upsert',
    records: [
      { 
        _id: "1", 
        name: "Alice Johnson", 
        email: "alice@example.com", 
        // ... add more fields
      }
    ]
  }
]
```

After editing, refresh the browser to see changes.

### Customize the Schema

Object definitions are in `examples/crm/src/objects/`:

- `contact.object.ts` - Contact fields and validation
- `opportunity.object.ts` - Opportunity fields
- `account.object.ts` - Account/company fields

Example: Add a new field to Contact:

```typescript
// examples/crm/src/objects/contact.object.ts
fields: {
  name: { type: 'text', required: true },
  email: { type: 'email', required: true },
  phone: { type: 'text' },
  linkedin: { type: 'text', label: 'LinkedIn Profile' }, // NEW FIELD
  // ...
}
```

## Testing API Calls

### Using Browser DevTools

1. Open Network tab
2. Filter by `Fetch/XHR`
3. Perform actions in the app
4. See requests to `/api/v1/*` intercepted by MSW

### Using Console

```javascript
// In browser console
const client = window.client; // If exposed
const contacts = await fetch('/api/v1/contact').then(r => r.json());
console.log(contacts);
```

## Common Tasks

### Reset Data

Refresh the browser - the in-memory database is cleared and reseeded.

### Debug MSW

Check `src/mocks/browser.ts` - `logRequests: true` enables detailed request logging.

### Add Custom API Endpoints

Edit `src/mocks/browser.ts` and add to `customHandlers`:

```typescript
customHandlers: [
  http.get('/api/custom-endpoint', async () => {
    return HttpResponse.json({ message: 'Custom response' });
  })
]
```

## Next Steps

1. **Explore the Code**: Check `src/App.tsx` to see how schemas are rendered
2. **Modify Schemas**: Edit `src/schemas/*.ts` to change UI layouts
3. **Add Features**: Create new pages, forms, or widgets
4. **Read Documentation**: See main [README.md](./README.md) for architecture details

## Troubleshooting

### MSW not intercepting requests?

- Check browser console for MSW registration messages
- Ensure `public/mockServiceWorker.js` exists
- Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Module not found errors?

```bash
# Rebuild workspace packages
cd ../../
pnpm install
pnpm build
```

### Port already in use?

Vite will automatically use the next available port. Check the terminal output.

## Getting Help

- Check the [main README](./README.md) for detailed architecture
- Review [ObjectStack docs](https://objectstack.ai)
- Inspect browser console logs for errors
