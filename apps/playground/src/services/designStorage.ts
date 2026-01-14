/**
 * Design Storage Service
 * Handles saving, loading, and managing user designs
 * Currently uses localStorage, can be extended to use cloud storage
 */

/**
 * Sanitize a filename by removing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\s]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .substring(0, 100); // Limit length
}

export interface Design {
  id: string;
  name: string;
  description?: string;
  schema: unknown;
  createdAt: string;
  updatedAt: string;
  isTemplate?: boolean;
  tags?: string[];
}

const STORAGE_KEY = 'objectui_designs';
const SHARED_DESIGNS_KEY = 'objectui_shared_designs';

class DesignStorageService {
  /**
   * Get all saved designs
   */
  getAllDesigns(): Design[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading designs:', error);
      return [];
    }
  }

  /**
   * Get a single design by ID
   */
  getDesign(id: string): Design | null {
    const designs = this.getAllDesigns();
    return designs.find(d => d.id === id) || null;
  }

  /**
   * Save a new design
   */
  saveDesign(design: Omit<Design, 'id' | 'createdAt' | 'updatedAt'>): Design {
    const designs = this.getAllDesigns();
    const newDesign: Design = {
      ...design,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    designs.push(newDesign);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
    return newDesign;
  }

  /**
   * Update an existing design
   */
  updateDesign(id: string, updates: Partial<Omit<Design, 'id' | 'createdAt'>>): Design | null {
    const designs = this.getAllDesigns();
    const index = designs.findIndex(d => d.id === id);
    
    if (index === -1) return null;
    
    designs[index] = {
      ...designs[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
    return designs[index];
  }

  /**
   * Delete a design
   */
  deleteDesign(id: string): boolean {
    const designs = this.getAllDesigns();
    const filtered = designs.filter(d => d.id !== id);
    
    if (filtered.length === designs.length) return false;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }

  /**
   * Generate a shareable link for a design
   */
  shareDesign(id: string): string {
    const design = this.getDesign(id);
    if (!design) throw new Error('Design not found');
    
    // Save to shared designs store
    const sharedDesigns = this.getSharedDesigns();
    const shareId = this.generateShareId();
    sharedDesigns[shareId] = design;
    localStorage.setItem(SHARED_DESIGNS_KEY, JSON.stringify(sharedDesigns));
    
    // Return shareable URL
    return `${window.location.origin}/studio/shared/${shareId}`;
  }

  /**
   * Get a shared design
   */
  getSharedDesign(shareId: string): Design | null {
    const sharedDesigns = this.getSharedDesigns();
    return sharedDesigns[shareId] || null;
  }

  /**
   * Import a design from JSON
   */
  importDesign(json: string, name?: string): Design {
    try {
      const schema = JSON.parse(json);
      return this.saveDesign({
        name: name || 'Imported Design',
        description: 'Imported from JSON',
        schema,
        tags: ['imported'],
      });
    } catch (error) {
      throw new Error('Invalid JSON: ' + (error as Error).message);
    }
  }

  /**
   * Export a design as JSON with user-friendly filename
   */
  exportDesign(id: string): { json: string; filename: string } {
    const design = this.getDesign(id);
    if (!design) throw new Error('Design not found');
    const json = JSON.stringify(design.schema, null, 2);
    const filename = `${sanitizeFilename(design.name) || 'design'}.json`;
    return { json, filename };
  }

  /**
   * Clone a design (useful for templates)
   */
  cloneDesign(id: string, newName?: string): Design {
    const design = this.getDesign(id);
    if (!design) throw new Error('Design not found');
    
    return this.saveDesign({
      name: newName || `${design.name} (Copy)`,
      description: design.description,
      schema: JSON.parse(JSON.stringify(design.schema)), // Deep clone
      tags: [...(design.tags || []), 'cloned'],
    });
  }

  // Private helper methods
  private generateUUID(): string {
    // Prefer native crypto.randomUUID when available
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // Fallback: generate RFC4122 v4 UUID using crypto.getRandomValues
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);

      // Per RFC4122 section 4.4
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      const segments = [
        Array.from(bytes.slice(0, 4)).map(toHex).join(''),
        Array.from(bytes.slice(4, 6)).map(toHex).join(''),
        Array.from(bytes.slice(6, 8)).map(toHex).join(''),
        Array.from(bytes.slice(8, 10)).map(toHex).join(''),
        Array.from(bytes.slice(10, 16)).map(toHex).join(''),
      ];

      return segments.join('-');
    }

    // Last-resort fallback for environments without Web Crypto
    return `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateId(): string {
    return `design_${this.generateUUID()}`;
  }

  private generateShareId(): string {
    // Generate a compact share ID derived from a UUID for security
    const uuid = this.generateUUID();
    // Remove hyphens and take first 12 characters for a shorter share link
    return uuid.replace(/-/g, '').substring(0, 12);
  }

  private getSharedDesigns(): Record<string, Design> {
    try {
      const data = localStorage.getItem(SHARED_DESIGNS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading shared designs:', error);
      return {};
    }
  }
}

// Export singleton instance
export const designStorage = new DesignStorageService();
