import { mkdirSync } from "node:fs";
mkdirSync(".local", { recursive: true });
process.env.DB_PATH ??= ".local/cosmos.db";
const portIndex = process.argv.indexOf("--port");
if (portIndex !== -1) process.env.PORT = process.argv[portIndex + 1];
await import("../src/server.ts");
