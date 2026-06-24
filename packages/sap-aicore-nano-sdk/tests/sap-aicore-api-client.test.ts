import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { SapAiCoreApiClient, type SapAiCoreParams } from '../src/sap-aicore-api-client.js';

// Helper to create a mock JWT token with a specific expiration time
function createMockJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp }));
  const signature = 'mock-signature';
  return `${header}.${payload}.${signature}`;
}

describe('SapAiCoreApiClient', () => {
  const defaultParams: SapAiCoreParams = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    accessTokenUrl: 'https://auth.example.com',
    baseUrl: 'https://api.example.com'
  };

  let mockFetch: Mock<typeof fetch>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn<typeof fetch>();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with required parameters', () => {
      const client = new SapAiCoreApiClient(defaultParams);

      expect(client.defaultHeaders).toEqual({
        'Content-Type': 'application/json',
        'AI-Resource-Group': 'default'
      });
    });

    it('should use custom resourceGroup when provided', () => {
      const client = new SapAiCoreApiClient({
        ...defaultParams,
        resourceGroup: 'custom-group'
      });

      expect(client.defaultHeaders['AI-Resource-Group']).toBe('custom-group');
    });

    it('should use default resourceGroup when not provided', () => {
      const client = new SapAiCoreApiClient(defaultParams);

      expect(client.defaultHeaders['AI-Resource-Group']).toBe('default');
    });
  });

  describe('getAccessToken', () => {
    it('should fetch a new access token', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);
      const token = await client.getAccessToken();

      expect(token).toBe(mockToken);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://auth.example.com/oauth/token?grant_type=client_credentials', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${btoa('test-client-id:test-client-secret')}`
        }
      });
    });

    it('should return cached token when not expired', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);

      const token1 = await client.getAccessToken();
      const token2 = await client.getAccessToken();

      expect(token1).toBe(mockToken);
      expect(token2).toBe(mockToken);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch new token when cached token is expired', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(now);

      const nowSeconds = Math.floor(now.getTime() / 1000);
      const firstToken = createMockJwt(nowSeconds + 3600); // Expires in 1 hour
      const secondToken = createMockJwt(nowSeconds + 7200); // Expires in 2 hours

      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: firstToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: secondToken }), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);

      const token1 = await client.getAccessToken();
      expect(token1).toBe(firstToken);

      // Advance time by 61 minutes (token expires after 60 minutes based on JWT exp)
      vi.advanceTimersByTime(61 * 60 * 1000);

      const token2 = await client.getAccessToken();
      expect(token2).toBe(secondToken);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when token fetch fails', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 401, statusText: 'Unauthorized' }));

      const client = new SapAiCoreApiClient(defaultParams);

      await expect(client.getAccessToken()).rejects.toThrow('Token fetch failed: 401 Unauthorized');
    });

    it('should throw error for invalid JWT token without payload', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'invalid-token' }), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);

      await expect(client.getAccessToken()).rejects.toThrow('Invalid JWT token: missing payload');
    });

    it('should correctly parse exp claim from JWT and set expiration', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(now);

      const expTimestamp = Math.floor(now.getTime() / 1000) + 1800; // 30 minutes from now
      const mockToken = createMockJwt(expTimestamp);
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);
      await client.getAccessToken();

      // Advance time by 29 minutes - token should still be valid
      vi.advanceTimersByTime(29 * 60 * 1000);
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: createMockJwt(expTimestamp + 3600) }), { status: 200 }));

      const cachedToken = await client.getAccessToken();
      expect(cachedToken).toBe(mockToken);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still using cached token

      // Advance time by 2 more minutes (total 31 minutes) - token should be expired
      vi.advanceTimersByTime(2 * 60 * 1000);

      await client.getAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(2); // New token fetched
    });
  });

  describe('getDeploymentUrl', () => {
    const mockDeploymentsResponse = {
      resources: [
        {
          details: {
            resources: {
              backendDetails: {
                model: { name: 'gpt-4o' }
              }
            }
          },
          deploymentUrl: 'https://deployment.example.com/gpt-4o'
        },
        {
          details: {
            resources: {
              backendDetails: {
                model: { name: 'gpt-3.5-turbo' }
              }
            }
          },
          deploymentUrl: 'https://deployment.example.com/gpt-3.5-turbo'
        }
      ]
    };

    it('should fetch and return deployment URL for a model', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockDeploymentsResponse), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);
      const deploymentUrl = await client.getDeploymentUrl('gpt-4o');

      expect(deploymentUrl).toBe('https://deployment.example.com/gpt-4o');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const deploymentsCall = mockFetch.mock.calls[1]!;
      expect(deploymentsCall[0]).toBe('https://api.example.com/v2/lm/deployments?scenarioId=foundation-models&status=RUNNING');
      expect(deploymentsCall[1] as RequestInit).toEqual({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'AI-Resource-Group': 'default',
          Authorization: `Bearer ${mockToken}`
        }
      });
    });

    it('should return cached deployment URL on subsequent calls', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockDeploymentsResponse), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);

      const url1 = await client.getDeploymentUrl('gpt-4o');
      const url2 = await client.getDeploymentUrl('gpt-4o');

      expect(url1).toBe('https://deployment.example.com/gpt-4o');
      expect(url2).toBe('https://deployment.example.com/gpt-4o');
      // Only 2 calls: one for token, one for deployments (second getDeploymentUrl uses cache)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when deployment fetch fails', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Internal Server Error' }));

      const client = new SapAiCoreApiClient(defaultParams);

      await expect(client.getDeploymentUrl('gpt-4o')).rejects.toThrow('Deployment Url fetch failed: 500 Internal Server Error');
    });

    it('should throw error when no deployment found for model', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ resources: [] }), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);

      await expect(client.getDeploymentUrl('non-existent-model')).rejects.toThrow(
        'No running deployment found for model: non-existent-model'
      );
    });

    it('should throw error when deployment has no URL', async () => {
      const responseWithoutUrl = {
        resources: [
          {
            details: {
              resources: {
                backendDetails: {
                  model: { name: 'gpt-4o' }
                }
              }
            }
            // deploymentUrl is missing
          }
        ]
      };

      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(responseWithoutUrl), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);

      await expect(client.getDeploymentUrl('gpt-4o')).rejects.toThrow('No running deployment found for model: gpt-4o');
    });

    it('should use custom resourceGroup in headers', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockDeploymentsResponse), { status: 200 }));

      const client = new SapAiCoreApiClient({
        ...defaultParams,
        resourceGroup: 'my-custom-group'
      });

      await client.getDeploymentUrl('gpt-4o');

      const deploymentsCall = mockFetch.mock.calls[1]!;
      expect((deploymentsCall[1] as RequestInit).headers as Record<string, string>).toHaveProperty('AI-Resource-Group', 'my-custom-group');
    });

    it('should cache different models separately', async () => {
      const mockToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: mockToken }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockDeploymentsResponse), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockDeploymentsResponse), { status: 200 }));

      const client = new SapAiCoreApiClient(defaultParams);

      const url1 = await client.getDeploymentUrl('gpt-4o');
      const url2 = await client.getDeploymentUrl('gpt-3.5-turbo');
      const url3 = await client.getDeploymentUrl('gpt-4o'); // Should use cache
      const url4 = await client.getDeploymentUrl('gpt-3.5-turbo'); // Should use cache

      expect(url1).toBe('https://deployment.example.com/gpt-4o');
      expect(url2).toBe('https://deployment.example.com/gpt-3.5-turbo');
      expect(url3).toBe('https://deployment.example.com/gpt-4o');
      expect(url4).toBe('https://deployment.example.com/gpt-3.5-turbo');
      // 1 token call + 2 deployment calls (cache hits for url3 and url4)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
