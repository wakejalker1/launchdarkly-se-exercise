// Loads the single root-level .env so both client (Vite) and server share one
// source of truth for configuration. Imported first by index.js.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// .env lives at the repo root, one level above /server.
dotenv.config({ path: resolve(__dirname, '..', '.env') });

export const config = {
  port: Number(process.env.PORT) || 3001,
  ldSdkKey: process.env.LD_SDK_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  // AI Config key created by the bootstrap script (Part: AI Configs).
  aiConfigKey: process.env.LD_AI_CONFIG_KEY || 'support-chatbot',
};
