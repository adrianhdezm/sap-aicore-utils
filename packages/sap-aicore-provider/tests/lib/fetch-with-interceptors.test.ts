import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { fetchWithInterceptors } from '../../src/lib/fetch-with-interceptors.js';

describe('fetchWithInterceptors', () => {
  const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
  let mockFetch: Mock<typeof fetch>;

  beforeEach(() => {
    mockFetch = vi.fn<typeof fetch>().mockResolvedValue(mockResponse);
  });

  describe('basic fetch behavior', () => {
    it('should pass request through to base fetch when no interceptors are registered', async () => {
      const { fetch } = fetchWithInterceptors(mockFetch);

      await fetch('https://api.example.com/test');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.url).toBe('https://api.example.com/test');
    });

    it('should handle Request object input', async () => {
      const { fetch } = fetchWithInterceptors(mockFetch);
      const request = new Request('https://api.example.com/test', { method: 'POST' });

      await fetch(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.url).toBe('https://api.example.com/test');
      expect(calledRequest.method).toBe('POST');
    });

    it('should handle URL string with RequestInit', async () => {
      const { fetch } = fetchWithInterceptors(mockFetch);

      await fetch('https://api.example.com/test', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.method).toBe('PUT');
      expect(calledRequest.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return the response from base fetch', async () => {
      const { fetch } = fetchWithInterceptors(mockFetch);

      const response = await fetch('https://api.example.com/test');

      expect(response).toBe(mockResponse);
    });
  });

  describe('request interceptors', () => {
    it('should apply a single request interceptor', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use((req) => {
        const headers = new Headers(req.headers);
        headers.set('Authorization', 'Bearer token123');
        return new Request(req, { headers });
      });

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.headers.get('Authorization')).toBe('Bearer token123');
    });

    it('should apply multiple interceptors in order', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);
      const callOrder: string[] = [];

      interceptors.request.use((req) => {
        callOrder.push('first');
        const headers = new Headers(req.headers);
        headers.set('X-First', 'value1');
        return new Request(req, { headers });
      });

      interceptors.request.use((req) => {
        callOrder.push('second');
        const headers = new Headers(req.headers);
        headers.set('X-Second', 'value2');
        return new Request(req, { headers });
      });

      await fetch('https://api.example.com/test');

      expect(callOrder).toEqual(['first', 'second']);
      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.headers.get('X-First')).toBe('value1');
      expect(calledRequest.headers.get('X-Second')).toBe('value2');
    });

    it('should handle async interceptors', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use(async (req) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const headers = new Headers(req.headers);
        headers.set('X-Async', 'async-value');
        return new Request(req, { headers });
      });

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.headers.get('X-Async')).toBe('async-value');
    });

    it('should pass modified request to next interceptor', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use((req) => {
        const headers = new Headers(req.headers);
        headers.set('X-Step', '1');
        return new Request(req, { headers });
      });

      interceptors.request.use((req) => {
        const step = req.headers.get('X-Step');
        const headers = new Headers(req.headers);
        headers.set('X-Step', `${step}-2`);
        return new Request(req, { headers });
      });

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.headers.get('X-Step')).toBe('1-2');
    });

    it('should allow interceptor to modify URL', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use((req) => {
        const newUrl = req.url.replace('/placeholder', '/resolved-path');
        return new Request(newUrl, req);
      });

      await fetch('https://api.example.com/placeholder');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.url).toBe('https://api.example.com/resolved-path');
    });
  });

  describe('interceptor returning void', () => {
    it('should keep original request when interceptor returns void', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use(() => {
        // Intentionally return nothing
      });

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.url).toBe('https://api.example.com/test');
    });

    it('should keep original request when interceptor returns undefined', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use(() => undefined);

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.url).toBe('https://api.example.com/test');
    });

    it('should continue chain when some interceptors return void', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use((req) => {
        const headers = new Headers(req.headers);
        headers.set('X-First', 'value1');
        return new Request(req, { headers });
      });

      interceptors.request.use(() => {
        // Returns void - should not affect request
      });

      interceptors.request.use((req) => {
        const headers = new Headers(req.headers);
        headers.set('X-Third', 'value3');
        return new Request(req, { headers });
      });

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.headers.get('X-First')).toBe('value1');
      expect(calledRequest.headers.get('X-Third')).toBe('value3');
    });
  });

  describe('clearing interceptors', () => {
    it('should remove all interceptors when clear is called', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use((req) => {
        const headers = new Headers(req.headers);
        headers.set('X-Should-Not-Exist', 'value');
        return new Request(req, { headers });
      });

      interceptors.request.clear();

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.headers.get('X-Should-Not-Exist')).toBeNull();
    });

    it('should allow adding new interceptors after clear', async () => {
      const { fetch, interceptors } = fetchWithInterceptors(mockFetch);

      interceptors.request.use((req) => {
        const headers = new Headers(req.headers);
        headers.set('X-Old', 'old-value');
        return new Request(req, { headers });
      });

      interceptors.request.clear();

      interceptors.request.use((req) => {
        const headers = new Headers(req.headers);
        headers.set('X-New', 'new-value');
        return new Request(req, { headers });
      });

      await fetch('https://api.example.com/test');

      const calledRequest = mockFetch.mock.calls[0]![0] as Request;
      expect(calledRequest.headers.get('X-Old')).toBeNull();
      expect(calledRequest.headers.get('X-New')).toBe('new-value');
    });
  });

  describe('default fetch', () => {
    it('should use globalThis.fetch when no baseFetch is provided', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        const { fetch } = fetchWithInterceptors();
        await fetch('https://api.example.com/test');

        expect(mockFetch).toHaveBeenCalledTimes(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
