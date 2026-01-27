import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';
import { describe, it, expect } from 'vitest';
import { SidebarProvider } from '@object-ui/components';

describe('SidebarNav', () => {
    it('renders without crashing using default items', () => {
        render(
            <SidebarProvider>
                <BrowserRouter>
                    <SidebarNav />
                </BrowserRouter>
            </SidebarProvider>
        );
        expect(screen.getByText('Dashboard')).toBeDefined();
    });

    it('renders custom items if provided', () => {
        const customItems = [
            { title: 'Custom Link', href: '/custom' }
        ];
        render(
             <SidebarProvider>
                <BrowserRouter>
                    <SidebarNav items={customItems} />
                </BrowserRouter>
            </SidebarProvider>
        );
        expect(screen.getByText('Custom Link')).toBeDefined();
    });
});

