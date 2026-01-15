'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { designStorage, Design } from '@/lib/designStorage';
import { 
  Plus, 
  FileJson, 
  Trash2, 
  Copy, 
  Share2, 
  Download, 
  ArrowLeft,
  Clock,
  Tag,
  Search,
  Grid3x3,
  List
} from 'lucide-react';

export default function MyDesigns() {
  const router = useRouter();
  const [designs, setDesigns] = useState<Design[]>(() => designStorage.getAllDesigns());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importName, setImportName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>('');

  const loadDesigns = () => {
    setDesigns(designStorage.getAllDesigns());
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      designStorage.deleteDesign(deleteTargetId);
      loadDesigns();
      toast.success('Design deleted successfully');
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      setDeleteTargetName('');
    }
  };

  const handleClone = (id: string) => {
    try {
      const cloned = designStorage.cloneDesign(id);
      loadDesigns();
      toast.success('Design cloned successfully');
      router.push(`/studio/${cloned.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to clone design: ${message}`);
    }
  };

  const handleShare = (id: string) => {
    try {
      const shareUrl = designStorage.shareDesign(id);
      navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to share design: ${message}`);
    }
  };

  const handleExport = (id: string) => {
    try {
      const { json, filename } = designStorage.exportDesign(id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Design exported successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to export design: ${message}`);
    }
  };

  const handleImport = () => {
    try {
      const imported = designStorage.importDesign(importJson, importName || undefined);
      setShowImportModal(false);
      setImportJson('');
      setImportName('');
      loadDesigns();
      toast.success('Design imported successfully');
      router.push(`/studio/${imported.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to import design: ${message}`);
    }
  };

  const filteredDesigns = designs.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/')}
              className="p-2 -ml-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-xl transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-bold text-xl tracking-tight">
              My Designs
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl transition-all shadow-sm hover:shadow"
            >
              <FileJson className="w-4 h-4" />
              Import JSON
            </button>
            <button
              onClick={() => router.push('/studio/new')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              New Design
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and View Controls */}
        <div className="flex items-center justify-between mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search designs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-border rounded-xl focus:border-ring focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Designs Display */}
        {filteredDesigns.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
              <FileJson className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {searchQuery ? 'No designs found' : 'No designs yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try a different search term' : 'Create your first design or import a template'}
            </p>
            {!searchQuery && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => router.push('/studio/new')}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Create New Design
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl transition-all shadow-sm hover:shadow"
                >
                  <FileJson className="w-5 h-5" />
                  Import from JSON
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDesigns.map((design) => (
              <div
                key={design.id}
                className="group bg-card border-2 border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3
                      className="text-lg font-bold text-gray-900 mb-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => router.push(`/studio/${design.id}`)}
                    >
                      {design.name}
                    </h3>
                    {design.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{design.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Updated {formatDate(design.updatedAt)}</span>
                </div>

                {design.tags && design.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {design.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-md"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => router.push(`/studio/${design.id}`)}
                    className="flex-1 px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleClone(design.id)}
                    className="p-2 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                    title="Clone"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleShare(design.id)}
                    className="p-2 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                    title="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleExport(design.id)}
                    className="p-2 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                    title="Export"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(design.id, design.name)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border-2 border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b-2 border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tags</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Updated</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDesigns.map((design) => (
                    <tr key={design.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => router.push(`/studio/${design.id}`)}
                          className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
                        >
                          {design.name}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 line-clamp-1">{design.description || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {design.tags?.map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded"
                            >
                              {tag}
                            </span>
                          )) || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(design.updatedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleClone(design.id)}
                            className="p-1.5 text-gray-600 hover:text-primary hover:bg-primary/10 rounded transition-all"
                            title="Clone"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleShare(design.id)}
                            className="p-1.5 text-gray-600 hover:text-primary hover:bg-primary/10 rounded transition-all"
                            title="Share"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExport(design.id)}
                            className="p-1.5 text-gray-600 hover:text-primary hover:bg-primary/10 rounded transition-all"
                            title="Export"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(design.id, design.name)}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Import Design</h2>
              <p className="text-sm text-gray-600 mt-1">Paste your JSON schema to import</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Design Name (optional)
                </label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="My Imported Design"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-ring focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  JSON Schema *
                </label>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='{"type": "page", "body": [...]}'
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-ring focus:outline-none resize-none h-64 font-mono text-sm transition-colors"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson('');
                  setImportName('');
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importJson.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-lg shadow-indigo-300/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Design
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Delete Design?</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700">
                Are you sure you want to delete <strong>{deleteTargetName}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTargetId(null);
                  setDeleteTargetName('');
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
