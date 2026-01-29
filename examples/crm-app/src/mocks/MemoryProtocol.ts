// Temporary Memory Protocol Implementation
// Since we cannot find the official one in the packages, we implement a minimal one for the mock

import type { IObjectStackProtocol } from '@objectstack/spec/api';

export class MemoryProtocol implements IObjectStackProtocol {
    private data: Record<string, any[]> = {};
    private objects: any[] = [];

    constructor(data: Record<string, any[]> = {}, objects: any[] = []) {
        this.data = data;
        this.objects = objects;
    }

    async findData(object: string, params?: any): Promise<any[]> {
        const items = this.data[object] || [];
        // Minimal mock filtering could go here
        return items;
    }

    async getData(object: string, id: string): Promise<any> {
        const items = this.data[object] || [];
        const item = items.find((i: any) => i.id === id);
        if (!item) throw new Error(`Record not found: ${object} ${id}`);
        return item;
    }

    async createData(object: string, data: any): Promise<any> {
        if (!this.data[object]) this.data[object] = [];
        const newItem = { id: Math.random().toString(36).substr(2, 9), ...data };
        this.data[object].push(newItem);
        return newItem;
    }

    async updateData(object: string, id: string, data: any): Promise<any> {
        const items = this.data[object] || [];
        const index = items.findIndex((i: any) => i.id === id);
        if (index === -1) throw new Error(`Record not found: ${object} ${id}`);
        
        const updated = { ...items[index], ...data };
        this.data[object][index] = updated;
        return updated;
    }

    async deleteData(object: string, id: string): Promise<any> {
        if (!this.data[object]) return { success: false };
        const initialLength = this.data[object].length;
        this.data[object] = this.data[object].filter((i: any) => i.id !== id);
        return { success: this.data[object].length < initialLength };
    }
}
