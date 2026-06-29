// ---------------------------------------------------------------------------
// Server-side LaunchDarkly client (singleton).
//
// The server SDK does a streaming connection to LaunchDarkly and keeps an
// in-memory copy of every flag, so evaluations are local and instant. We use
// it for:
//   - the AI Configs chatbot (server-evaluated AI Config),
//   - generating experiment traffic (scripts/generate-traffic.mjs),
//   - any server-authoritative flag checks.
//
// NOTE: LD_SDK_KEY is a SECRET (starts with "sdk-"). It must never be sent to
// the browser. The browser uses the public client-side ID instead.
// ---------------------------------------------------------------------------
import * as ld from '@launchdarkly/node-server-sdk';
import { config } from './env.js';

let client;

export function getLdClient() {
  if (client) return client;

  if (!config.ldSdkKey) {
    throw new Error(
      'LD_SDK_KEY is not set. Run `npm run bootstrap` to populate it, or copy ' +
        'it from LaunchDarkly > Account settings > Projects > (your env) > SDK key.'
    );
  }

  client = ld.init(config.ldSdkKey);
  return client;
}

// Resolves once the SDK has its initial flag data (or fails fast on a bad key).
export async function waitForLd() {
  const c = getLdClient();
  await c.waitForInitialization({ timeout: 10 });
  return c;
}
