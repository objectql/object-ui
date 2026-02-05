
import { describe, it, expect } from 'vitest';
import appConfig from '../../objectstack.config';

/**
 * Spec Compliance Tests
 * 
 * These tests verify that the console properly implements the ObjectStack Spec v0.9.0
 * See: apps/console/SPEC_ALIGNMENT.md for full compliance details
 */

describe('ObjectStack Spec v0.9.0 Compliance', () => {

    describe('AppSchema Validation', () => {
        it('should have at least one app defined', () => {
            expect(appConfig.apps).toBeDefined();
            expect(Array.isArray(appConfig.apps)).toBe(true);
            expect(appConfig.apps!.length).toBeGreaterThan(0);
        });

        it('should have valid app structure', () => {
            const app = appConfig.apps![0];
            
            // Required fields per spec
            expect(app.name).toBeDefined();
            expect(typeof app.name).toBe('string');
            expect(app.label).toBeDefined();
            expect(typeof app.label).toBe('string');
            
            // Name convention: lowercase snake_case
            expect(app.name).toMatch(/^[a-z][a-z0-9_]*$/);
        });

        it('should support optional app metadata', () => {
            const app = appConfig.apps![0];
            
            // Optional fields that should be defined if present
            if (app.description) {
                expect(typeof app.description).toBe('string');
            }
            if (app.version) {
                expect(typeof app.version).toBe('string');
            }
            if (app.icon) {
                expect(typeof app.icon).toBe('string');
            }
        });

        it('should support app branding configuration', () => {
            const appsWithBranding = appConfig.apps!.filter((a: any) => a.branding);
            
            if (appsWithBranding.length > 0) {
                const app = appsWithBranding[0];
                
                if (app.branding.primaryColor) {
                    // Should be a valid CSS color
                    expect(app.branding.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
                }
                
                if (app.branding.logo) {
                    expect(typeof app.branding.logo).toBe('string');
                }
                
                if (app.branding.favicon) {
                    expect(typeof app.branding.favicon).toBe('string');
                }
            }
        });

        it('should support homePageId for custom landing pages', () => {
            // homePageId is optional but should be a string if defined
            appConfig.apps!.forEach((app: any) => {
                if (app.homePageId) {
                    expect(typeof app.homePageId).toBe('string');
                    expect(app.homePageId.length).toBeGreaterThan(0);
                }
            });
        });

        it('should support permission requirements', () => {
            // requiredPermissions is optional but should be an array if defined
            appConfig.apps!.forEach((app: any) => {
                if (app.requiredPermissions) {
                    expect(Array.isArray(app.requiredPermissions)).toBe(true);
                    app.requiredPermissions.forEach((perm: any) => {
                        expect(typeof perm).toBe('string');
                    });
                }
            });
        });
    });

    describe('NavigationItem Validation', () => {
        it('should have navigation items defined', () => {
            const app = appConfig.apps![0];
            expect(app.navigation).toBeDefined();
            expect(Array.isArray(app.navigation)).toBe(true);
        });

        it('should support object navigation items', () => {
            const objectNavItems = getAllNavItems(appConfig.apps![0].navigation)
                .filter((item: any) => item.type === 'object');
            
            if (objectNavItems.length > 0) {
                const item = objectNavItems[0];
                expect(item.id).toBeDefined();
                expect(item.label).toBeDefined();
                expect(item.objectName).toBeDefined();
                expect(typeof item.objectName).toBe('string');
            }
        });

        it('should support group navigation items', () => {
            const groupNavItems = getAllNavItems(appConfig.apps![0].navigation)
                .filter((item: any) => item.type === 'group');
            
            if (groupNavItems.length > 0) {
                const item = groupNavItems[0];
                expect(item.id).toBeDefined();
                expect(item.label).toBeDefined();
                expect(item.children).toBeDefined();
                expect(Array.isArray(item.children)).toBe(true);
            }
        });

        it('should have valid navigation item structure', () => {
            const allNavItems = getAllNavItems(appConfig.apps![0].navigation);
            
            allNavItems.forEach((item: any) => {
                // All items must have id, label, and type
                expect(item.id).toBeDefined();
                expect(item.label).toBeDefined();
                expect(item.type).toBeDefined();
                
                // Type must be one of the valid types
                expect(['object', 'dashboard', 'page', 'url', 'group']).toContain(item.type);
                
                // Type-specific validation
                if (item.type === 'object') {
                    expect(item.objectName).toBeDefined();
                }
                if (item.type === 'dashboard') {
                    expect(item.dashboardName).toBeDefined();
                }
                if (item.type === 'page') {
                    expect(item.pageName).toBeDefined();
                }
                if (item.type === 'url') {
                    expect(item.url).toBeDefined();
                }
                if (item.type === 'group') {
                    expect(item.children).toBeDefined();
                    expect(Array.isArray(item.children)).toBe(true);
                }
            });
        });

        it('should support navigation item visibility', () => {
            const allNavItems = getAllNavItems(appConfig.apps![0].navigation);
            
            // visible field is optional but should be string or boolean if present
            allNavItems.forEach((item: any) => {
                if (item.visible !== undefined) {
                    const validTypes = ['string', 'boolean'];
                    expect(validTypes).toContain(typeof item.visible);
                }
            });
        });
    });

    describe('ObjectSchema Validation', () => {
        it('should have objects defined', () => {
            expect(appConfig.objects).toBeDefined();
            expect(Array.isArray(appConfig.objects)).toBe(true);
            expect(appConfig.objects!.length).toBeGreaterThan(0);
        });

        it('should have valid object structure', () => {
            const object = appConfig.objects![0];
            
            // Required fields
            expect(object.name).toBeDefined();
            expect(typeof object.name).toBe('string');
            expect(object.label).toBeDefined();
            expect(typeof object.label).toBe('string');
            expect(object.fields).toBeDefined();
        });

        it('should have valid field definitions', () => {
            const object = appConfig.objects![0];
            const fields = Array.isArray(object.fields) 
                ? object.fields 
                : Object.values(object.fields);
            
            expect(fields.length).toBeGreaterThan(0);
            
            fields.forEach((field: any) => {
                // Each field should have a type
                expect(field.type).toBeDefined();
            });
        });

        it('should reference only defined objects in navigation', () => {
            const objectNames = new Set(appConfig.objects!.map((o: any) => o.name));
            const navItems = getAllNavItems(appConfig.apps![0].navigation);
            const objectNavItems = navItems.filter((item: any) => item.type === 'object');
            
            objectNavItems.forEach((item: any) => {
                expect(objectNames.has(item.objectName)).toBe(true);
            });
        });
    });

    describe('Manifest Validation', () => {
        it('should have manifest defined', () => {
            expect(appConfig.manifest).toBeDefined();
        });

        it('should have valid data seeds', () => {
            if (appConfig.manifest?.data) {
                expect(Array.isArray(appConfig.manifest.data)).toBe(true);
                
                appConfig.manifest.data.forEach((seed: any) => {
                    expect(seed.object).toBeDefined();
                    expect(typeof seed.object).toBe('string');
                    expect(seed.mode).toBeDefined();
                    expect(['upsert', 'insert']).toContain(seed.mode);
                    expect(seed.records).toBeDefined();
                    expect(Array.isArray(seed.records)).toBe(true);
                });
            }
        });

        it('should reference only defined objects in manifest', () => {
            if (appConfig.manifest?.data) {
                const objectNames = new Set(appConfig.objects!.map((o: any) => o.name));
                
                appConfig.manifest.data.forEach((seed: any) => {
                    expect(objectNames.has(seed.object)).toBe(true);
                });
            }
        });
    });

    describe('Plugin Configuration', () => {
        it('should have plugins defined', () => {
            expect(appConfig.plugins).toBeDefined();
            expect(Array.isArray(appConfig.plugins)).toBe(true);
        });

        it('should have datasource configuration', () => {
            expect(appConfig.datasources).toBeDefined();
            expect(appConfig.datasources!.default).toBeDefined();
            expect(appConfig.datasources!.default.driver).toBeDefined();
        });
    });
});

/**
 * Helper function to recursively get all navigation items including nested ones
 */
function getAllNavItems(navItems: any[]): any[] {
    if (!navItems) return [];
    
    const result: any[] = [];
    
    for (const item of navItems) {
        result.push(item);
        
        if (item.type === 'group' && item.children) {
            result.push(...getAllNavItems(item.children));
        }
    }
    
    return result;
}
