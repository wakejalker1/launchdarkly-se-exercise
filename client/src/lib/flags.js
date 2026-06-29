// Flag keys used across the app. These MUST match the keys created by the
// bootstrap script (scripts/bootstrap-launchdarkly.mjs) and in LaunchDarkly.
export const FLAGS = {
  // Part 1: Release & Remediate — gates a brand-new "Recommended for you" widget.
  RELEASE_RECOMMENDATIONS: 'release-recommendations',
  // Part 2 + Experimentation — gates the revamped landing hero (the component
  // "your team" owns). true = new hero (treatment), false = current hero (control).
  NEW_LANDING_HERO: 'new-landing-hero',
};
