#!/usr/bin/env node
/**
 * Documentation Link Validator
 * 
 * This script validates all internal links in the documentation to ensure
 * they point to existing files and routes.
 * 
 * Usage:
 *   node scripts/validate-docs-links.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const ERRORS = [];
const WARNINGS = [];

// Valid documentation routes based on fumadocs structure
const VALID_ROUTES = new Set();

/**
 * Recursively scan directory to build valid routes
 */
function scanDirectory(dir, baseRoute = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(DOCS_DIR, fullPath);
    
    if (entry.isDirectory()) {
      // Skip hidden directories and special folders
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }
      
      const route = baseRoute + '/' + entry.name;
      VALID_ROUTES.add(route);
      scanDirectory(fullPath, route);
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      // Remove extension and add route
      const fileName = entry.name.replace(/\.(md|mdx)$/, '');
      
      if (fileName === 'index') {
        // index.md/mdx maps to the directory route
        VALID_ROUTES.add(baseRoute || '/');
      } else {
        const route = baseRoute + '/' + fileName;
        VALID_ROUTES.add(route);
      }
    }
  }
}

/**
 * Extract markdown links from content
 */
function extractLinks(content, filePath) {
  const links = [];
  
  // Match markdown inline links: [text](url)
  const inlineLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = inlineLinkRegex.exec(content)) !== null) {
    const text = match[1];
    const url = match[2];
    const line = content.substring(0, match.index).split('\n').length;
    
    links.push({ text, url, line, filePath });
  }
  
  // Note: Reference-style links ([text][ref]) are not commonly used in this codebase
  // and are typically resolved at build time by the documentation framework.
  // If needed in the future, add support here.
  
  return links;
}

/**
 * Check if a link is valid
 */
function validateLink(link) {
  const { url, text, line, filePath } = link;
  
  // Skip external links
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
    return;
  }
  
  // Skip anchors without path
  if (url.startsWith('#')) {
    return;
  }
  
  // Skip relative file references
  if (url.startsWith('./') || url.startsWith('../')) {
    // Could validate these too, but they're typically safe
    return;
  }
  
  // Extract the path (remove anchors and query strings)
  let linkPath = url.split('#')[0].split('?')[0];
  
  // Check for /docs/ prefix (this is an error in fumadocs)
  if (linkPath.startsWith('/docs/')) {
    ERRORS.push({
      file: filePath,
      line,
      link: url,
      text,
      error: 'Link contains /docs/ prefix. In fumadocs, baseUrl is already /docs, so links should not include it.',
      suggestion: url.replace('/docs/', '/')
    });
    return;
  }
  
  // Normalize path
  if (!linkPath.startsWith('/')) {
    linkPath = '/' + linkPath;
  }
  
  // Remove trailing slash for comparison
  const normalizedPath = linkPath.replace(/\/$/, '');
  
  // Check if route exists
  if (!VALID_ROUTES.has(normalizedPath) && normalizedPath !== '' && normalizedPath !== '/') {
    ERRORS.push({
      file: filePath,
      line,
      link: url,
      text,
      error: `Link points to non-existent route: ${normalizedPath}`,
      suggestion: findSimilarRoute(normalizedPath)
    });
  }
}

/**
 * Find similar routes to suggest corrections
 */
function findSimilarRoute(route) {
  const parts = route.split('/').filter(Boolean);
  
  // Try to find routes with similar structure
  for (const validRoute of VALID_ROUTES) {
    const validParts = validRoute.split('/').filter(Boolean);
    
    // Check if last part matches
    if (parts.length > 0 && validParts.length > 0) {
      const lastPart = parts[parts.length - 1];
      const validLastPart = validParts[validParts.length - 1];
      
      if (lastPart === validLastPart) {
        return `Did you mean: ${validRoute}?`;
      }
    }
  }
  
  // Check for common patterns
  if (route.startsWith('/api/')) {
    return 'API docs are under /reference/api/';
  }
  if (route.startsWith('/spec/')) {
    return 'Spec docs are under /architecture/';
  }
  if (route.startsWith('/protocol/')) {
    return 'Protocol docs are under /reference/protocol/';
  }
  
  return null;
}

/**
 * Validate all documentation files
 */
function validateDocumentation() {
  console.log('🔍 Scanning documentation files...\n');
  
  // Build valid routes
  scanDirectory(DOCS_DIR);
  console.log(`✅ Found ${VALID_ROUTES.size} valid routes\n`);
  
  // Scan all markdown files
  const files = [];
  
  function scanFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanFiles(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        files.push(fullPath);
      }
    }
  }
  
  scanFiles(DOCS_DIR);
  console.log(`📄 Checking ${files.length} documentation files...\n`);
  
  // Validate links in each file
  let totalLinks = 0;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(DOCS_DIR, file);
    const links = extractLinks(content, relativePath);
    
    totalLinks += links.length;
    
    for (const link of links) {
      validateLink(link);
    }
  }
  
  console.log(`🔗 Validated ${totalLinks} links\n`);
  
  // Report results
  if (ERRORS.length === 0 && WARNINGS.length === 0) {
    console.log('✅ All links are valid!\n');
    return 0;
  }
  
  if (ERRORS.length > 0) {
    console.log(`❌ Found ${ERRORS.length} broken link(s):\n`);
    
    for (const error of ERRORS) {
      console.log(`  📄 ${error.file}:${error.line}`);
      console.log(`     Link: ${error.link}`);
      console.log(`     Text: "${error.text}"`);
      console.log(`     Error: ${error.error}`);
      if (error.suggestion) {
        console.log(`     💡 ${error.suggestion}`);
      }
      console.log('');
    }
  }
  
  if (WARNINGS.length > 0) {
    console.log(`⚠️  Found ${WARNINGS.length} warning(s):\n`);
    
    for (const warning of WARNINGS) {
      console.log(`  📄 ${warning.file}:${warning.line}`);
      console.log(`     Link: ${warning.link}`);
      console.log(`     Warning: ${warning.message}`);
      console.log('');
    }
  }
  
  return ERRORS.length > 0 ? 1 : 0;
}

// Run validation
const exitCode = validateDocumentation();
process.exit(exitCode);
