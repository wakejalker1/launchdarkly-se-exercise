import { useFlags } from 'launchdarkly-react-client-sdk';
import { FLAGS } from '../lib/flags.js';

// Part 1: Release & Remediate
// A brand-new "Recommended for you" feature gated behind the boolean flag
// `release-recommendations`. useFlags() is backed by the streaming client SDK,
// so toggling the flag in LaunchDarkly (or via the remediation trigger) flips
// this UI instantly — no page reload.
export default function Part1Recommendations() {
  const flags = useFlags();
  const released = flags[FLAGS.RELEASE_RECOMMENDATIONS] ?? false;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          <span className="tag tag-part1">Part 1</span> Release &amp; Remediate
        </h2>
        <span className={`pill ${released ? 'pill-on' : 'pill-off'}`}>
          {released ? '● RELEASED' : '○ ROLLED BACK'}
        </span>
      </div>
      <p className="muted">
        New feature gated by flag <code>release-recommendations</code>. Toggle it
        in LaunchDarkly (or fire the remediation trigger) and watch this section
        switch with no page reload.
      </p>

      {released ? <RecommendationsWidget /> : <RolledBackNotice />}
    </section>
  );
}

function RecommendationsWidget() {
  const picks = [
    { emoji: '🚀', title: 'Velocity Analytics', desc: 'Spot deploy-frequency trends in one click.' },
    { emoji: '🛡️', title: 'Guarded Rollouts', desc: 'Auto-rollback on error-rate regressions.' },
    { emoji: '🔭', title: 'Release Insights', desc: 'See which cohorts adopted your last release.' },
  ];
  return (
    <div className="reco">
      <div className="reco-flash">✨ NEW · Recommended for you</div>
      <div className="reco-grid">
        {picks.map((p) => (
          <article key={p.title} className="reco-card">
            <div className="reco-emoji">{p.emoji}</div>
            <h3>{p.title}</h3>
            <p>{p.desc}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function RolledBackNotice() {
  return (
    <div className="rolled-back">
      <p>
        The recommendations feature is currently <strong>off</strong>. Customers
        see the stable experience. Flip <code>release-recommendations</code> on to
        release it instantly.
      </p>
    </div>
  );
}
