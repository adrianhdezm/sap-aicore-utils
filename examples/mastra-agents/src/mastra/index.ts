import { Mastra } from '@mastra/core';
import { InMemoryStore } from '@mastra/core/storage';
import { weatherAgent } from './agents/weather-agent.js';

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new InMemoryStore()
});
