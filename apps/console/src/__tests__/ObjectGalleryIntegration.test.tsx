
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ListView, ObjectGallery } from '@object-ui/plugin-list'; 
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRendererProvider } from '@object-ui/react';

// Mock UI components
vi.mock('@object-ui/components', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
        Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
        Input: (props: any) => <input {...props} data-testid="mock-input" />,
        ToggleGroup: ({ children, value, onValueChange }: any) => <div data-value={value} onChange={onValueChange}>{children}</div>,
        ToggleGroupItem: ({ children, value }: any) => <button data-value={value}>{children}</button>,
        Tabs: ({ children }: any) => <div>{children}</div>,
        TabsList: ({ children }: any) => <div>{children}</div>,
        TabsTrigger: ({ children }: any) => <button>{children}</button>,
        Empty: ({ children }: any) => <div>{children}</div>,
        Popover: ({ children }: any) => <div>{children}</div>,
        PopoverTrigger: ({ children }: any) => <div>{children}</div>,
        PopoverContent: ({ children }: any) => <div>{children}</div>,
    };
});

describe('ObjectGallery & ListView Integration', () => {
    
    beforeEach(() => {
        // Register the gallery component so SchemaRenderer can find it
        ComponentRegistry.register('object-gallery', ObjectGallery, { namespace: 'plugin-list' });
        // Register other views to avoid warnings
        ComponentRegistry.register('object-grid', () => <div>Grid</div>);
    });

    const mockData = [
        { _id: '1', name: 'Product A', category: 'Tech', image: 'http://img/a.jpg' },
        { _id: '2', name: 'Product B', category: 'Home', image: 'http://img/b.jpg' },
    ];

    const mockDataSource = {
        find: vi.fn(),
        delete: vi.fn()
    };

    it('should receive data from ListView and render items', async () => {
        mockDataSource.find.mockResolvedValue(mockData);

        const schema = {
            objectName: 'product',
            viewType: 'gallery',
            options: {
                gallery: {
                    imageField: 'image',
                    titleField: 'name',
                    subtitleField: 'category'
                }
            }
        };

        await act(async () => {
            render(
                <SchemaRendererProvider dataSource={mockDataSource}>
                    <ListView schema={schema as any} dataSource={mockDataSource} />
                </SchemaRendererProvider>
            );
        });

        // Wait for data fetch
        await waitFor(() => {
            expect(mockDataSource.find).toHaveBeenCalledWith('product', expect.objectContaining({
                $top: 100
            }));
        });

        // Check if items are rendered
        // ObjectGallery uses: <h3 ...>{item[titleField]}</h3>
        expect(screen.getByText('Product A')).toBeInTheDocument();
        expect(screen.getByText('Product B')).toBeInTheDocument();
        // Note: ObjectGallery only renders title and visibleFields, not subtitleField
        expect(screen.getByText('Product A')).toBeInTheDocument();
    });

    it('should handle empty data gracefully', async () => {
        mockDataSource.find.mockResolvedValue([]);

        const schema = {
            objectName: 'product',
            viewType: 'gallery',
            options: { gallery: {} }
        };

        await act(async () => {
            render(
                <SchemaRendererProvider dataSource={mockDataSource}>
                    <ListView schema={schema as any} dataSource={mockDataSource} />
                </SchemaRendererProvider>
            );
        });

        expect(screen.getByText('No items to display')).toBeInTheDocument();
    });

    it('should use default configured fields if not specified in schema', async () => {
        mockDataSource.find.mockResolvedValue([{ name: 'Mystery Item', image: 'test.jpg' }]);

        const schema = {
            objectName: 'product',
            viewType: 'gallery',
            // No options provided, defaults should be imageField='image', titleField='name'
        };

        await act(async () => {
             render(
                <SchemaRendererProvider dataSource={mockDataSource}>
                    <ListView schema={schema as any} dataSource={mockDataSource} />
                </SchemaRendererProvider>
             );
        });

        expect(screen.getByText('Mystery Item')).toBeInTheDocument();
        // Since we didn't provide imageField in schema, ObjectGallery defaults to 'image'
        // The img tag should be present
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'test.jpg');
    });

    it('should show placeholder if image is missing', async () => {
        mockDataSource.find.mockResolvedValue([{ name: 'No Image Item' }]); // Missing 'image' field

        const schema = {
            objectName: 'product',
            viewType: 'gallery',
            options: {
                gallery: {
                    imageField: 'photo' // Key that doesn't exist
                }
            }
        };

        await act(async () => {
             render(
                <SchemaRendererProvider dataSource={mockDataSource}>
                    <ListView schema={schema as any} dataSource={mockDataSource} />
                </SchemaRendererProvider>
             );
        });

        expect(screen.getByText('No Image Item')).toBeInTheDocument();
        // Should verify fallback rendered. 
        // Logic: if (item[imageField]) render img else render div with initial
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByText('N')).toBeInTheDocument(); // Initial of 'No Image Item'
    });
});

