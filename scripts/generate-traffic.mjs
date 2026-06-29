#!/usr/bin/env node
// ===========================================================================
// Experiment traffic generator (Extra credit: Experimentation)
// ---------------------------------------------------------------------------
// A live web app has ~40k visitors/day; we obviously can't wait for that here.
// This script simulates visitors so the experiment on `new-landing-hero` has
// data to analyze. For each synthetic visitor it:
//   1. evaluates `new-landing-hero` via the SERVER SDK (records an exposure),
//   2. probabilistically fires the `hero-cta-click` metric — with the new hero
//      (treatment) converting a bit better than control, so the experiment
//      shows a realistic, detectable lift.
//
// IMPORTANT: this only feeds an experiment if the experiment is RUNNING in
// LaunchDarkly (see README "Experimentation"). While it runs, LD allocates
// these fallthrough visitors across the variations for you.
//
// Usage:  node scripts/generate-traffic.mjs [count]   (default 2000)
// ===========================================================================
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as ld from '@launchdarkly/node-server-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const SDK_KEY = process.env.LD_SDK_KEY;
const COUNT = Number(process.argv[2]) || 2000;

if (!SDK_KEY) {
  console.error('✖ LD_SDK_KEY missing. Run `npm run bootstrap` first.');
  process.exit(1);
}

// Conversion rates: treatment (new hero) beats control. The simulated lift is
// what the experiment should detect.
const P_CONVERT = { treatment: 0.24, control: 0.16 };

const COUNTRIES = ['US', 'CA', 'GB', 'DE', 'JP', 'BR', 'IN', 'AU'];
const PLANS = ['free', 'pro']; // NOT enterprise — those are rule-targeted, not in the experiment.
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  // Experiments emit a full event per evaluation (not summarized), so raise the
  // event queue capacity well above our visitor count and flush in batches to
  // avoid dropping events.
  const client = ld.init(SDK_KEY, { capacity: 100000, flushInterval: 2 });
  await client.waitForInitialization({ timeout: 10 });
  console.log(`Simulating ${COUNT} visitors against "new-landing-hero"…`);

  let conversions = 0;
  for (let i = 0; i < COUNT; i++) {
    // A synthetic visitor that falls into the experiment's fallthrough audience
    // (free/pro org, non-beta user) so LD's experiment allocation applies.
    const context = {
      kind: 'multi',
      user: {
        key: `sim-user-${i}-${Math.floor(Math.random() * 1e6)}`,
        beta: false,
        country: rand(COUNTRIES),
      },
      organization: {
        key: `sim-org-${rand(PLANS)}-${Math.floor(Math.random() * 500)}`,
        plan: rand(PLANS),
        region: 'NA',
      },
    };

    // Evaluation records the exposure the experiment needs.
    const treatment = await client.variation('new-landing-hero', context, false);
    const p = treatment ? P_CONVERT.treatment : P_CONVERT.control;
    if (Math.random() < p) {
      client.track('hero-cta-click', context);
      conversions++;
    }

    // Flush periodically so the queue never fills up.
    if (i > 0 && i % 1000 === 0) {
      await client.flush();
    }
  }

  await client.flush();
  // Give the final flush time to reach LaunchDarkly before closing.
  await new Promise((r) => setTimeout(r, 1500));
  console.log(`Done. Fired ${conversions} "hero-cta-click" events (~${((conversions / COUNT) * 100).toFixed(1)}%).`);
  console.log('Open the experiment in LaunchDarkly to watch results populate.');
  await client.close();
  process.exit(0);
}

main();
