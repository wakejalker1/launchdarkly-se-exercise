#!/usr/bin/env node
// ===========================================================================
// Experiment setup (Extra credit: Experimentation)
// ---------------------------------------------------------------------------
// Creates and STARTS an experiment on `new-landing-hero` measuring the
// `hero-cta-click` conversion metric, with a 50/50 split between control
// (variation A / false) and treatment (variation B / true).
//
// Run AFTER `npm run bootstrap` (which creates the flag + metric):
//     npm run experiment
//
// Then feed it data with:  npm run traffic 5000
// ===========================================================================
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const TOKEN = process.env.LD_API_TOKEN;
const PROJECT = process.env.LD_PROJECT_KEY || 'se-exercise';
const ENV = process.env.LD_ENV_KEY || 'production';
const BASE = 'https://app.launchdarkly.com/api/v2';
const EXPERIMENT_KEY = 'new-landing-hero-experiment';

if (!TOKEN) {
  console.error('✖ LD_API_TOKEN missing.');
  process.exit(1);
}

async function ld(method, path, body, contentType = 'application/json') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: TOKEN, 'Content-Type': contentType },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const skip = (m) => console.log(`  \x1b[90m•\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);

(async () => {
  console.log(`Setting up experiment on "new-landing-hero"  project=${PROJECT} env=${ENV}`);

  // Already exists?
  const existing = await ld('GET', `/projects/${PROJECT}/environments/${ENV}/experiments/${EXPERIMENT_KEY}`);
  if (existing.ok) {
    skip(`experiment "${EXPERIMENT_KEY}" already exists`);
    process.exit(0);
  }

  // Need the variation IDs of the flag.
  const flag = (await ld('GET', `/flags/${PROJECT}/new-landing-hero`)).json;
  const trueId = flag.variations.find((v) => v.value === true)._id;
  const falseId = flag.variations.find((v) => v.value === false)._id;

  // A maintainer member id is required; use the first account member.
  const members = await ld('GET', '/members?limit=1');
  const maintainerId = members.json?.items?.[0]?._id;
  if (!maintainerId) warn('no member id found; trying without maintainerId');

  const body = {
    name: 'New landing hero',
    key: EXPERIMENT_KEY,
    ...(maintainerId ? { maintainerId } : {}),
    iteration: {
      hypothesis: 'The new hero increases CTA click-through vs. the current hero.',
      canReshuffleTraffic: true,
      metrics: [{ key: 'hero-cta-click', isGroup: false, primary: true }],
      treatments: [
        {
          name: 'Control (current hero)',
          baseline: true,
          allocationPercent: '50',
          parameters: [{ flagKey: 'new-landing-hero', variationId: falseId }],
        },
        {
          name: 'Treatment (new hero)',
          baseline: false,
          allocationPercent: '50',
          parameters: [{ flagKey: 'new-landing-hero', variationId: trueId }],
        },
      ],
      // Declare the flag(s) this experiment controls. Treatment parameters
      // must reference a flagKey listed here.
      flags: { 'new-landing-hero': { ruleId: 'fallthrough' } },
      randomizationUnit: 'user',
    },
  };

  const created = await ld('POST', `/projects/${PROJECT}/environments/${ENV}/experiments`, body);
  if (!created.ok) {
    warn('Could not create the experiment via API (schema is strict / plan-gated).');
    warn('Create it in the UI instead — see README "Experimentation".');
    console.log(JSON.stringify(created.json, null, 2));
    process.exit(0); // non-fatal: the rest of the demo still works
  }
  ok(`created experiment "${EXPERIMENT_KEY}"`);

  // Start the first iteration so it begins collecting data.
  const started = await ld(
    'PATCH',
    `/projects/${PROJECT}/environments/${ENV}/experiments/${EXPERIMENT_KEY}`,
    { instructions: [{ kind: 'startIteration' }] },
    'application/json; domain-model=launchdarkly.semanticpatch'
  );
  if (started.ok) ok('started the experiment iteration — it is now recording');
  else {
    warn('Experiment created but could not auto-start; start it in the UI.');
    console.log(JSON.stringify(started.json, null, 2));
  }

  console.log('\nNext: generate traffic ->  npm run traffic 5000');
  process.exit(0);
})();
