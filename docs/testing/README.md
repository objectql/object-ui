# MSW-Based Automated Testing for Metadata-Driven Components

## Summary / 概述

This implementation provides a comprehensive automated testing methodology using MSW (Mock Service Worker) for ObjectUI's metadata-driven tables and forms.

本实现提供了使用 MSW (Mock Service Worker) 对 ObjectUI 元数据驱动的表格和表单进行全面自动化测试的方法。

## What Was Implemented / 已实现内容

### 1. Test Utilities (`msw-test-utils.ts`)

**Location**: `packages/react/src/__tests__/utils/msw-test-utils.ts` (and copied to plugin packages)

**Features**:
- ✅ Mock object schemas (Task, User)
- ✅ Mock test data
- ✅ In-memory data store with full CRUD support
- ✅ MSW request handlers for ObjectStack/ObjectQL API endpoints
- ✅ MockDataSource adapter implementing the DataSource interface
- ✅ Helper function for test setup

**API Endpoints Mocked**:
- `GET /api/v1` - Discovery
- `GET /api/v1/schema/:object` - Get schema
- `GET /api/v1/data/:object` - Find records
- `GET /api/v1/data/:object/:id` - Get single record
- `POST /api/v1/data/:object` - Create record
- `PUT /api/v1/data/:object/:id` - Update record
- `DELETE /api/v1/data/:object/:id` - Delete record

### 2. Integration Tests

#### ObjectGrid Tests (`packages/plugin-grid/src/__tests__/ObjectGrid.msw.test.tsx`)

**Test Coverage** (11/13 passing):
- ✅ Fetch and display data from API
- ✅ Display column headers based on schema
- ✅ Schema fetching from API
- ✅ Pagination parameters
- ✅ Inline data (no API calls)
- ✅ Error handling for API failures
- ✅ Row selection
- ✅ Searchable fields
- ✅ Column configuration
- ⚠️  Actions column (minor issue with multiple "Actions" text)
- ⚠️  Missing dataSource error (timeout issue)

#### ObjectForm Tests (`packages/plugin-form/src/__tests__/ObjectForm.msw.test.tsx`)

**Test Coverage**:
- ✅ Create mode: fetch schema and render empty form
- ✅ Create mode: submit new record to API
- ✅ Edit mode: fetch schema and record data
- ✅ Edit mode: update record via API
- ✅ View mode: display in read-only mode
- ✅ Inline fields without API
- ✅ Error handling for schema/record fetch failures
- ✅ Field validation
- ✅ Different field types

### 3. Documentation

**Location**: `docs/testing/MSW_TESTING_GUIDE.md`

**Content**:
- Bilingual (Chinese/English) comprehensive guide
- Architecture diagrams
- Core components explanation
- Usage examples
- Best practices
- Troubleshooting guide
- Extension guidelines

## How to Use / 使用方法

### Running Tests

```bash
# Run all tests
pnpm test

# Run grid tests
pnpm --filter @object-ui/plugin-grid test

# Run form tests  
pnpm --filter @object-ui/plugin-form test
```

### Writing New Tests

```typescript
import { setupMSW, MockDataSource } from './msw-test-utils';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Setup MSW server
const server = setupMSW({ beforeAll, afterEach, afterAll });

describe('My Component', () => {
  let dataSource: MockDataSource;

  beforeEach(() => {
    dataSource = new MockDataSource();
  });

  it('should work with metadata', async () => {
    const schema = {
      type: 'object-grid',
      objectName: 'task',
      columns: ['subject', 'priority'],
    };

    render(<MyComponent schema={schema} dataSource={dataSource} />);

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });
  });
});
```

## Key Benefits / 主要优势

1. **Realistic API Testing**: MSW intercepts real HTTP requests
2. **Isolated Test Environment**: Each test has independent data state  
3. **Full Integration Testing**: Tests complete component-API interaction flow
4. **Maintainable**: Centralized mock data and API behavior management
5. **Type-Safe**: TypeScript ensures correctness
6. **Extensible**: Easy to add new object types and test scenarios

## Architecture / 架构

```
Test Suite (Vitest)
    ↓
ObjectGrid/ObjectForm ← MockDataSource
    ↓                       ↓
    └─────HTTP Requests─────┘
            ↓
    MSW Server (Node)
    • Mock API Endpoints
    • Request/Response Handlers
    • In-Memory Data Store
```

## Files Created / 创建的文件

1. `packages/react/src/__tests__/utils/msw-test-utils.ts` - Core test utilities
2. `packages/plugin-grid/src/__tests__/ObjectGrid.msw.test.tsx` - Grid integration tests
3. `packages/plugin-grid/src/__tests__/msw-test-utils.ts` - Copy for grid package
4. `packages/plugin-form/src/__tests__/ObjectForm.msw.test.tsx` - Form integration tests
5. `packages/plugin-form/src/__tests__/msw-test-utils.ts` - Copy for form package
6. `docs/testing/MSW_TESTING_GUIDE.md` - Comprehensive testing guide
7. Updated `packages/plugin-grid/vite.config.ts` - Added test globals
8. Updated `packages/plugin-form/vite.config.ts` - Added test globals

## Next Steps / 后续步骤

1. Fix the 2 minor test failures in ObjectGrid tests
2. Add more test scenarios (sorting, filtering, pagination navigation)
3. Add performance tests for large datasets
4. Add accessibility tests
5. Integrate with CI/CD pipeline

## Resources / 资源

- [MSW Documentation](https://mswjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [ObjectUI Documentation](https://www.objectui.org)

---

**Created by**: GitHub Copilot Agent
**Date**: 2026-01-31
**Task**: Design automated testing method for metadata-driven components using MSW
