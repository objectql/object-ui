/**
 * Type Definitions
 */

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  is_active: boolean;
  priority: number;
  created_at?: string;
}
