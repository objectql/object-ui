# Quick Start for Developers

> 🚀 Get up and running with ObjectUI development in 5 minutes!

---

## Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **pnpm** 9+ (`npm install -g pnpm`)
- **Git** ([Download](https://git-scm.com/))

---

## Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

⏱️ **Time**: ~5 minutes (depending on your internet speed)

### 2. Run Examples

```bash
# Run the Showcase (60+ component examples)
pnpm showcase
# Opens at http://localhost:3000

# Or run the Dashboard example
pnpm dev
# Opens at http://localhost:3000

# Or run the CRM example
pnpm dev:crm
# Opens at http://localhost:3001
```

---

## Development Workflow

### Working on a Package

```bash
# Navigate to the package
cd packages/components

# Run tests in watch mode
pnpm test:watch

# Build the package
pnpm build

# Lint the package
pnpm lint
```

### Creating a New Component

1. **Define the schema** in `packages/types/src/schemas/`
2. **Implement the component** in `packages/components/src/`
3. **Add tests** in `packages/components/src/__tests__/`
4. **Document it** in `docs/components/`
5. **Add to showcase** in `examples/showcase/`

### Making Changes

```bash
# 1. Create a feature branch
git checkout -b feature/my-feature

# 2. Make your changes
# ... edit files ...

# 3. Run tests
pnpm test

# 4. Create a changeset (for package changes)
pnpm changeset

# 5. Commit your changes
git add .
git commit -m "feat: add my feature"

# 6. Push and create PR
git push origin feature/my-feature
```

---

## Common Tasks

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

### Building Packages

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/core && pnpm build
```

### Running Documentation

```bash
# Start documentation site
pnpm docs:dev
# Opens at http://localhost:5173

# Build documentation
pnpm docs:build

# Preview built documentation
pnpm docs:preview
```

### Linting and Formatting

```bash
# Lint all packages
pnpm lint

# Lint specific package
cd packages/react && pnpm lint
```

---

## Project Structure

```
objectui/
├── packages/              # Core packages
│   ├── types/            # TypeScript definitions
│   ├── core/             # Core logic (no React)
│   ├── react/            # React bindings
│   ├── components/       # UI components
│   ├── cli/              # CLI tool
│   ├── designer/         # Visual designer
│   └── plugin-*/         # Plugins
├── examples/             # Example applications
│   ├── showcase/         # Component showcase
│   ├── dashboard/        # Dashboard example
│   └── crm-app/          # CRM example
├── docs/                 # Documentation
└── scripts/              # Build scripts
```

---

## Key Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm dev` | Run dashboard example |
| `pnpm showcase` | Run component showcase |
| `pnpm docs:dev` | Start documentation site |
| `pnpm lint` | Lint all packages |
| `pnpm changeset` | Create a changeset |

---

## Getting Help

### Documentation
- [Architecture](./spec/architecture.md) - System design overview
- [Contributing Guide](../CONTRIBUTING.md) - Detailed contribution guide
- [Development Plan](./DEVELOPMENT_PLAN.md) - Roadmap and priorities

### Communication
- **GitHub Issues** - Bug reports and features
- **GitHub Discussions** - Questions and ideas
- **Email** - hello@objectui.org

---

## Next Steps

1. ✅ **Explore the Showcase** - See what's possible
2. ✅ **Read the Architecture** - Understand the design
3. ✅ **Pick a Task** - Check [Development Plan](./DEVELOPMENT_PLAN.md)
4. ✅ **Make Your First PR** - Start contributing!

---

<div align="center">

**Happy Coding!** 🎉

Need help? Open an issue or join our discussions!

</div>
