import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NoSuchModelError } from '@ai-sdk/provider';
import { createSapAiCoreProvider, AZURE_OPENAI_API_VERSION } from '../src/sap-aicore-provider.js';
import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';

const mockOpenAICompatibleChatLanguageModel = vi.hoisted(() => vi.fn());
const mockLoadSetting = vi.hoisted(() => vi.fn());
const mockLoadOptionalSetting = vi.hoisted(() => vi.fn());
const requestInterceptors = vi.hoisted(() => [] as Array<(request: Request) => Promise<Request | void> | Request | void>);
const mockFetchWithInterceptors = vi.hoisted(() =>
  vi.fn(() => ({
    fetch: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((interceptor) => requestInterceptors.push(interceptor)),
        clear: vi.fn(() => {
          requestInterceptors.length = 0;
        })
      }
    }
  }))
);
const mockGetAccessToken = vi.hoisted(() => vi.fn().mockResolvedValue('token-123'));
const mockGetDeploymentUrl = vi.hoisted(() => vi.fn().mockResolvedValue('https://deploy.example.com'));
const apiClientConstructorArgs = vi.hoisted(() => [] as unknown[]);
const mockSapAiCoreApiClient = vi.hoisted(() => {
  return class SapAiCoreApiClientMock {
    constructor(...args: unknown[]) {
      apiClientConstructorArgs.push(args);
    }
    getAccessToken = mockGetAccessToken;
    getDeploymentUrl = mockGetDeploymentUrl;
  };
});

vi.mock('@ai-sdk/openai-compatible', () => ({
  OpenAICompatibleChatLanguageModel: mockOpenAICompatibleChatLanguageModel
}));

vi.mock('@ai-sdk/provider-utils', () => ({
  loadSetting: mockLoadSetting,
  loadOptionalSetting: mockLoadOptionalSetting
}));

vi.mock('../src/lib/fetch-with-interceptors.js', () => ({
  fetchWithInterceptors: mockFetchWithInterceptors
}));

vi.mock('@ai-foundry/sap-aicore-nano-sdk', () => ({
  SapAiCoreApiClient: mockSapAiCoreApiClient
}));

const openAiModelMock = OpenAICompatibleChatLanguageModel as Mock;

describe('createSapAiCoreProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestInterceptors.length = 0;
    apiClientConstructorArgs.length = 0;
    mockLoadSetting.mockImplementation(
      ({ settingValue, environmentVariableName }: { settingValue?: string; environmentVariableName: string }) => {
        return settingValue ?? `env:${environmentVariableName}`;
      }
    );
    mockLoadOptionalSetting.mockImplementation(({ settingValue }: { settingValue?: string }) => settingValue);
  });

  it('creates chat models with expected configuration and headers', () => {
    const provider = createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com',
      resourceGroup: 'rg-1',
      headers: { 'X-Test': 'true' }
    });

    provider('sap-aicore/gpt-4o');

    expect(openAiModelMock).toHaveBeenCalledTimes(1);
    const [modelId, options] = openAiModelMock.mock.calls[0]!;
    expect(modelId).toBe('gpt-4o');
    expect(options.provider).toBe('sap-aicore.chat');
    expect(options.supportsStructuredOutputs).toBe(true);
    expect(options.includeUsage).toBe(true);

    const headers = options.headers();
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['AI-Resource-Group']).toBe('rg-1');
    expect(headers['X-Test']).toBe('true');

    const url = options.url({ path: '/chat/completions', modelId: 'gpt-4o' });
    expect(url).toBe(`https://aicore.example.com/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`);
  });

  it('defaults the resource group header when none is provided', () => {
    const provider = createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com'
    });

    provider('sap-aicore/gpt-4o');

    const [, options] = openAiModelMock.mock.calls[0]!;
    const headers = options.headers();
    expect(headers['AI-Resource-Group']).toBe('default');
  });

  it('provides a chat method that strips the prefix and uses the bare model id', () => {
    const provider = createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com'
    });

    provider.chat('sap-aicore/gpt-4o');

    const [modelId] = openAiModelMock.mock.calls[0]!;
    expect(modelId).toBe('gpt-4o');
  });

  it('rejects invalid model ids', () => {
    const provider = createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com'
    });

    expect(() => provider('gpt-4o')).toThrow("Invalid modelId: gpt-4o. Model IDs must start with 'sap-aicore/'.");
  });

  it('cannot be used as a constructor', () => {
    const provider = createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com'
    });

    expect(() => new (provider as unknown as new (id: string) => unknown)('sap-aicore/gpt-4o')).toThrow(
      'The SAP AI Core provider function cannot be called with the new keyword.'
    );
  });

  it('throws NoSuchModelError for unsupported model types', () => {
    const provider = createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com'
    });

    expect(() => provider.languageModel('x')).toThrow(NoSuchModelError);
    expect(() => provider.embeddingModel('x')).toThrow(NoSuchModelError);
    expect(() => provider.imageModel('x')).toThrow(NoSuchModelError);
    expect(() => provider.transcriptionModel('x')).toThrow(NoSuchModelError);
    expect(() => provider.speechModel('x')).toThrow(NoSuchModelError);
    expect(() => provider.rerankingModel('x')).toThrow(NoSuchModelError);
  });

  it('registers request interceptors for auth and deployment resolution', async () => {
    const provider = createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com'
    });

    provider('sap-aicore/gpt-4o');

    expect(requestInterceptors).toHaveLength(2);

    const baseUrl = `https://aicore.example.com/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
    let request: Request = new Request(baseUrl, { headers: { 'X-Start': 'yes' } });

    for (const interceptor of requestInterceptors) {
      const result = await interceptor(request);
      if (result instanceof Request) {
        request = result;
      }
    }

    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
    expect(mockGetDeploymentUrl).toHaveBeenCalledWith('gpt-4o');
    expect(request.headers.get('Authorization')).toBe('Bearer token-123');
    expect(request.url).toBe(`https://deploy.example.com/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`);
  });

  it('builds the API client with resolved settings', () => {
    createSapAiCoreProvider({
      accessTokenUrl: 'https://auth.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      baseUrl: 'https://aicore.example.com',
      resourceGroup: 'rg-2'
    });

    expect(apiClientConstructorArgs).toEqual([
      [
        {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          accessTokenUrl: 'https://auth.example.com',
          baseUrl: 'https://aicore.example.com',
          resourceGroup: 'rg-2'
        }
      ]
    ]);
  });
});
