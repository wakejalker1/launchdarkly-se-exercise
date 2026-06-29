#!/usr/bin/env node
// ===========================================================================
// LaunchDarkly bootstrap script
// ---------------------------------------------------------------------------
// Creates EVERY LaunchDarkly resource this demo needs, using the REST API and
// a single management API token, so a reviewer can reproduce the whole setup
// with one command:
//
//     npm run bootstrap
//
// It is idempotent: re-running it skips resources that already exist.
//
// What it creates:
//   1. Project (LD_PROJECT_KEY) if missing — with default Production/Test envs.
//   2. Reads the env's client-side ID + server SDK key and writes them to .env.
//   3. Flag  `release-recommendations`  (Part 1: Release & Remediate).
//   4. Flag  `new-landing-hero`         (Part 2: Target + Experimentation).
//   5. Targeting on `new-landing-hero`  (individual + rule-based).
//   6. Metric `hero-cta-click`          (Experimentation).
//   7. Trigger on `release-recommendations` (Part 1 remediation) — prints URL.
//   8. AI Config `support-chatbot`      (best-effort; UI fallback documented).
//
// Requires in .env: LD_API_TOKEN, LD_PROJECT_KEY, LD_ENV_KEY.
// ===========================================================================
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');
dotenv.config({ path: ENV_PATH });

const TOKEN = process.env.LD_API_TOKEN;
const PROJECT = process.env.LD_PROJECT_KEY || 'se-exercise';
const ENV = process.env.LD_ENV_KEY || 'production';
const AI_CONFIG_KEY = 'support-chatbot';
const TAGS = ['se-exercise'];

const BASE = 'https://app.launchdarkly.com/api/v2';
const SEMANTIC_PATCH = 'application/json; domain-model=launchdarkly.semanticpatch';

if (!TOKEN) {
  console.error('✖ LD_API_TOKEN is missing. Copy .env.example to .env and add your token.');
  process.exit(1);
}

// --- tiny REST helper -------------------------------------------------------
async function ld(method, path, body, contentType = 'application/json') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': contentType },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, json };
}

const log = (...a) => console.log(...a);
const ok = (m) => log(`  \x1b[32m✓\x1b[0m ${m}`);
const skip = (m) => log(`  \x1b[90m•\x1b[0m ${m}`);
const warn = (m) => log(`  \x1b[33m!\x1b[0m ${m}`);

// --- 1. Project -------------------------------------------------------------
async function ensureProject() {
  log('\n1) Project');
  const existing = await ld('GET', `/projects/${PROJECT}`);
  if (existing.ok) {
    skip(`project "${PROJECT}" already exists`);
    return;
  }
  const created = await ld('POST', '/projects', {
    key: PROJECT,
    name: 'SE Exercise',
    tags: TAGS,
  });
  if (created.ok) ok(`created project "${PROJECT}" (with Production + Test envs)`);
  else fail('create project', created);
}

// --- 2. Read env keys -> .env ----------------------------------------------
async function readEnvKeys() {
  log('\n2) Environment keys');
  const res = await ld('GET', `/projects/${PROJECT}/environments/${ENV}`);
  if (!res.ok) fail(`read environment "${ENV}"`, res);
  const env = res.json;
  // In LaunchDarkly: the client-side ID is the environment's _id (PUBLIC), and
  // apiKey is the server-side SDK key (SECRET).
  const clientId = env._id;
  const sdkKey = env.apiKey;
  ok(`client-side ID: ${clientId}`);
  ok(`server SDK key:  ${mask(sdkKey)}`);
  updateEnvFile({ VITE_LD_CLIENT_ID: clientId, LD_SDK_KEY: sdkKey, LD_AI_CONFIG_KEY: AI_CONFIG_KEY });
  ok('wrote VITE_LD_CLIENT_ID, LD_SDK_KEY, LD_AI_CONFIG_KEY to .env');
}

// --- 3+4. Flags -------------------------------------------------------------
async function ensureFlag({ key, name, description }) {
  const existing = await ld('GET', `/flags/${PROJECT}/${key}`);
  if (existing.ok) {
    skip(`flag "${key}" already exists`);
    return existing.json;
  }
  const created = await ld('POST', `/flags/${PROJECT}`, {
    key,
    name,
    description,
    kind: 'boolean',
    // CRITICAL: make the flag available to the client-side (browser) SDK.
    clientSideAvailability: { usingEnvironmentId: true, usingMobileKey: false },
    defaults: { onVariation: 0, offVariation: 1 }, // 0 = true, 1 = false
    tags: TAGS,
  });
  if (!created.ok) fail(`create flag "${key}"`, created);
  ok(`created flag "${key}"`);
  return created.json;
}

// --- 5. Targeting on new-landing-hero --------------------------------------
async function configureHeroTargeting(flag) {
  log('\n5) Targeting on "new-landing-hero" (individual + rule-based)');
  const fresh = (await ld('GET', `/flags/${PROJECT}/new-landing-hero`)).json;
  const variations = fresh.variations; // [ {_id, value:true}, {_id, value:false} ]
  const trueId = variations.find((v) => v.value === true)._id;
  const falseId = variations.find((v) => v.value === false)._id;

  const envConfig = fresh.environments?.[ENV] ?? {};
  const alreadyConfigured =
    (envConfig.targets?.length ?? 0) > 0 || (envConfig.rules?.length ?? 0) > 0;
  if (alreadyConfigured) {
    skip('targeting already configured — leaving it as-is (idempotent)');
    return { trueId, falseId };
  }

  const instructions = [
    { kind: 'turnFlagOn' },
    // Individual targeting: Riya always gets the new hero (variation B / true).
    { kind: 'addTargets', contextKind: 'user', variationId: trueId, values: ['user-riya'] },
    // Rule-based targeting #1: any enterprise organization gets the new hero.
    {
      kind: 'addRule',
      variationId: trueId,
      description: 'Enterprise organizations get the new hero',
      clauses: [
        { contextKind: 'organization', attribute: 'plan', op: 'in', values: ['enterprise'], negate: false },
      ],
    },
    // Rule-based targeting #2: beta users get the new hero.
    {
      kind: 'addRule',
      variationId: trueId,
      description: 'Beta users get the new hero',
      clauses: [
        { contextKind: 'user', attribute: 'beta', op: 'in', values: [true], negate: false },
      ],
    },
    // Everyone else: control (variation A / false) by default fallthrough.
    { kind: 'updateFallthroughVariationOrRollout', variationId: falseId },
  ];

  const res = await ld(
    'PATCH',
    `/flags/${PROJECT}/new-landing-hero`,
    { environmentKey: ENV, instructions },
    SEMANTIC_PATCH
  );
  if (!res.ok) fail('configure hero targeting', res);
  ok('individual target (user-riya) + 2 rules + fallthrough set; flag turned ON');
  return { trueId, falseId };
}

// --- 6. Metric --------------------------------------------------------------
async function ensureMetric() {
  log('\n6) Metric "hero-cta-click"');
  const existing = await ld('GET', `/metrics/${PROJECT}/hero-cta-click`);
  if (existing.ok) {
    skip('metric "hero-cta-click" already exists');
    return;
  }
  const res = await ld('POST', `/metrics/${PROJECT}`, {
    key: 'hero-cta-click',
    name: 'Hero CTA click-through',
    description: 'Conversion: visitor clicked the hero call-to-action.',
    kind: 'custom',
    eventKey: 'hero-cta-click',
    isNumeric: false, // conversion / binary metric
    successCriteria: 'HigherThanBaseline',
    randomizationUnits: ['user'],
    tags: TAGS,
  });
  if (!res.ok) fail('create metric', res);
  ok('created conversion metric "hero-cta-click"');
}

// --- 7. Remediation trigger -------------------------------------------------
async function ensureTrigger() {
  log('\n7) Remediation trigger on "release-recommendations"');
  const existing = await ld(
    'GET',
    `/flags/${PROJECT}/release-recommendations/triggers/${ENV}`
  );
  if (existing.ok && Array.isArray(existing.json?.items) && existing.json.items.length > 0) {
    skip('a trigger already exists — open it in LD to view its URL');
    return;
  }
  const res = await ld(
    'POST',
    `/flags/${PROJECT}/release-recommendations/triggers/${ENV}`,
    { integrationKey: 'generic-trigger', instructions: [{ kind: 'turnFlagOff' }] }
  );
  if (!res.ok) {
    warn('could not create trigger automatically:');
    warn(JSON.stringify(res.json));
    return;
  }
  const url = res.json.triggerUrl;
  // The trigger URL is a SECRET (anyone with it can fire it). Save it to a
  // git-ignored file and print it.
  const file = resolve(ROOT, 'trigger-url.local.txt');
  writeFileSync(file, url + '\n');
  ok('created trigger (turns the flag OFF when fired)');
  log('\n  \x1b[1mRemediation trigger URL\x1b[0m (saved to trigger-url.local.txt):');
  log(`  \x1b[36m${url}\x1b[0m`);
  log('  Fire it to kill the feature instantly:');
  log(`  curl -X POST "${url}"\n`);
}

// --- 8. AI Config (best-effort) --------------------------------------------
async function ensureAiConfig() {
  log('\n8) AI Config "support-chatbot" (extra credit)');
  const existing = await ld('GET', `/projects/${PROJECT}/ai-configs/${AI_CONFIG_KEY}`);
  if (existing.ok) {
    skip('AI Config already exists');
    return;
  }
  const created = await ld('POST', `/projects/${PROJECT}/ai-configs`, {
    key: AI_CONFIG_KEY,
    name: 'Support chatbot',
    description: 'Model + prompt for the customer support assistant.',
    tags: TAGS,
  });
  if (!created.ok) {
    warn('AI Config API call failed (it may be plan-gated or beta).');
    warn('Create it in the LaunchDarkly UI instead — see README "AI Configs".');
    warn(`Detail: ${JSON.stringify(created.json)}`);
    return;
  }
  ok('created AI Config shell');

  const variation = await ld(
    'POST',
    `/projects/${PROJECT}/ai-configs/${AI_CONFIG_KEY}/variations`,
    {
      key: 'haiku-friendly',
      name: 'Haiku · friendly',
      model: { name: 'claude-3-5-haiku-latest', parameters: { maxTokens: 1024, temperature: 0.7 } },
      messages: [
        {
          role: 'system',
          content:
            'You are a friendly, concise customer support assistant for {{ companyName }}. ' +
            'Answer in 1-3 sentences. If unsure, say so and offer to escalate.',
        },
      ],
    }
  );
  if (variation.ok) ok('created AI Config variation "haiku-friendly"');
  else {
    warn('Created the AI Config but could not add a variation via API.');
    warn('Add a variation + targeting in the UI — see README. (SDK fallback still works.)');
    warn(`Detail: ${JSON.stringify(variation.json)}`);
  }
}

// --- helpers ----------------------------------------------------------------
function fail(what, res) {
  console.error(`\n✖ Failed to ${what} (HTTP ${res.status}):`);
  console.error(JSON.stringify(res.json, null, 2));
  process.exit(1);
}

function mask(s) {
  if (!s) return s;
  return s.slice(0, 8) + '…' + s.slice(-4);
}

// Merge keys into .env without clobbering other values or comments.
function updateEnvFile(updates) {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  for (const [k, v] of Object.entries(updates)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    if (re.test(content)) content = content.replace(re, line);
    else content += (content.endsWith('\n') || content === '' ? '' : '\n') + line + '\n';
  }
  writeFileSync(ENV_PATH, content);
}

// --- run --------------------------------------------------------------------
(async () => {
  log(`\x1b[1mBootstrapping LaunchDarkly\x1b[0m  project=${PROJECT}  env=${ENV}`);
  await ensureProject();
  await readEnvKeys();

  log('\n3) Flag "release-recommendations" (Part 1)');
  await ensureFlag({
    key: 'release-recommendations',
    name: 'Release: recommendations widget',
    description: 'Part 1 — gates the new "Recommended for you" feature.',
  });

  log('\n4) Flag "new-landing-hero" (Part 2 + Experimentation)');
  const hero = await ensureFlag({
    key: 'new-landing-hero',
    name: 'New landing hero',
    description: 'Part 2 — revamped hero; targeted + experimented.',
  });

  await configureHeroTargeting(hero);
  await ensureMetric();
  await ensureTrigger();
  await ensureAiConfig();

  log('\n\x1b[32m\x1b[1mDone.\x1b[0m Restart the dev server so Vite picks up the new .env values.');
  log('Next: `npm run dev`, then open http://localhost:5173\n');
  process.exit(0);
})();
