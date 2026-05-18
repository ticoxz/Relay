#!/usr/bin/env node
import { runRelayMcpServer } from './server';

runRelayMcpServer().catch((err) => {
  console.error('relay-mcp failed:', err);
  process.exit(1);
});
