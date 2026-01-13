export class Registry {
    constructor() {
        Object.defineProperty(this, "components", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    register(type, component, meta) {
        if (this.components.has(type)) {
            console.warn(`Component type "${type}" is already registered. Overwriting.`);
        }
        this.components.set(type, {
            type,
            component,
            ...meta
        });
    }
    get(type) {
        return this.components.get(type)?.component;
    }
    getConfig(type) {
        return this.components.get(type);
    }
    has(type) {
        return this.components.has(type);
    }
    getAllTypes() {
        return Array.from(this.components.keys());
    }
    getAllConfigs() {
        return Array.from(this.components.values());
    }
}
export const ComponentRegistry = new Registry();
