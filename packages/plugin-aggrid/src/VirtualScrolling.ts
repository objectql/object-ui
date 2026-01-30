/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Virtual Scrolling in AG Grid
 * 
 * AG Grid provides built-in virtual scrolling by default, which renders only
 * the visible rows in the viewport. This is a core feature of AG Grid and
 * requires no additional configuration.
 * 
 * ## How It Works
 * 
 * - AG Grid automatically virtualizes rows by rendering only visible rows
 * - As you scroll, rows are recycled and reused for new data
 * - This provides excellent performance even with datasets of 100,000+ rows
 * 
 * ## Performance Tips
 * 
 * 1. **Row Buffer**: Adjust `rowBuffer` to control how many extra rows are rendered
 *    ```ts
 *    gridOptions: { rowBuffer: 10 }  // Render 10 extra rows above/below viewport
 *    ```
 * 
 * 2. **Suppress Animations**: Disable animations for very large datasets
 *    ```ts
 *    animateRows: false
 *    ```
 * 
 * 3. **Debounce Vertical Scroll**: Add delay to vertical scroll updates
 *    ```ts
 *    gridOptions: { debounceVerticalScrollbar: true }
 *    ```
 * 
 * 4. **Row Height**: Use fixed row heights for better performance
 *    ```ts
 *    gridOptions: { rowHeight: 40 }
 *    ```
 * 
 * ## Example Usage
 * 
 * ```tsx
 * <AgGrid
 *   rowData={largeDataset}  // 10,000+ items
 *   columnDefs={columns}
 *   gridOptions={{
 *     rowBuffer: 10,
 *     rowHeight: 40,
 *     debounceVerticalScrollbar: true,
 *   }}
 *   animateRows={false}
 * />
 * ```
 * 
 * ## References
 * 
 * - [AG Grid Row Virtualisation](https://www.ag-grid.com/javascript-data-grid/dom-virtualisation/)
 * - [Performance Best Practices](https://www.ag-grid.com/javascript-data-grid/performance/)
 */

export const VIRTUAL_SCROLLING_DOCS = {
  enabled: true,
  automatic: true,
  recommendedSettings: {
    rowBuffer: 10,
    rowHeight: 40,
    debounceVerticalScrollbar: true,
    animateRows: false,
  },
};
