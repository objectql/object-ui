/**
 * App Component
 * 
 * Main application component demonstrating ObjectForm with MSW
 */

import { useState, useEffect } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { ObjectForm } from '@object-ui/plugin-form';
import { ObjectStackDataSource } from './dataSource';
import { ContactList } from './components/ContactList';
import type { Contact } from './types';
import './App.css';

export function App() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);
  const [dataSource, setDataSource] = useState<ObjectStackDataSource | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeClient();
  }, []);

  async function initializeClient() {
    try {
      // Initialize ObjectStack Client pointing to our mocked API
      const stackClient = new ObjectStackClient({
        baseUrl: ''
      });

      // Wait a bit to ensure MSW is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));
      await stackClient.connect();
      
      const ds = new ObjectStackDataSource(stackClient);
      
      setClient(stackClient);
      setDataSource(ds);
      setConnected(true);
      console.log('✅ ObjectStack Client connected (via MSW)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize client');
      console.error('Failed to initialize client:', err);
    }
  }

  function handleFormSuccess() {
    setEditingContact(null);
    setRefreshTrigger(prev => prev + 1);
  }

  function handleEditContact(contact: Contact) {
    setEditingContact(contact);
    // Scroll to top on mobile
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleCancelEdit() {
    setEditingContact(null);
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 border border-red-300 bg-red-50 rounded-lg shadow-sm text-center">
          <h1 className="text-xl font-bold text-red-800 mb-2">Connection Error</h1>
          <p className="text-red-600 mb-6">{error}</p>
          <button 
            onClick={initializeClient}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!connected || !client || !dataSource) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin"></div>
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-1">Connecting to ObjectStack...</h1>
          <p className="text-gray-600 text-sm">Initializing MSW and ObjectStack Client...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          ObjectForm + MSW Integration
        </h1>
        <p className="text-gray-600 text-lg mb-6">
          Complete CRUD operations using <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">ObjectForm</code> with Mock Service Worker
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          MSW Active - All API calls are mocked
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Section */}
        <section className="lg:col-span-5 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold mb-4">
              {editingContact ? 'Edit Contact' : 'Create New Contact'}
            </h2>
            
            <ObjectForm
              schema={{
                type: 'object-form',
                objectName: 'contact',
                mode: editingContact ? 'edit' : 'create',
                recordId: editingContact?.id,
                fields: ['name', 'email', 'phone', 'company', 'position', 'priority', 'is_active', 'notes'],
                layout: 'vertical',
                columns: 1,
                showSubmit: true,
                showCancel: editingContact !== null,
                submitText: editingContact ? 'Update Contact' : 'Create Contact',
                cancelText: 'Cancel',
                onSuccess: handleFormSuccess,
                onCancel: handleCancelEdit,
              }}
              dataSource={dataSource}
            />
          </div>
        </section>

        {/* List Section */}
        <section className="lg:col-span-7">
          <ContactList
            client={client}
            onEdit={handleEditContact}
            refreshTrigger={refreshTrigger}
          />
        </section>
      </main>

      <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-500 space-y-2">
        <p>
          This example demonstrates ObjectForm integration with MSW.
          All API calls are intercepted and mocked in the browser.
        </p>
        <p className="font-mono text-xs text-gray-400">
          React + TypeScript + Vite + MSW + ObjectForm
        </p>
      </footer>
    </div>
  );
}
