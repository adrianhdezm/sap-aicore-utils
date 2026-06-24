import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import { NoSuchModelError, type LanguageModelV3 } from '@ai-sdk/provider';
import { loadOptionalSetting, loadSetting } from '@ai-sdk/provider-utils';
import { fetchWithInterceptors } from './lib/fetch-with-interceptors.js';
import { SapAiCoreApiClient } from '@ai-foundry/sap-aicore-nano-sdk';

export type SapAiCoreModelId =
  | 'sap-aicore/gpt-4o'
  | 'sap-aicore/gpt-4o-mini'
  | 'sap-aicore/gpt-4.1'
  | 'sap-aicore/gpt-4.1-nano'
  | 'sap-aicore/gpt-4.1-mini'
  | 'sap-aicore/gpt-5'
  | 'sap-aicore/gpt-5-mini'
  | 'sap-aicore/gpt-5-nano'
  | 'sap-aicore/o3'
  | 'sap-aicore/o3-mini'
  | 'sap-aicore/o1'
  | 'sap-aicore/o4-mini'
  | (string & {});

export const AZURE_OPENAI_API_VERSION = '2025-04-01-preview';

export interface SapAiCoreProvider {
  languageModel(modelId: SapAiCoreModelId): never;
  embeddingModel(modelId: SapAiCoreModelId): never;
  imageModel(modelId: SapAiCoreModelId): never;
  transcriptionModel(modelId: SapAiCoreModelId): never;
  speechModel(modelId: SapAiCoreModelId): never;
  rerankingModel(modelId: SapAiCoreModelId): never;
  (modelId: SapAiCoreModelId): LanguageModelV3;
  chat(modelId: SapAiCoreModelId): LanguageModelV3;
}

export interface SapAiCoreProviderSettings {
  headers?: Record<string, string>;
  resourceGroup?: string;
  accessTokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
}

export function createSapAiCoreProvider(options: SapAiCoreProviderSettings = {}): SapAiCoreProvider {
  const resourceGroup = loadOptionalSetting({
    settingValue: options.resourceGroup,
    environmentVariableName: 'AICORE_RESOURCE_GROUP'
  });

  const accessTokenUrl = loadSetting({
    settingValue: options?.accessTokenUrl,
    environmentVariableName: 'AICORE_AUTH_URL',
    settingName: 'accessTokenUrl',
    description: 'SAP AI Core Access Token Base URL'
  });
  const clientId = loadSetting({
    settingValue: options?.clientId,
    environmentVariableName: 'AICORE_CLIENT_ID',
    settingName: 'clientId',
    description: 'SAP AI Core Client ID'
  });

  const clientSecret = loadSetting({
    settingValue: options?.clientSecret,
    environmentVariableName: 'AICORE_CLIENT_SECRET',
    settingName: 'clientSecret',
    description: 'SAP AI Core Client Secret'
  });

  const baseUrl = loadSetting({
    settingValue: options?.baseUrl,
    environmentVariableName: 'AICORE_BASE_URL',
    settingName: 'baseUrl',
    description: 'SAP AI Core Base URL'
  });

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'AI-Resource-Group': resourceGroup ?? 'default',
    ...options.headers
  });

  const sapAiCoreApiClient = new SapAiCoreApiClient({
    clientId,
    clientSecret,
    accessTokenUrl,
    baseUrl,
    resourceGroup
  });

  const createChatModel = (modelId: SapAiCoreModelId) => {
    const bareId = modelId.startsWith('sap-aicore/') ? modelId.replace('sap-aicore/', '') : modelId;
    const { fetch: modelFetch, interceptors } = fetchWithInterceptors();

    interceptors.request.use(async (req) => {
      const headers = new Headers(req.headers);
      headers.set('Authorization', `Bearer ${await sapAiCoreApiClient.getAccessToken()}`);
      return new Request(req, { headers });
    });

    interceptors.request.use(async (req) => {
      const deploymentUrl = await sapAiCoreApiClient.getDeploymentUrl(bareId);
      const u = new URL(req.url);
      return new Request(deploymentUrl.replace(/\/$/, '') + u.pathname + u.search, req);
    });

    return new OpenAICompatibleChatLanguageModel(bareId, {
      provider: 'sap-aicore.chat',
      url: ({ path }) => {
        const u = new URL(`${baseUrl}${path}`);
        u.searchParams.set('api-version', AZURE_OPENAI_API_VERSION);
        return u.toString();
      },
      headers: getHeaders,
      fetch: modelFetch,
      supportsStructuredOutputs: true,
      includeUsage: true
    });
  };

  const provider = function (modelId: SapAiCoreModelId) {
    if (new.target) {
      throw new Error('The SAP AI Core provider function cannot be called with the new keyword.');
    }

    if (!modelId.startsWith('sap-aicore/')) {
      throw new Error(`Invalid modelId: ${modelId}. Model IDs must start with 'sap-aicore/'.`);
    }

    return createChatModel(modelId);
  };

  provider.specificationVersion = 'v3' as const;
  provider.chat = createChatModel;

  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'languageModel',
      message: 'SAP AI Core does not provide language models'
    });
  };

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'embeddingModel',
      message: 'SAP AI Core does not provide embedding models'
    });
  };

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'imageModel',
      message: 'SAP AI Core does not provide image models'
    });
  };

  provider.transcriptionModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'transcriptionModel',
      message: 'SAP AI Core does not provide transcription models'
    });
  };

  provider.speechModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'speechModel',
      message: 'SAP AI Core does not provide speech models'
    });
  };

  provider.rerankingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: 'rerankingModel',
      message: 'SAP AI Core does not provide reranking models'
    });
  };

  return provider;
}
