# Component Style Testing

This directory contains automated testing scripts for verifying that ObjectUI components render with proper styles in the fumadocs documentation site.

## Scripts

### 1. `test-component-styles.js` (Node.js)

A comprehensive automated test that:
- Launches a headless browser
- Navigates to all component documentation pages
- Checks for proper CSS styling on components
- Takes screenshots for visual verification
- Reports errors and warnings

**Usage:**
```bash
# Requires dev server to be running on http://localhost:3000
node scripts/test-component-styles.js
```

**Features:**
- ✅ Tests 15+ critical components
- ✅ Validates background colors, borders, padding, etc.
- ✅ Captures screenshots for manual review
- ✅ Detects missing or invalid styles
- ✅ Distinguishes between critical and non-critical failures

### 2. `test-component-styles.sh` (Bash)

A wrapper script that:
- Automatically starts the dev/production server
- Runs the Node.js test script
- Cleans up the server after testing

**Usage:**
```bash
# Test with dev server (default)
./scripts/test-component-styles.sh dev

# Test with production build
./scripts/test-component-styles.sh build
```

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run the tests:**
   ```bash
   # Option 1: Manual (requires server running)
   cd apps/site && pnpm dev &
   node scripts/test-component-styles.js

   # Option 2: Automatic
   ./scripts/test-component-styles.sh
   ```

3. **Check results:**
   - Console output shows pass/fail for each component
   - Screenshots saved to `/tmp/*.png`
   - Exit code 0 = all tests passed, 1 = critical failures

## Adding New Components

To test a new component, edit `test-component-styles.js`:

```javascript
const COMPONENT_PAGES = [
  // Add your component
  { 
    path: '/docs/components/category/your-component', 
    name: 'Your Component', 
    critical: true // Set to true if it's a critical component
  },
  // ...
];
```

## Common Issues

### Calendar/Date Picker Styling

If calendar components show styling issues:

1. **Check CSS custom properties**: Ensure `global.css` includes all design tokens
2. **Check Tailwind config**: Verify `tailwind.config.ts` maps CSS variables correctly
3. **Check content paths**: Ensure Tailwind scans all component source files
4. **Check for dynamic classes**: Some components use runtime-generated class names

### Fixing Style Issues

1. **Missing colors**: Add CSS custom property to `apps/site/app/global.css`
2. **Missing mapping**: Add color mapping to `apps/site/tailwind.config.ts`
3. **Classes not found**: Add path to `content` array in Tailwind config
4. **Component-specific**: Check component UI source in `packages/components/src/ui/`

## CI Integration

Add to your CI pipeline:

```yaml
- name: Test Component Styles
  run: |
    pnpm build
    pnpm start &
    sleep 10
    node scripts/test-component-styles.js
```

## Output Format

```
🚀 Starting Component Style Tests...

Testing: Button (/docs/components/form/button)
✅ PASSED - Button

Testing: Calendar (/docs/components/data-display/calendar)
❌ FAILED - Calendar (3 errors, 1 warnings)
   ⚠️  CRITICAL COMPONENT

📊 TEST SUMMARY
================================================================================

Total Tests: 15
Passed: 14 ✅
Failed: 1 ❌
Critical Failures: 1 ⚠️

Failed Components:

  ⚠️ Calendar:
    Path: /docs/components/data-display/calendar
    Errors: 3, Warnings: 1
    Screenshot: /tmp/calendar.png
    - [ERROR] Missing or invalid background-color on button[class*="selected"]
    - [ERROR] Missing or invalid color on button[class*="selected"]
    - [ERROR] Missing or invalid border-color on [class*="border"]
```

## Troubleshooting

**Server not starting:**
- Check if port 3000 is available
- Ensure all dependencies are installed (`pnpm install`)
- Try building first (`pnpm build`)

**Tests timing out:**
- Increase timeout in script (default: 30s)
- Check for console errors in browser
- Verify components are actually rendering

**False positives:**
- Some components may have intentionally transparent backgrounds
- Adjust `STYLE_CHECKS` in the script to match expected behavior
- Add component-specific validation rules

## Maintenance

Update the test script when:
- Adding new components to the documentation
- Changing component styling approach
- Modifying Tailwind configuration
- Updating design tokens

Last updated: 2026-01-23
