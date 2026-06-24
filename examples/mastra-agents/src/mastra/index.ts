import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { weatherAgent } from './agents/weather-agent.js';

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({ id: 'mastra-storage', url: ':memory:' })
});
