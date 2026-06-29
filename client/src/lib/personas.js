// ---------------------------------------------------------------------------
// Demo personas (LaunchDarkly multi-contexts).
//
// Each persona is a *multi-context* combining a `user` context and an
// `organization` context. We target on attributes from BOTH kinds:
//   - individual targeting  -> by user.key (e.g. Riya)
//   - rule-based targeting   -> by organization.plan == "enterprise"
//                               or user.beta == true
//
// Switching personas in the UI calls ldClient.identify(context), which causes
// every flag to re-evaluate instantly for the newly selected user — a live,
// no-reload demonstration of targeting.
// ---------------------------------------------------------------------------

/** @typedef {{ id:string, label:string, blurb:string, context:object }} Persona */

/** @type {Persona[]} */
export const PERSONAS = [
  {
    id: 'anonymous',
    label: 'Anonymous visitor',
    blurb: 'Not logged in. Sees the control experience unless a rollout includes them.',
    context: {
      kind: 'user',
      key: 'anon-visitor',
      anonymous: true,
    },
  },
  {
    id: 'sam',
    label: 'Sam — Free plan (US)',
    blurb: 'Free-tier member. Control experience; eligible for the experiment rollout.',
    context: {
      kind: 'multi',
      user: {
        key: 'user-sam',
        name: 'Sam Rivera',
        email: 'sam@personal.example',
        role: 'member',
        beta: false,
        country: 'US',
      },
      organization: {
        key: 'org-acme',
        name: 'Acme Personal',
        plan: 'free',
        region: 'NA',
      },
    },
  },
  {
    id: 'riya',
    label: 'Riya — Enterprise admin, beta (★ individually targeted)',
    blurb: 'Individually targeted by user key to always get the new hero.',
    context: {
      kind: 'multi',
      user: {
        key: 'user-riya',
        name: 'Riya Kapoor',
        email: 'riya@bigcorp.example',
        role: 'admin',
        beta: true,
        country: 'US',
      },
      organization: {
        key: 'org-bigcorp',
        name: 'BigCorp Inc.',
        plan: 'enterprise',
        region: 'NA',
      },
    },
  },
  {
    id: 'diego',
    label: 'Diego — Pro plan (CA)',
    blurb: 'Pro-tier member. Control experience; eligible for the experiment rollout.',
    context: {
      kind: 'multi',
      user: {
        key: 'user-diego',
        name: 'Diego Santos',
        email: 'diego@studio.example',
        role: 'member',
        beta: false,
        country: 'CA',
      },
      organization: {
        key: 'org-studio',
        name: 'Studio Labs',
        plan: 'pro',
        region: 'NA',
      },
    },
  },
  {
    id: 'yuki',
    label: 'Yuki — Enterprise member (APAC, rule match)',
    blurb: 'Matches the "organization plan is enterprise" rule → gets the new hero.',
    context: {
      kind: 'multi',
      user: {
        key: 'user-yuki',
        name: 'Yuki Tanaka',
        email: 'yuki@globex.example',
        role: 'member',
        beta: false,
        country: 'JP',
      },
      organization: {
        key: 'org-globex',
        name: 'Globex KK',
        plan: 'enterprise',
        region: 'APAC',
      },
    },
  },
];

export const DEFAULT_PERSONA_ID = 'sam';

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}
