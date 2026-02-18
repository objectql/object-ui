# Migration Guide: `@object-ui/cli` → `@objectstack/plugin-ui`

> **Date:** February 2026  
> **Affects:** All users of the `objectui` CLI command

## Overview

The ObjectUI CLI has been refactored from a standalone Commander.js-based CLI (`@object-ui/cli`) to an **oclif plugin** (`@objectstack/plugin-ui`). This enables integration with the unified ObjectStack CLI (`os`) ecosystem while maintaining full backward compatibility.

## What Changed

| Before | After |
|--------|-------|
| Package: `@object-ui/cli` | Package: `@objectstack/plugin-ui` |
| Standalone bin: `objectui` | oclif plugin: auto-registered under `os ui` |
| Commander.js-based | oclif Command classes |
| `objectui dev` | `os ui dev` (preferred) or `objectui dev` (still works) |

## Command Mapping

All 15 commands are available under the `os ui` namespace:

| Legacy Command | New Command | Status |
|---------------|-------------|--------|
| `objectui init` | `os ui init` | ✅ |
| `objectui dev` | `os ui dev` | ✅ |
| `objectui build` | `os ui build` | ✅ |
| `objectui start` | `os ui start` | ✅ |
| `objectui serve` | `os ui serve` | ✅ |
| `objectui lint` | `os ui lint` | ✅ |
| `objectui test` | `os ui test` | ✅ |
| `objectui generate <type> <name>` | `os ui generate <type> <name>` | ✅ |
| `objectui doctor` | `os ui doctor` | ✅ |
| `objectui add <component>` | `os ui add <component>` | ✅ |
| `objectui studio` | `os ui studio` | ✅ |
| `objectui check` | `os ui check` | ✅ |
| `objectui validate [schema]` | `os ui validate [schema]` | ✅ |
| `objectui create plugin <name>` | `os ui create-plugin <name>` | ✅ |
| `objectui analyze` | `os ui analyze` | ✅ |

## Installation

### With the unified ObjectStack CLI (recommended)

```bash
# Install the main CLI + UI plugin
npm install -g @objectstack/cli @objectstack/plugin-ui

# All UI commands are now available under `os ui`
os ui dev
os ui build
os ui --help
```

### Standalone (backward compatible)

```bash
# The objectui bin entry is preserved for backward compatibility
npm install -g @objectstack/plugin-ui

# Legacy commands still work
objectui dev
objectui build
```

## Flag Changes

Most flags are identical. The only notable differences:

| Command | Old Flag | New Flag | Notes |
|---------|----------|----------|-------|
| `dev` | `-h, --host` | `-H, --host` | Short flag changed to avoid conflict with oclif's built-in `-h` (help) |
| `serve` | `-h, --host` | `-H, --host` | Same as above |
| `start` | `-h, --host` | `-H, --host` | Same as above |

## Programmatic API

The programmatic exports remain unchanged:

```typescript
import { serve, init } from '@objectstack/plugin-ui';

// These functions work exactly as before
await serve('app.json', { port: '3000', host: 'localhost' });
await init('my-app', { template: 'dashboard' });
```

## Plugin Architecture

The package now follows oclif plugin conventions:

```
packages/cli/
├── src/
│   ├── cli.ts                    # Legacy Commander.js entry (backward compat)
│   ├── index.ts                  # Programmatic exports
│   ├── commands/
│   │   ├── serve.ts              # Original command logic (unchanged)
│   │   ├── dev.ts                # Original command logic (unchanged)
│   │   ├── ...                   # All 15 original command implementations
│   │   └── ui/                   # oclif Command classes
│   │       ├── init.ts           # → wraps commands/init.ts
│   │       ├── dev.ts            # → wraps commands/dev.ts
│   │       ├── build.ts          # → wraps commands/build.ts
│   │       └── ...               # All 15 oclif wrappers
│   └── utils/
│       └── app-generator.ts      # Shared utility (unchanged)
└── package.json                  # oclif plugin config
```

The `package.json` includes the oclif plugin declaration:

```json
{
  "oclif": {
    "commands": "./dist/commands",
    "hooks": {}
  }
}
```

## Deprecation Timeline

| Phase | Timeline | Details |
|-------|----------|---------|
| **Current** | Now | Both `objectui` and `os ui` work |
| **Phase 1** | v4.0 | `objectui` shows deprecation warning |
| **Phase 2** | v5.0 | `objectui` bin removed; `os ui` is the only entry |
