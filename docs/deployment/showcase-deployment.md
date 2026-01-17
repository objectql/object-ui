# Showcase Deployment Guide

This guide shows you how to deploy the Object UI Showcase to various hosting platforms, making it accessible to your users online.

## 🎯 Deployment Options

The Object UI Showcase can be deployed to any static hosting service or Node.js environment. Choose the option that best fits your needs:

| Platform | Best For | Difficulty | Cost |
|----------|----------|------------|------|
| **Vercel** | Quick deployment, automatic builds | ⭐ Easy | Free tier available |
| **Netlify** | Continuous deployment, form handling | ⭐ Easy | Free tier available |
| **GitHub Pages** | Open source projects | ⭐⭐ Moderate | Free |
| **AWS S3 + CloudFront** | Enterprise, high traffic | ⭐⭐⭐ Advanced | Pay as you go |
| **Docker** | Self-hosted, full control | ⭐⭐⭐ Advanced | Infrastructure cost |

## 🚀 Quick Deploy to Vercel (Recommended)

Vercel offers the fastest deployment with zero configuration.

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Build the Showcase

```bash
# From repository root
cd objectui

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build showcase for production
cd examples/showcase
node ../../packages/cli/dist/cli.js build app.json --out-dir dist
```

### Step 3: Deploy

```bash
# Deploy to Vercel
vercel --prod
```

**Configuration file** (`vercel.json`):

```json
{
  "version": 2,
  "name": "objectui-showcase",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "examples/showcase/dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Step 4: Configure Custom Domain (Optional)

```bash
# Add custom domain
vercel domains add showcase.yourdomain.com
```

## 🌊 Deploy to Netlify

Netlify is excellent for continuous deployment from Git.

### Step 1: Create Netlify Configuration

Create `netlify.toml` in repository root:

```toml
[build]
  base = "examples/showcase"
  publish = "dist"
  command = "cd ../../ && pnpm install && pnpm build && cd examples/showcase && node ../../packages/cli/dist/cli.js build app.json"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

### Step 2: Deploy via CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

### Step 3: Deploy via Git Integration

1. **Push to GitHub:**
   ```bash
   git push origin main
   ```

2. **Connect on Netlify:**
   - Go to [https://app.netlify.com](https://app.netlify.com)
   - Click "New site from Git"
   - Select your repository
   - Netlify auto-detects `netlify.toml`
   - Click "Deploy site"

## 🐙 Deploy to GitHub Pages

Perfect for open-source projects with free hosting.

### Step 1: Configure GitHub Actions

Create `.github/workflows/deploy-showcase.yml`:

```yaml
name: Deploy Showcase

on:
  push:
    branches:
      - main
    paths:
      - 'examples/showcase/**'
      - 'packages/**'
      - '.github/workflows/deploy-showcase.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build packages
        run: pnpm build
      
      - name: Build showcase
        run: |
          cd examples/showcase
          node ../../packages/cli/dist/cli.js build app.json --out-dir dist
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./examples/showcase/dist
          cname: showcase.objectui.org  # Optional: your custom domain
```

### Step 2: Enable GitHub Pages

1. Go to repository **Settings** > **Pages**
2. Source: **gh-pages** branch
3. Click **Save**

### Step 3: Push Changes

```bash
git add .github/workflows/deploy-showcase.yml
git commit -m "Add showcase deployment workflow"
git push origin main
```

Your showcase will be available at: `https://yourusername.github.io/objectui/`

## 🐳 Deploy with Docker

For self-hosted or containerized deployments.

### Step 1: Create Dockerfile

Create `examples/showcase/Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY examples/showcase ./examples/showcase

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages
RUN pnpm build

# Build showcase
WORKDIR /app/examples/showcase
RUN node ../../packages/cli/dist/cli.js build app.json --out-dir dist

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/examples/showcase/dist /usr/share/nginx/html

# Copy nginx configuration
COPY examples/showcase/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Step 2: Create Nginx Configuration

Create `examples/showcase/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Step 3: Build and Run

```bash
# Build Docker image
docker build -t objectui-showcase -f examples/showcase/Dockerfile .

# Run container
docker run -d -p 8080:80 --name showcase objectui-showcase

# Access at http://localhost:8080
```

### Step 4: Deploy to Docker Hub

```bash
# Tag image
docker tag objectui-showcase yourusername/objectui-showcase:latest

# Push to Docker Hub
docker push yourusername/objectui-showcase:latest
```

## ☁️ Deploy to AWS S3 + CloudFront

For high-performance, scalable hosting.

### Step 1: Build the Showcase

```bash
pnpm build
cd examples/showcase
node ../../packages/cli/dist/cli.js build app.json --out-dir dist
```

### Step 2: Create S3 Bucket

```bash
# Install AWS CLI
brew install awscli  # macOS

# Configure AWS credentials
aws configure

# Create bucket
aws s3 mb s3://objectui-showcase

# Enable static website hosting
aws s3 website s3://objectui-showcase --index-document index.html --error-document index.html
```

### Step 3: Upload Files

```bash
# Sync files to S3
aws s3 sync dist/ s3://objectui-showcase --delete

# Set cache headers
aws s3 cp s3://objectui-showcase s3://objectui-showcase \
  --recursive \
  --exclude "*" \
  --include "*.js" \
  --include "*.css" \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=31536000, immutable"
```

### Step 4: Create CloudFront Distribution

```bash
# Create distribution (simplified)
aws cloudfront create-distribution \
  --origin-domain-name objectui-showcase.s3.amazonaws.com \
  --default-root-object index.html
```

Or use the AWS Console:
1. Go to CloudFront
2. Create Distribution
3. Origin: Your S3 bucket
4. Default Root Object: `index.html`
5. Error Pages: 404 → /index.html (for SPA routing)

## 🔧 Environment Configuration

### Production Environment Variables

Create `.env.production` for your deployment:

```env
# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_API_KEY=your-api-key

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_CHAT=false

# Branding
VITE_APP_NAME="Your Company Showcase"
VITE_LOGO_URL=/your-logo.png
```

### Build with Environment

```bash
# Load environment variables
export $(cat .env.production | xargs)

# Build with configuration
node packages/cli/dist/cli.js build examples/showcase/app.json \
  --out-dir dist \
  --base-url https://showcase.yourdomain.com
```

## 📊 Monitoring and Analytics

### Add Google Analytics

Edit your deployment to inject analytics:

```html
<!-- Add to index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Performance Monitoring

Use Vercel Analytics or similar:

```json
{
  "analytics": {
    "enabled": true
  }
}
```

## 🔒 Security Best Practices

### Content Security Policy

Add CSP headers to your deployment:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

### HTTPS Enforcement

Always use HTTPS in production. Most platforms (Vercel, Netlify) provide free SSL certificates automatically.

## 🔄 Continuous Deployment

### Automated Deployments

Set up automatic deployments on git push:

**Vercel:**
- Automatically deployed on push to `main`
- Preview deployments for pull requests

**Netlify:**
- Deploy previews for every PR
- Branch deployments for testing

**GitHub Actions:**
- Custom workflows for complex scenarios
- Deploy to multiple environments

## 📱 Custom Domains

### Configure DNS

Point your domain to the deployment:

**Vercel/Netlify:**
```
CNAME    showcase    cname.vercel-dns.com
```

**GitHub Pages:**
```
A        @           185.199.108.153
A        @           185.199.109.153
A        @           185.199.110.153
A        @           185.199.111.153
CNAME    www         yourusername.github.io
```

## 🐛 Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
rm -rf node_modules dist
pnpm install
pnpm build
```

### 404 Errors on Refresh

Ensure SPA routing is configured:
- Vercel: Add rewrites in `vercel.json`
- Netlify: Add redirects in `netlify.toml`
- Nginx: Configure `try_files`

### Slow Load Times

- Enable gzip compression
- Add CDN (CloudFront, Cloudflare)
- Optimize images
- Use lazy loading

## 📞 Support

Need help with deployment?

- 📖 [Documentation](https://objectui.org/docs)
- 💬 [Discord Community](https://discord.gg/objectui)
- 🐛 [GitHub Issues](https://github.com/objectstack-ai/objectui/issues)

---

**Ready to deploy?** Choose your platform and follow the steps above!
