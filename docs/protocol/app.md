# Application Metadata

Application metadata defines the high-level container for a specific set of functionality (e.g., "Sales", "HR", "Admin"). It serves effectively as a grouping mechanism for menus and other resources.

## 1. File Naming

**Convention:** `[app_name].app.yml`

**Examples:**
- `sales.app.yml`
- `admin.app.yml`

## 2. Structure

The structure is intentionally kept simple to allow for flexibility in frontend plugins and extensions.

```yaml
name: sales
label: Sales App
description: Manage leads, opportunities, and customers.
icon: currency
logo: /assets/sales-logo.png
homepage: /app/sales
sort_no: 10
is_active: true
```

## 3. Properties

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | **Yes** | Unique identifier for the application. |
| `label` | string | **Yes** | Human-readable name displayed in the UI launcher. |
| `description` | string | No | Description of the application's purpose. |
| `icon` | string | No | Icon name (e.g., standard icon set name) for the app launcher. |
| `logo` | string | No | URL or path to a custom logo image. |
| `homepage` | string | No | The default path to navigate to when the app is opened. |
| `sort_no` | number | No | Integer for sorting applications in the launcher. |
| `is_active` | boolean | No | Whether the app is visible to users. Defaults to `true`. |

## 4. Relationship with Menus

Menus are defined separately in `*.menu.yml` files and can be linked to an application. This separation allows for:
- Reusing menus across applications.
- Keeping the application definition lightweight.
- Frontend plugins to dynamically inject or modify menus without touching the app definition.

See [Menu Metadata](./menu.md) for details on defining structure and items.
