import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSapAiCoreProvider, AZURE_OPENAI_API_VERSION } from './sap-aicore-provider.js';

function createMockJwt(exp: number): string {
  const payload = btoa(JSON.stringify({ exp }));
  return `header.${payload}.sig`;
}

const DEPLOYMENT_URL = 'https://deployment.example.com/v2/inference/deployments/d1234';

const mockCompletion = {
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1234567890,
  model: 'gpt-4o',
  choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
};

const PROMPT = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello' }] }];

const defaultSettings = {
  accessTokenUrl: 'https://auth.example.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  baseUrl: 'https://aicore.example.com',
  resourceGroup: 'my-group'
};

describe('SapAiCoreProvider — integration', () => {
  let mockFetch: ReturnType<typeof vi.fn<typeof fetch>>;

  function deploymentResponse(url: string = DEPLOYMENT_URL) {
    return new Response(
      JSON.stringify({
        resources: [
          {
            details: { resources: { backendDetails: { model: { name: 'gpt-4o' } } } },
            deploymentUrl: url
          }
        ]
      }),
      { status: 200 }
    );
  }

  function setupFetchSequence(deployUrl: string = DEPLOYMENT_URL) {
    const token = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: token }), { status: 200 }))
      .mockResolvedValueOnce(deploymentResponse(deployUrl))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCompletion), { status: 200 }));
    return token;
  }

  beforeEach(() => {
    mockFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the request to the resolved deployment URL with api-version', async () => {
    setupFetchSequence();

    const provider = createSapAiCoreProvider(defaultSettings);
    await provider('sap-aicore/gpt-4o').doGenerate({ prompt: PROMPT });

    const chatRequest = mockFetch.mock.calls[2]![0] as Request;
    expect(chatRequest.url).toBe(`${DEPLOYMENT_URL}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`);
  });

  it('injects the Bearer token and resource group on the chat request', async () => {
    const token = setupFetchSequence();

    const provider = createSapAiCoreProvider(defaultSettings);
    await provider('sap-aicore/gpt-4o').doGenerate({ prompt: PROMPT });

    const chatRequest = mockFetch.mock.calls[2]![0] as Request;
    expect(chatRequest.headers.get('Authorization')).toBe(`Bearer ${token}`);
    expect(chatRequest.headers.get('AI-Resource-Group')).toBe('my-group');
    expect(chatRequest.headers.get('Content-Type')).toBe('application/json');
  });

  it('provider.chat() produces the same request as provider()', async () => {
    setupFetchSequence();

    const provider = createSapAiCoreProvider(defaultSettings);
    await provider.chat('sap-aicore/gpt-4o').doGenerate({ prompt: PROMPT });

    const chatRequest = mockFetch.mock.calls[2]![0] as Request;
    expect(chatRequest.url).toBe(`${DEPLOYMENT_URL}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`);
    expect(chatRequest.headers.get('AI-Resource-Group')).toBe('my-group');
  });

  it('strips trailing slash from deployment URL', async () => {
    setupFetchSequence(DEPLOYMENT_URL + '/');

    const provider = createSapAiCoreProvider(defaultSettings);
    await provider('sap-aicore/gpt-4o').doGenerate({ prompt: PROMPT });

    const chatRequest = mockFetch.mock.calls[2]![0] as Request;
    expect(chatRequest.url).toBe(`${DEPLOYMENT_URL}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`);
  });

  it('reuses cached token and deployment URL on repeated calls', async () => {
    const token = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: token }), { status: 200 }))
      .mockResolvedValueOnce(deploymentResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCompletion), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCompletion), { status: 200 }));

    const provider = createSapAiCoreProvider(defaultSettings);
    const model = provider('sap-aicore/gpt-4o');

    await model.doGenerate({ prompt: PROMPT });
    await model.doGenerate({ prompt: PROMPT });

    // 1 token + 1 deployment + 2 completions = 4, not 6
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('defaults resource group to "default" when not configured', async () => {
    setupFetchSequence();

    const provider = createSapAiCoreProvider({ ...defaultSettings, resourceGroup: undefined });
    await provider('sap-aicore/gpt-4o').doGenerate({ prompt: PROMPT });

    const chatRequest = mockFetch.mock.calls[2]![0] as Request;
    expect(chatRequest.headers.get('AI-Resource-Group')).toBe('default');
  });
});
