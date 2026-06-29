// ---------------------------------------------------------------------------
// AI Configs chatbot (Extra credit: AI Configs).
//
// The model, model parameters, and system prompt are NOT hard-coded here.
// They are pulled at request time from a LaunchDarkly *AI Config* named by
// LD_AI_CONFIG_KEY (default "support-chatbot"). A product manager can change
// the model (e.g. Haiku -> Sonnet) or rewrite the prompt in the LaunchDarkly
// UI and it takes effect on the next request — no deploy required. AI Configs
// also support targeting and experiments, just like flags.
//
// We use the Anthropic SDK as the actual LLM provider. The LD AI SDK's tracker
// records latency, token usage, and success/error back to LaunchDarkly so the
// variations can be compared in an experiment.
// ---------------------------------------------------------------------------
import Anthropic from '@anthropic-ai/sdk';
import { initAi } from '@launchdarkly/server-sdk-ai';
import { getLdClient } from './ld.js';
import { config } from './env.js';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

let aiClient;
function getAiClient() {
  if (!aiClient) aiClient = initAi(getLdClient());
  return aiClient;
}

// Fallback used only if the AI Config can't be fetched (bad key / LD offline).
// This is intentionally conservative so the chatbot still works.
const DEFAULT_AI_CONFIG = {
  enabled: true,
  model: { name: 'claude-3-5-haiku-latest', parameters: { maxTokens: 1024, temperature: 0.7 } },
  messages: [
    {
      role: 'system',
      content:
        'You are a friendly, concise customer support assistant for ABC Company. ' +
        'Answer in 1-3 sentences. If you are unsure, say so and offer to escalate.',
    },
  ],
};

/**
 * Run one chat turn through the LaunchDarkly AI Config.
 * @param {object} context  LDContext describing the end user.
 * @param {Array<{role:string,content:string}>} history  Prior conversation turns.
 * @param {string} userMessage  The new user message.
 * @returns {Promise<{reply:string, meta:object}>}
 */
export async function chat(context, history, userMessage) {
  const ai = getAiClient();

  // Variables are interpolated into the configured prompt via Mustache, e.g. a
  // prompt can reference {{ companyName }}. Add any you want to template on.
  const variables = { companyName: 'ABC Company' };

  const aiConfig = await ai.config(config.aiConfigKey, context, DEFAULT_AI_CONFIG, variables);

  if (!aiConfig.enabled) {
    return {
      reply: "The assistant is currently turned off. Please try again later.",
      meta: { enabled: false },
    };
  }

  // The AI Config's messages hold the system prompt (+ optional few-shot turns).
  // Anthropic takes the system prompt separately from the message list.
  const configMessages = aiConfig.messages ?? [];
  const systemPrompt = configMessages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const seedMessages = configMessages.filter((m) => m.role !== 'system');

  const messages = [
    ...seedMessages,
    ...history,
    { role: 'user', content: userMessage },
  ].map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const modelName = aiConfig.model?.name ?? DEFAULT_AI_CONFIG.model.name;
  const params = aiConfig.model?.parameters ?? {};

  const tracker = aiConfig.tracker;
  const start = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
      system: systemPrompt || undefined,
      messages,
    });

    // Report metrics back to LaunchDarkly so variations are comparable.
    tracker?.trackDuration?.(Date.now() - start);
    if (response.usage) {
      tracker?.trackTokens?.({
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      });
    }
    tracker?.trackSuccess?.();

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      reply,
      meta: {
        model: modelName,
        // The variation key tells you which AI Config variation served this
        // response — useful when running an AI Config experiment.
        variationKey: aiConfig._ldMeta?.variationKey,
        usage: response.usage,
      },
    };
  } catch (err) {
    tracker?.trackError?.();
    throw err;
  }
}
