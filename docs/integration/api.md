# API Integration Guide

Object UI provides powerful API integration capabilities, allowing components to fetch data, submit forms, and trigger actions through REST APIs.

## Overview

API integration in Object UI supports:

- 🔄 **Automatic Data Fetching** - Components fetch data on mount or on demand
- 🔃 **Real-time Updates** - Polling for live data updates
- 📤 **Form Submission** - Submit forms to APIs with validation
- ⚡ **Event-Driven Actions** - Trigger API calls from user interactions
- 🔁 **Request/Response Transformation** - Transform data before sending or after receiving
- 🔒 **Authentication** - Send credentials and custom headers
- ⏱️ **Retry & Timeout** - Configure retry logic and timeouts
- 💾 **Caching** - Cache responses for better performance

## Data Fetching

### Basic Data Fetching

Use `dataSource` to fetch data automatically:

```json
{
  "type": "div",
  "dataSource": {
    "api": "https://api.example.com/users"
  },
  "body": {
    "type": "list",
    "items": "${data}"
  }
}
```

### Advanced Data Fetching

```json
{
  "type": "div",
  "dataSource": {
    "api": {
      "url": "https://api.example.com/users",
      "method": "GET",
      "headers": {
        "Authorization": "Bearer ${env.token}"
      },
      "params": {
        "page": 1,
        "limit": 10
      }
    },
    "fetchOnMount": true,
    "pollInterval": 30000,
    "transform": "data => data.users",
    "filter": "user => user.active",
    "sort": {
      "field": "name",
      "order": "asc"
    },
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "enabled": true
    }
  }
}
```

### Configuration Options

| Property | Type | Description |
|----------|------|-------------|
| `api` | `string \| APIRequest` | API endpoint or full request config |
| `fetchOnMount` | `boolean` | Fetch data when component mounts (default: true) |
| `pollInterval` | `number` | Polling interval in milliseconds |
| `dependencies` | `string[]` | Variables to watch for refetching |
| `defaultData` | `any` | Default data before fetch completes |
| `transform` | `string` | Transform function for response data |
| `filter` | `string` | Filter function for data |
| `sort` | `object` | Sort configuration |
| `pagination` | `object` | Pagination configuration |

## API Requests

### Request Configuration

```typescript
interface APIRequest {
  url: string;              // API endpoint (supports ${} variables)
  method?: HTTPMethod;      // GET, POST, PUT, DELETE, PATCH
  headers?: object;         // Request headers
  data?: any;              // Request body (for POST/PUT/PATCH)
  params?: object;         // Query parameters
  timeout?: number;        // Request timeout in ms
  withCredentials?: boolean; // Send cookies
  transformRequest?: string; // Transform before sending
  transformResponse?: string; // Transform after receiving
}
```

### Example Requests

**Simple GET:**
```json
{
  "api": {
    "url": "/api/users",
    "method": "GET"
  }
}
```

**POST with Data:**
```json
{
  "api": {
    "url": "/api/users",
    "method": "POST",
    "data": {
      "name": "${form.name}",
      "email": "${form.email}"
    }
  }
}
```

**With Headers:**
```json
{
  "api": {
    "url": "/api/users",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer ${env.token}",
      "X-Custom-Header": "value"
    }
  }
}
```

**With Query Parameters:**
```json
{
  "api": {
    "url": "/api/users",
    "method": "GET",
    "params": {
      "page": "${state.page}",
      "limit": 10,
      "search": "${state.search}"
    }
  }
}
```

## Event Handlers

### API Event Handler

Trigger API calls from user interactions:

```json
{
  "type": "button",
  "label": "Save",
  "onClick": {
    "type": "api",
    "api": {
      "request": {
        "url": "/api/save",
        "method": "POST",
        "data": "${form}"
      },
      "successMessage": "Saved successfully!",
      "errorMessage": "Save failed",
      "showLoading": true,
      "reload": true,
      "redirect": "/success"
    }
  }
}
```

### API Configuration

```typescript
interface APIConfig {
  request?: APIRequest;
  onSuccess?: string;         // Success handler expression
  onError?: string;          // Error handler expression
  showLoading?: boolean;     // Show loading indicator
  successMessage?: string;   // Success toast message
  errorMessage?: string;     // Error toast message
  reload?: boolean;         // Reload data after success
  redirect?: string;        // Redirect after success
  close?: boolean;          // Close dialog after success
  retry?: {
    maxAttempts?: number;
    delay?: number;
    retryOn?: number[];     // HTTP status codes to retry
  };
  cache?: {
    key?: string;
    duration?: number;
    staleWhileRevalidate?: boolean;
  };
}
```

## Form Submission

### Basic Form Submission

```json
{
  "type": "form",
  "fields": [...],
  "onSubmit": {
    "type": "api",
    "api": {
      "request": {
        "url": "/api/contact",
        "method": "POST"
      },
      "successMessage": "Message sent!",
      "showLoading": true
    }
  }
}
```

### Form with Validation

```json
{
  "type": "form",
  "fields": [
    {
      "name": "email",
      "type": "input",
      "inputType": "email",
      "required": true,
      "validation": {
        "pattern": {
          "value": "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
          "message": "Invalid email format"
        }
      }
    }
  ],
  "onSubmit": {
    "type": "api",
    "api": {
      "request": {
        "url": "/api/register",
        "method": "POST"
      },
      "successMessage": "Registration successful!",
      "redirect": "/login"
    }
  }
}
```

## Variable Substitution

Use `${}` syntax to reference variables in URLs, data, and messages:

### Available Variables

- `${data}` - Component data
- `${form}` - Form values
- `${state}` - Global application state
- `${user}` - Current user information
- `${env}` - Environment variables
- `${utils}` - Utility functions

### Examples

```json
{
  "url": "/api/users/${user.id}",
  "data": {
    "name": "${form.name}",
    "email": "${form.email}",
    "createdBy": "${user.id}"
  },
  "successMessage": "Welcome, ${form.name}!"
}
```

## Response Transformation

Transform API responses using JavaScript expressions:

```json
{
  "dataSource": {
    "api": "/api/github/repos/objectstack-ai/objectui",
    "transform": "data => ({ stars: data.stargazers_count, forks: data.forks_count })"
  }
}
```

Multiple transformations:

```json
{
  "dataSource": {
    "api": "/api/users",
    "transform": "data => data.users",
    "filter": "user => user.active && user.role === 'admin'",
    "sort": {
      "field": "createdAt",
      "order": "desc"
    }
  }
}
```

## Error Handling

### Basic Error Handling

```json
{
  "onClick": {
    "type": "api",
    "api": {
      "request": {
        "url": "/api/action",
        "method": "POST"
      },
      "successMessage": "Success!",
      "errorMessage": "Operation failed. Please try again."
    }
  }
}
```

### Custom Error Handler

```json
{
  "onClick": {
    "type": "api",
    "api": {
      "request": {
        "url": "/api/action",
        "method": "POST"
      },
      "onError": "error => { console.error(error); showNotification(error.message); }"
    }
  }
}
```

### Retry Configuration

```json
{
  "api": {
    "request": {
      "url": "/api/action",
      "method": "POST"
    },
    "retry": {
      "maxAttempts": 3,
      "delay": 1000,
      "retryOn": [500, 502, 503, 504]
    }
  }
}
```

## Caching

Cache API responses to improve performance:

```json
{
  "dataSource": {
    "api": "/api/users",
    "cache": {
      "key": "users-list",
      "duration": 300000,
      "staleWhileRevalidate": true
    }
  }
}
```

### Cache Options

- `key` - Unique cache key
- `duration` - Cache duration in milliseconds
- `staleWhileRevalidate` - Return stale data while fetching fresh data

## Polling

Automatically refetch data at regular intervals:

```json
{
  "dataSource": {
    "api": "/api/dashboard/stats",
    "pollInterval": 30000,
    "fetchOnMount": true
  }
}
```

## Authentication

### Bearer Token

```json
{
  "api": {
    "url": "/api/protected",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer ${env.API_TOKEN}"
    }
  }
}
```

### Cookies

```json
{
  "api": {
    "url": "/api/protected",
    "method": "GET",
    "withCredentials": true
  }
}
```

### Custom Headers

```json
{
  "api": {
    "url": "/api/protected",
    "method": "GET",
    "headers": {
      "X-API-Key": "${env.API_KEY}",
      "X-User-Id": "${user.id}"
    }
  }
}
```

## Best Practices

1. **Use Environment Variables** - Store API keys and tokens in environment variables
2. **Handle Errors Gracefully** - Always provide error messages
3. **Show Loading States** - Use `showLoading: true` for better UX
4. **Cache When Appropriate** - Cache static or slow-changing data
5. **Use Transformations** - Transform data at the source, not in templates
6. **Validate Input** - Use form validation before submitting
7. **Provide Feedback** - Show success/error messages to users
8. **Use Retry Logic** - Retry transient failures automatically
9. **Optimize Polling** - Use reasonable polling intervals
10. **Secure APIs** - Always use HTTPS and authentication

## Related Documentation

- [Protocol Specifications](../protocol/overview.md)
- [Data Sources](./objectql.md)
- [Component Library](../api/components.md)
