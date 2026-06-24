import { createSapAiCoreProvider } from './sap-aicore-provider.js';

export type { SapAiCoreModelId, SapAiCoreProvider, SapAiCoreProviderSettings } from './sap-aicore-provider.js';
export { createSapAiCoreProvider };

export const sapAiCore = createSapAiCoreProvider();
