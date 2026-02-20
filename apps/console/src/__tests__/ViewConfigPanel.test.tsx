/**
 * ViewConfigPanel Tests
 *
 * Tests for the Airtable-style inline view configuration panel.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ViewConfigPanel } from '../components/ViewConfigPanel';

// Mock i18n — return keys as-is for test assertions
vi.mock('@object-ui/i18n', () => ({
    useObjectTranslation: () => ({
        t: (key: string, params?: Record<string, any>) => {
            if (params?.count !== undefined) return key.replace('{{count}}', String(params.count));
            return key;
        },
    }),
}));

// Mock components to simple HTML elements
vi.mock('@object-ui/components', () => ({
    Button: ({ children, onClick, title, ...props }: any) => (
        <button onClick={onClick} title={title} {...props}>{children}</button>
    ),
}));

const mockActiveView = {
    id: 'all',
    label: 'All Records',
    type: 'grid',
    columns: ['name', 'stage', 'amount'],
    filter: [{ field: 'stage', operator: '=', value: 'active' }],
    sort: [{ field: 'name', order: 'asc' }],
};

const mockObjectDef = {
    name: 'opportunity',
    label: 'Opportunity',
    description: 'Track sales pipeline and deals',
    fields: {
        name: { label: 'Name', type: 'text' },
        stage: { label: 'Stage', type: 'select' },
        amount: { label: 'Amount', type: 'currency' },
    },
};

describe('ViewConfigPanel', () => {
    it('renders nothing when closed', () => {
        render(
            <ViewConfigPanel
                open={false}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.queryByTestId('view-config-panel')).not.toBeInTheDocument();
    });

    it('renders panel with all sections when open', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();

        // Check section headers
        expect(screen.getByText('console.objectView.page')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.data')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.appearance')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.userFilters')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.userActions')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.advanced')).toBeInTheDocument();
    });

    it('displays view title', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('All Records')).toBeInTheDocument();
    });

    it('displays object description', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('Track sales pipeline and deals')).toBeInTheDocument();
    });

    it('shows "no description" when object has no description', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={{ ...mockObjectDef, description: undefined }}
            />
        );

        expect(screen.getByText('console.objectView.noDescription')).toBeInTheDocument();
    });

    it('displays column count', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // 3 columns configured
        expect(screen.getByText('console.objectView.columnsConfigured'.replace('{{count}}', '3'))).toBeInTheDocument();
    });

    it('displays object source name', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('Opportunity')).toBeInTheDocument();
    });

    it('displays view type', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('Grid')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={onClose}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const closeBtn = screen.getByTitle('console.objectView.closePanel');
        fireEvent.click(closeBtn);

        expect(onClose).toHaveBeenCalledOnce();
    });

    it('updates content when activeView changes', () => {
        const { rerender } = render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('All Records')).toBeInTheDocument();
        expect(screen.getByText('Grid')).toBeInTheDocument();

        // Switch to kanban view
        rerender(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'pipeline', label: 'Pipeline', type: 'kanban', columns: ['name'] }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('Pipeline')).toBeInTheDocument();
        expect(screen.getByText('Kanban')).toBeInTheDocument();
    });

    it('shows "None" for empty filters and columns', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'empty', label: 'Empty View', type: 'grid' }}
                objectDef={mockObjectDef}
            />
        );

        // Should show "None" for columns, filters
        const noneTexts = screen.getAllByText('console.objectView.none');
        expect(noneTexts.length).toBeGreaterThanOrEqual(2);
    });
});
