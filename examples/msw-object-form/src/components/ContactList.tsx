/**
 * ContactList Component
 * 
 * Displays a list of contacts with edit and delete functionality
 */

import { useState, useEffect } from 'react';
import type { ObjectStackClient } from '@objectstack/client';
import type { Contact } from '../types';

export interface ContactListProps {
  client: ObjectStackClient;
  onEdit: (contact: Contact) => void;
  refreshTrigger?: number;
}

export function ContactList({ client, onEdit, refreshTrigger }: ContactListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, [refreshTrigger]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.data.find('contact', {
        sort: ['-priority', 'name']
      });
      setContacts(result.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      await client.data.delete('contact', id);
      await loadContacts();
    } catch (err) {
      alert('Failed to delete contact: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading contacts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg">
        <p className="text-gray-500">No contacts found. Create your first contact using the form.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Contact List ({contacts.length})</h2>
      
      <div className="grid gap-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{contact.name}</h3>
                  {contact.is_active ? (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      Inactive
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                    Priority: {contact.priority}
                  </span>
                </div>
                
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>📧 {contact.email}</p>
                  {contact.phone && <p>📞 {contact.phone}</p>}
                  {contact.company && (
                    <p>
                      🏢 {contact.company}
                      {contact.position && ` - ${contact.position}`}
                    </p>
                  )}
                  {contact.notes && (
                    <p className="text-gray-500 italic">💬 {contact.notes}</p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(contact)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  data-testid={`edit-contact-${contact.id}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(contact.id)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  data-testid={`delete-contact-${contact.id}`}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
