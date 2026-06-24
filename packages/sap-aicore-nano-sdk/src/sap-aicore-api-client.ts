export interface SapAiCoreParams {
  clientId: string;
  clientSecret: string;
  accessTokenUrl: string;
  baseUrl: string;
  resourceGroup?: string;
}

export class SapAiCoreApiClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accessTokenUrl: string;
  private readonly baseUrl: string;
  private resourceGroup: string = 'default';
  private accessToken: string | null = null;
  private expiresAt: number | null = null;

  private readonly scenarioId = 'foundation-models';

  private deploymentUrlCache: Map<string, string> = new Map();

  get defaultHeaders() {
    return {
      'Content-Type': 'application/json',
      'AI-Resource-Group': this.resourceGroup
    };
  }

  constructor({ clientId, clientSecret, accessTokenUrl, baseUrl, resourceGroup }: SapAiCoreParams) {
    if (resourceGroup) {
      this.resourceGroup = resourceGroup;
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessTokenUrl = `${accessTokenUrl}/oauth/token?grant_type=client_credentials`;
    this.baseUrl = `${baseUrl}/v2`;
  }

  getAccessToken = async (): Promise<string> => {
    // Check if the access token is already available and not expired
    if (this.accessToken && this.expiresAt && this.expiresAt > Date.now()) {
      return this.accessToken;
    }

    // If the access token is expired or not available, fetch a new one
    const response = await fetch(this.accessTokenUrl, {
      method: 'GET',
      headers: { Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}` }
    });

    if (!response.ok) {
      throw new Error(`Token fetch failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { access_token: string };
    const accessToken = data.access_token;

    // Decode JWT to get expiration time from the 'exp' claim
    const payloadBase64 = accessToken.split('.')[1];
    if (!payloadBase64) {
      throw new Error('Invalid JWT token: missing payload');
    }

    const payload = JSON.parse(atob(payloadBase64)) as { exp: number };
    this.accessToken = accessToken;
    this.expiresAt = payload.exp * 1000;

    return accessToken;
  };

  async getDeploymentUrl(modelId: string): Promise<string> {
    // Check cache first
    if (this.deploymentUrlCache.has(modelId)) {
      return this.deploymentUrlCache.get(modelId) as string;
    }
    const accessToken = await this.getAccessToken();
    const urlObj = new URL(`${this.baseUrl}/lm/deployments`);
    urlObj.searchParams.set('scenarioId', this.scenarioId);
    urlObj.searchParams.set('status', 'RUNNING');
    const url = urlObj.toString();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...this.defaultHeaders,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Deployment Url fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      resources: Array<{ details?: { resources?: { backendDetails: { model: { name: string } } } }; deploymentUrl?: string }>;
    };
    const deployments = data.resources;
    const deployment = deployments.find((d) => d.details?.resources?.backendDetails.model.name === modelId);
    if (!deployment || !deployment.deploymentUrl) {
      throw new Error(`No running deployment found for model: ${modelId}`);
    }

    // Cache the result
    this.deploymentUrlCache.set(modelId, deployment.deploymentUrl);
    return deployment.deploymentUrl;
  }
}
