/**
 * Type declarations for the HotCRM metadata bridge.
 *
 * These declarations are consumed by tsc (with skipLibCheck: true)
 * so that the console build does not need to type-check the hotcrm
 * source tree.
 */
export declare const hotcrmObjects: any[];
export declare const hotcrmApps: any[];
export declare function mergeObjects(existing: any[], hotcrm: any[]): any[];
