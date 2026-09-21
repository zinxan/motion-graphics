#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// stdout is the protocol; anything a person should see goes to stderr.
await createServer().connect(new StdioServerTransport());
console.error("zxn-motion MCP server ready.");
