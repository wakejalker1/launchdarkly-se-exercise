import { useState } from 'react';
import { useFlags, useLDClient } from 'launchdarkly-react-client-sdk';
import { FLAGS } from '../lib/flags.js';
import { METRICS } from '../lib/metrics.js';

// Part 2: Target  (+ Extra credit: Experimentation)
// The revamped landing hero is gated by `new-landing-hero`:
//   true  -> new hero (treatment / variation B)
//   false -> current hero (control / variation A)
// Which one a visitor sees is decided by LaunchDarkly targeting:
//   - individual targeting (Riya is targeted by user key)
//   - rule-based targeting (organization.plan == "enterprise", or user.beta)
//   - everyone else falls into the experiment's percentage rollout.
//
// The CTA click fires a metric event (hero-cta-click) that the experiment uses
// to measure which hero converts better.
export default function Part2Hero({ persona }) {
  const flags = useFlags();
  const ldClient = useLDClient();
  const treatment = flags[FLAGS.NEW_LANDING_HERO] ?? false;
  const [converted, setConverted] = useState(false);

  const handleCta = () => {
    // Track the conversion against the CURRENT context, so LaunchDarkly
    // attributes it to whichever experiment variation this user received.
    ldClient?.track(METRICS.CTA_CLICK, { persona: persona.id });
    ldClient?.flush?.();
    setConverted(true);
    setTimeout(() => setConverted(false), 2500);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <span className="tag tag-part2">Part 2</span> Target &amp; Experiment
        </h2>
        <span className={`pill ${treatment ? 'pill-b' : 'pill-a'}`}>
          {treatment ? 'Variation B · new hero' : 'Variation A · control'}
        </span>
      </div>

      {treatment ? (
        <div className="hero hero-new">
          <div className="hero-eyebrow">Ship faster. Break nothing.</div>
          <h1>Progressive delivery for teams who can't afford downtime.</h1>
          <p>
            Release to the right users, measure impact, and roll back in a click —
            all without redeploying.
          </p>
          <button className="cta cta-primary" onClick={handleCta}>
            Start free trial →
          </button>
        </div>
      ) : (
        <div className="hero hero-old">
          <h1>Welcome to ABC Company</h1>
          <p>The reliable SaaS platform your team already trusts.</p>
          <button className="cta cta-secondary" onClick={handleCta}>
            Sign up
          </button>
        </div>
      )}

      {converted && <div className="convert-toast">✓ Tracked “{METRICS.CTA_CLICK}”</div>}

      <p className="muted why">
        <strong>Why this variation?</strong> {explain(persona, treatment)}
      </p>
    </section>
  );
}

function explain(persona, treatment) {
  if (persona.id === 'riya') {
    return 'Riya is individually targeted by user key → always variation B.';
  }
  if (persona.context.kind === 'multi' && persona.context.organization?.plan === 'enterprise') {
    return 'Matches rule "organization.plan is enterprise" → variation B.';
  }
  if (persona.context.kind === 'multi' && persona.context.user?.beta === true) {
    return 'Matches rule "user.beta is true" → variation B.';
  }
  return treatment
    ? 'Not specifically targeted — landed in the experiment rollout bucket for B.'
    : 'Not targeted by any rule — receives the control (A), or the rollout bucket for A.';
}
