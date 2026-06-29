// ---------------------------------------------------------------------------
// Express backend for the LaunchDarkly SE exercise.
//
// Routes:
//   GET  /api/health  -> liveness + LD/Anthropic config sanity
//   POST /api/chat    -> AI Configs chatbot (Extra credit: AI Configs)
//
// The frontend (Vite dev server on :5173) proxies /api to this server.
// ---------------------------------------------------------------------------
import './env.js';
import express from 'express';
import cors from 'cors';
import { config } from './env.js';
import { waitForLd } from './ld.js';
import { chat } from './ai.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ldConfigured: Boolean(config.ldSdkKey),
    anthropicConfigured: Boolean(config.anthropicApiKey),
    aiConfigKey: config.aiConfigKey,
  });
});

// AI Configs chatbot. Body: { context, history, message }
//   context: an LDContext object describing the end user (see client)
//   history: prior [{ role: 'user'|'assistant', content }] turns
//   message: the new user message
app.post('/api/chat', async (req, res) => {
  try {
    if (!config.anthropicApiKey) {
      return res.status(503).json({
        error: 'ANTHROPIC_API_KEY is not set. Add it to .env to enable the chatbot.',
      });
    }
    const { context, history = [], message } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) is required' });
    }

    // Default to an anonymous user context if the client did not send one.
    const ldContext = context ?? { kind: 'user', key: 'anonymous', anonymous: true };

    const { reply, meta } = await chat(ldContext, history, message);
    res.json({ reply, meta });
  } catch (err) {
    console.error('[chat] error:', err);
    res.status(500).json({ error: err.message ?? 'chat failed' });
  }
});

async function start() {
  // Initialize LD eagerly so the first request is fast and we fail loudly on a
  // bad SDK key. If LD is not configured yet, we still boot (health will show it).
  if (config.ldSdkKey) {
    try {
      await waitForLd();
      console.log('[ld] server SDK initialized');
    } catch (err) {
      console.warn('[ld] failed to initialize:', err.message);
    }
  } else {
    console.warn('[ld] LD_SDK_KEY not set — run `npm run bootstrap` first.');
  }

  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });
}

start();
