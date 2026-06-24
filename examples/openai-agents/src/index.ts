import { aisdk } from '@openai/agents-extensions/ai-sdk';
import { sapAiCore } from '@ai-foundry/sap-aicore-provider';
import { Agent, run, setTracingDisabled } from '@openai/agents';

setTracingDisabled(true);

async function main() {
  // Make sure to set the following environment variables:
  // - AICORE_SERVICE_URL: SAP AI Core service URL
  // - AICORE_CLIENT_ID: OAuth client ID
  // - AICORE_CLIENT_SECRET: OAuth client secret
  // - AICORE_TOKEN_URL: OAuth token URL
  // - AICORE_RESOURCE_GROUP: Resource group (optional, defaults to 'default')

  const agent = new Agent({
    name: 'Assistant',
    instructions: 'You are a helpful assistant.',
    model: aisdk(sapAiCore('sap-aicore/gpt-4.1'))
  });

  const result = await run(agent, 'Explain how SAP AI Core helps enterprises adopt AI. List 3 key benefits.');

  console.log('Output:', result.finalOutput);
}

main().catch(console.error);
