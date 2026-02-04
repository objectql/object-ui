
import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

// Import all plugins to ensure they register their components
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-map';

describe('View Rendering Verification', () => {

    it('should have object-grid registered', () => {
        expect(ComponentRegistry.get('object-grid')).toBeDefined();
    });

    it('should have object-kanban registered', () => {
        expect(ComponentRegistry.get('object-kanban')).toBeDefined();
    });

    it('should have object-calendar registered', () => {
        expect(ComponentRegistry.get('object-calendar')).toBeDefined();
    });

    it('should have object-gantt registered', () => {
        expect(ComponentRegistry.get('object-gantt')).toBeDefined();
    });

    it('should have object-timeline registered', () => {
        expect(ComponentRegistry.get('object-timeline')).toBeDefined();
    });

    it('should have object-map registered', () => {
        expect(ComponentRegistry.get('object-map')).toBeDefined();
    });

    // The problematic ones
    it('should have object-chart registered', () => {
        // plugin-charts registers 'chart' but ListView asks for 'object-chart'.
        // This test will likely fail if no alias exists.
        const chart = ComponentRegistry.get('object-chart');
        expect(chart).toBeDefined();
    });

    it('should have object-gallery registered', () => {
        // plugin-list asks for 'object-gallery'.
        // This test will likely fail if it's missing.
        const gallery = ComponentRegistry.get('object-gallery');
        expect(gallery).toBeDefined();
    });

    it('should NOT have spreadsheet registered (deprecated)', () => {
        const spreadsheet = ComponentRegistry.get('spreadsheet');
        expect(spreadsheet).toBeUndefined();
        
        const objectSpreadsheet = ComponentRegistry.get('object-spreadsheet');
        expect(objectSpreadsheet).toBeUndefined();
    });
});
