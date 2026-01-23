#!/usr/bin/env node

/**
 * Automated Component Style Testing Script
 * 
 * This script tests all ObjectUI component styles in the fumadocs site
 * by navigating to component pages and checking for proper styling.
 */

const { chromium } = require('playwright');
const path = require('path');

// Component pages to test
const COMPONENT_PAGES = [
  // Form components
  { path: '/docs/components/form/button', name: 'Button', critical: true },
  { path: '/docs/components/form/input', name: 'Input', critical: true },
  { path: '/docs/components/form/date-picker', name: 'Date Picker', critical: true },
  { path: '/docs/components/form/select', name: 'Select', critical: true },
  { path: '/docs/components/form/checkbox', name: 'Checkbox', critical: true },
  { path: '/docs/components/form/switch', name: 'Switch', critical: true },
  { path: '/docs/components/form/slider', name: 'Slider', critical: true },
  
  // Layout components
  { path: '/docs/components/layout/card', name: 'Card', critical: true },
  { path: '/docs/components/layout/tabs', name: 'Tabs', critical: true },
  { path: '/docs/components/layout/grid', name: 'Grid', critical: false },
  
  // Data Display
  { path: '/docs/components/data-display/badge', name: 'Badge', critical: true },
  { path: '/docs/components/data-display/alert', name: 'Alert', critical: true },
  { path: '/docs/components/data-display/avatar', name: 'Avatar', critical: true },
  { path: '/docs/components/data-display/calendar', name: 'Calendar', critical: true },
  
  // Overlay components
  { path: '/docs/components/overlay/dialog', name: 'Dialog', critical: true },
  { path: '/docs/components/overlay/tooltip', name: 'Tooltip', critical: true },
  { path: '/docs/components/overlay/popover', name: 'Popover', critical: true },
];

// CSS properties to check for proper styling
const STYLE_CHECKS = {
  button: [
    { selector: 'button[class*="bg-primary"]', styles: ['background-color', 'color', 'padding'] },
    { selector: 'button[class*="bg-destructive"]', styles: ['background-color', 'color'] },
  ],
  calendar: [
    { selector: '[class*="calendar"]', styles: ['display', 'border'] },
    { selector: 'button[class*="selected"]', styles: ['background-color', 'color'] },
    { selector: '[class*="day"]', styles: ['width', 'height'] },
  ],
  general: [
    { selector: '[class*="border"]', styles: ['border-color', 'border-width'] },
    { selector: '[class*="bg-"]', styles: ['background-color'] },
    { selector: '[class*="text-"]', styles: ['color'] },
  ]
};

class ComponentStyleTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.browser = null;
    this.page = null;
    this.results = [];
  }

  async init() {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async close() {
    await this.browser?.close();
  }

  async waitForComponents(timeout = 10000) {
    // Wait for plugins to load
    await this.page.waitForTimeout(2000);
    
    // Check if components are loaded (not showing "Loading plugins...")
    const loadingText = await this.page.locator('text=Loading plugins...').count();
    if (loadingText > 0) {
      await this.page.waitForTimeout(3000);
    }
  }

  async checkComponentStyles(componentName, checks) {
    const issues = [];
    
    for (const check of checks) {
      const elements = await this.page.locator(check.selector).all();
      
      if (elements.length === 0) {
        issues.push({
          severity: 'warning',
          message: `No elements found for selector: ${check.selector}`
        });
        continue;
      }

      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        const element = elements[i];
        
        for (const styleProp of check.styles) {
          const value = await element.evaluate((el, prop) => {
            return window.getComputedStyle(el).getPropertyValue(prop);
          }, styleProp);

          // Check if style has a meaningful value
          if (!value || value === 'auto' || value === 'none' || value === 'rgba(0, 0, 0, 0)') {
            issues.push({
              severity: 'error',
              message: `Missing or invalid ${styleProp} on ${check.selector}`,
              value: value
            });
          }
        }
      }
    }
    
    return issues;
  }

  async testComponentPage(componentConfig) {
    const url = `${this.baseUrl}${componentConfig.path}`;
    console.log(`\nTesting: ${componentConfig.name} (${url})`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.waitForComponents();
      
      // Take screenshot
      const screenshotPath = path.join('/tmp', `${componentConfig.name.toLowerCase().replace(/\s+/g, '-')}.png`);
      await this.page.screenshot({ 
        path: screenshotPath,
        fullPage: false 
      });
      
      // Check for general styles
      const generalIssues = await this.checkComponentStyles(
        componentConfig.name, 
        STYLE_CHECKS.general
      );
      
      // Check for component-specific styles
      const componentType = componentConfig.name.toLowerCase().replace(/\s+/g, '-');
      const specificChecks = STYLE_CHECKS[componentType] || [];
      const specificIssues = await this.checkComponentStyles(
        componentConfig.name,
        specificChecks
      );
      
      const allIssues = [...generalIssues, ...specificIssues];
      const errorCount = allIssues.filter(i => i.severity === 'error').length;
      const warningCount = allIssues.filter(i => i.severity === 'warning').length;
      
      const result = {
        name: componentConfig.name,
        path: componentConfig.path,
        url: url,
        screenshot: screenshotPath,
        passed: errorCount === 0,
        critical: componentConfig.critical,
        errors: errorCount,
        warnings: warningCount,
        issues: allIssues
      };
      
      this.results.push(result);
      
      if (result.passed) {
        console.log(`✅ PASSED - ${componentConfig.name}`);
      } else {
        console.log(`❌ FAILED - ${componentConfig.name} (${errorCount} errors, ${warningCount} warnings)`);
        if (componentConfig.critical) {
          console.log('   ⚠️  CRITICAL COMPONENT');
        }
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ ERROR - ${componentConfig.name}: ${error.message}`);
      this.results.push({
        name: componentConfig.name,
        path: componentConfig.path,
        url: url,
        passed: false,
        critical: componentConfig.critical,
        errors: 1,
        warnings: 0,
        issues: [{ severity: 'error', message: error.message }]
      });
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Component Style Tests...\n');
    console.log(`Testing ${COMPONENT_PAGES.length} component pages\n`);
    
    for (const component of COMPONENT_PAGES) {
      await this.testComponentPage(component);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const criticalFailed = this.results.filter(r => !r.passed && r.critical).length;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Critical Failures: ${criticalFailed} ⚠️\n`);
    
    if (failed > 0) {
      console.log('Failed Components:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`\n  ${r.critical ? '⚠️ ' : ''}${r.name}:`);
          console.log(`    Path: ${r.path}`);
          console.log(`    Errors: ${r.errors}, Warnings: ${r.warnings}`);
          console.log(`    Screenshot: ${r.screenshot}`);
          
          // Show first 3 issues
          r.issues.slice(0, 3).forEach(issue => {
            console.log(`    - [${issue.severity.toUpperCase()}] ${issue.message}`);
          });
          
          if (r.issues.length > 3) {
            console.log(`    ... and ${r.issues.length - 3} more issues`);
          }
        });
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Exit with error code if critical tests failed
    if (criticalFailed > 0) {
      console.log('\n❌ Critical components failed! Please fix before deploying.');
      return 1;
    } else if (failed > 0) {
      console.log('\n⚠️  Some tests failed, but no critical components affected.');
      return 0;
    } else {
      console.log('\n✅ All component style tests passed!');
      return 0;
    }
  }
}

async function main() {
  const tester = new ComponentStyleTester();
  
  try {
    await tester.init();
    await tester.runAllTests();
    const exitCode = tester.printSummary();
    await tester.close();
    process.exit(exitCode);
  } catch (error) {
    console.error('Fatal error:', error);
    await tester.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ComponentStyleTester };
