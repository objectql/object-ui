/**
 * Tests for ObjectStackAdapter file upload integration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectStackAdapter } from './index';

describe('ObjectStackAdapter File Upload', () => {
  let adapter: ObjectStackAdapter;

  beforeEach(() => {
    adapter = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
      autoReconnect: false,
    });
    vi.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should be a method on the adapter', () => {
      expect(typeof adapter.uploadFile).toBe('function');
    });

    it('should call fetch with multipart form data when connected', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'file-1',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: 'http://localhost:3000/files/file-1',
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Manually set connected state by accessing private field
      (adapter as any).connected = true;
      (adapter as any).connectionState = 'connected';

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      const result = await adapter.uploadFile('documents', file, {
        recordId: 'rec-123',
        fieldName: 'attachment',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/data/documents/upload'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );

      expect(result.id).toBe('file-1');
      expect(result.filename).toBe('test.pdf');
    });

    it('should throw on upload failure', async () => {
      const mockResponse = {
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        json: vi.fn().mockResolvedValue({ message: 'File too large' }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Manually set connected state
      (adapter as any).connected = true;
      (adapter as any).connectionState = 'connected';

      const file = new File(['test'], 'large.bin', { type: 'application/octet-stream' });

      await expect(adapter.uploadFile('documents', file)).rejects.toThrow('File too large');
    });
  });

  describe('uploadFiles', () => {
    it('should be a method on the adapter', () => {
      expect(typeof adapter.uploadFiles).toBe('function');
    });

    it('should upload multiple files', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          { id: 'file-1', filename: 'a.pdf', mimeType: 'application/pdf', size: 100, url: '/files/1' },
          { id: 'file-2', filename: 'b.pdf', mimeType: 'application/pdf', size: 200, url: '/files/2' },
        ]),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Manually set connected state
      (adapter as any).connected = true;
      (adapter as any).connectionState = 'connected';

      const files = [
        new File(['content1'], 'a.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'b.pdf', { type: 'application/pdf' }),
      ];

      const results = await adapter.uploadFiles('documents', files);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('file-1');
      expect(results[1].id).toBe('file-2');
    });
  });
});
