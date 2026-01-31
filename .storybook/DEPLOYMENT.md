# Storybook Deployment Guide

This guide explains how to deploy ObjectUI Storybook to GitHub Pages.

## 🚀 Automatic Deployment

Storybook is automatically deployed to GitHub Pages on every push to `main` or `develop` branches.

### View Deployed Storybook

Once deployed, access your Storybook at:
```
https://objectstack-ai.github.io/objectui/
```

### Deployment Workflow

The deployment happens via GitHub Actions:
- **Workflow:** `.github/workflows/storybook-deploy.yml`
- **Trigger:** Push to `main` or `develop`, or manual workflow dispatch
- **Build Time:** ~5-10 minutes
- **Output:** `storybook-static` directory

## 🔧 Manual Deployment

### Prerequisites

```bash
# Install dependencies
pnpm install

# Build required packages
pnpm build --filter=@object-ui/types --filter=@object-ui/core --filter=@object-ui/react --filter=@object-ui/components --filter=@object-ui/fields --filter=@object-ui/layout
```

### Build Storybook

```bash
# Build Storybook for production
pnpm storybook:build
```

This creates a `storybook-static` directory with the static site.

### Test Build Locally

```bash
# Serve the static build
npx http-server storybook-static -p 6006
```

Open http://localhost:6006 to test the production build.

### Deploy to GitHub Pages

```bash
# Option 1: Using GitHub CLI
gh workflow run storybook-deploy.yml

# Option 2: Using git push (automatic)
git push origin main
```

## 📋 Setup GitHub Pages

### Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. Save the changes

### Configure Base Path (if needed)

If deploying to a subpath (e.g., `/objectui/`):

```typescript
// .storybook/main.ts
const config: StorybookConfig = {
  // ... other config
  viteFinal(config) {
    return mergeConfig(config, {
      base: process.env.NODE_ENV === 'production' ? '/objectui/' : '/',
    });
  },
};
```

## 🔍 Deployment Status

### Check Deployment

1. Go to **Actions** tab in GitHub
2. Click on the latest **Deploy Storybook** workflow run
3. View logs and status

### Deployment Stages

1. **Build** (~3-5 min)
   - Install dependencies
   - Build core packages
   - Build Storybook
   - Upload artifact

2. **Deploy** (~1-2 min)
   - Deploy to GitHub Pages
   - Update DNS

### Troubleshooting

**Problem:** Build fails with TypeScript errors

**Solution:**
```bash
# Run type check locally
pnpm type-check

# Fix any TypeScript errors before pushing
```

**Problem:** Storybook shows 404 errors

**Solution:**
- Check base path configuration
- Verify static files are in `storybook-static`
- Check GitHub Pages settings

**Problem:** MSW doesn't work in production

**Solution:**
```bash
# Ensure MSW service worker is initialized
pnpm dlx msw init public/ --save

# Verify mockServiceWorker.js is in public/
ls -la public/mockServiceWorker.js
```

## 🎯 Custom Domain

### Setup Custom Domain

1. Add CNAME file:
```bash
echo "storybook.objectui.org" > storybook-static/CNAME
```

2. Update DNS:
```
CNAME storybook objectstack-ai.github.io
```

3. Enable HTTPS in GitHub Pages settings

### Update Workflow

```yaml
# .github/workflows/storybook-deploy.yml
- name: Build Storybook
  run: |
    pnpm storybook:build
    echo "storybook.objectui.org" > storybook-static/CNAME
```

## 📊 Monitoring

### View Analytics

GitHub Pages provides basic traffic analytics:
1. Go to **Insights** → **Traffic**
2. View page views and referrers

### Performance Monitoring

Add analytics to `.storybook/manager-head.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR_GA_ID');
</script>
```

## 🔒 Security

### Environment Variables

For sensitive data, use GitHub Secrets:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add secrets (e.g., `STORYBOOK_API_KEY`)
3. Use in workflow:

```yaml
- name: Build Storybook
  env:
    STORYBOOK_API_KEY: ${{ secrets.STORYBOOK_API_KEY }}
  run: pnpm storybook:build
```

### Access Control

GitHub Pages is public by default. For private Storybook:
1. Use GitHub Enterprise
2. Enable repository visibility controls
3. Or deploy to a private hosting service

## 🚀 Advanced Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel storybook-static
```

### Deploy to Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --dir=storybook-static --prod
```

### Deploy to AWS S3

```bash
# Build Storybook
pnpm storybook:build

# Upload to S3
aws s3 sync storybook-static s3://your-bucket --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## 📝 Deployment Checklist

Before deploying:

- [ ] All packages build successfully
- [ ] Storybook builds without errors
- [ ] All stories load correctly
- [ ] MSW handlers work in production build
- [ ] Accessibility tests pass
- [ ] No TypeScript errors
- [ ] No broken links
- [ ] Performance is acceptable (<3s initial load)

## 🔄 CI/CD Integration

### GitHub Actions

The deployment is automated via GitHub Actions:

```yaml
name: Deploy Storybook
on:
  push:
    branches: [main, develop]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - name: Build and Deploy
        run: |
          pnpm install
          pnpm build
          pnpm storybook:build
```

### Branch Previews

Deploy branches to separate URLs:

```yaml
- name: Deploy Preview
  if: github.ref != 'refs/heads/main'
  run: |
    vercel storybook-static --token=${{ secrets.VERCEL_TOKEN }}
```

## 📖 Resources

- [Storybook Deployment Docs](https://storybook.js.org/docs/react/sharing/publish-storybook)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [MSW in Production](https://mswjs.io/docs/recipes/deployment)

## 🆘 Support

If you encounter issues:
1. Check GitHub Actions logs
2. Review [Troubleshooting](#troubleshooting) section
3. Open an issue on GitHub
4. Ask in Discord (coming soon)

---

**Happy Deploying! 🚀**
