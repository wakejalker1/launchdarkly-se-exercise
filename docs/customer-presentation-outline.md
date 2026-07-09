# ABC Company Demo — Customer Presentation Outline

How to present each part of the exercise to a prospective customer: the value
narrative, the live demo beat in this app, public proof points, and the
objections you'll likely need to overcome.

> Proof points are drawn from LaunchDarkly's published customer stories
> (launchdarkly.com/customer-stories and /case-studies). Verify the current
> numbers before quoting them in a live deal.

---

## Opening frame (before Part 1)

**The tension every software team feels:** leadership wants features faster;
the business can't absorb the risk of a bad release. Historically you pick one —
speed *or* safety. LaunchDarkly's argument is that separating **deploy** from
**release** dissolves that trade-off: code ships continuously and dark, and a
business decision (not a deployment) turns it on — for the right people, at the
right time, with an instant undo.

Credibility anchor: LaunchDarkly serves **2+ trillion flag evaluations/day** and
is used by IBM, Atlassian, Microsoft, and CircleCI. This is proven at scale.

---

## Part 1 — Release & Remediate

**Sell to:** the engineering manager / VP Eng on the hook for both velocity and
uptime.

**Value statements**
- **Deploy ≠ release.** Ship code dark, turn it on as a business decision — no
  redeploy, no maintenance window.
- **The kill switch is instant.** When something breaks, roll back in seconds by
  flipping a flag — not by reverting, rebuilding, and redeploying.
- **Remediate without engineers in the loop.** A trigger (curl/webhook/alert)
  can disable a feature automatically, so on-call or even a monitoring tool can
  stop the bleeding at 2am.
- **MTTR collapses.** The blast radius of a bad change goes from "outage until
  the next deploy" to "seconds."

**Demo beat (this app)**
1. Feature starts rolled back. Toggle `release-recommendations` ON in LD → the
   widget appears live with a "⚡ flag changed" toast — **no page reload** (the
   `on('change')` listener).
2. "Now pretend QA finds a bug in prod." Fire the remediation trigger:
   `curl -X POST "$(cat trigger-url.local.txt)"` → feature vanishes instantly.
   That's the kill switch a monitoring alert could pull automatically.

**Expect this question: "How does the trigger work?"**
- **It's a secret webhook URL bound to one flag in one environment, with a
  preset action.** The bootstrap creates it via the API with
  `integrationKey: 'generic-trigger'` and `instructions: [{ kind: 'turnFlagOff' }]`
  (`scripts/bootstrap-launchdarkly.mjs`).
- **Firing it is just an HTTP `POST`** — no auth header, no body. The long
  random token in the URL path *is* the credential (a bearer secret).
- **What happens:** LD validates the token → executes the action (flips
  targeting off) → records it in the audit log → **streams the new state to
  every connected SDK**, so the browser updates with no reload — the *same*
  streaming path as a manual toggle.
- **Why it matters:** because it's a plain POST, anything that can make a web
  request — Datadog, PagerDuty, a health-check script, CI, or `curl` — can pull
  the kill switch automatically. That's the jump from "a human reverts a deploy"
  to "monitoring disables the feature in seconds."
- **Security / ops:** LD returns the working URL **only once at creation** (a
  later `GET` is masked), so the demo saves it to the git-ignored
  `trigger-url.local.txt`; delete-and-recreate is how you rotate a leaked URL.
  Treat it like a password. Purpose-built integration keys (`datadog`,
  `new-relic`, `dynatrace`, `honeycomb`) exist too, wired to those vendors'
  alert payloads instead of `generic-trigger`.

**Public proof points**
- **Ally Financial** — 97% reduction in overnight/weekend releases; 300% more
  production deployments.
- **Jackpocket** — 90% reduction in deploy incidents.
- **AlayaCare** — 50% reduction in MTTR.
- **Paramount** — 6–7 deployments/day. **Vodafone** — 220 releases/month.

**Likely objections → responses**
- *"We already do this with env vars / a homegrown flag table."* → No real-time
  streaming, no targeting, no audit trail, no UI for non-engineers, and it's
  yours to maintain forever. LaunchDarkly is that system, productized, governed,
  and evaluated in-SDK.
- *"Isn't LaunchDarkly now a single point of failure in my prod path?"* → SDKs
  evaluate **locally** and cache the last known ruleset; if LD is unreachable
  the app keeps serving last-known values (or your coded fallback). Add the
  Relay Proxy for a fully in-VPC control plane. 99.99% SLA.
- *"Feature flags create tech debt / flag sprawl."* → Flag lifecycle
  management, Code References (find every flag in the repo), stale-flag
  detection, and archiving are built in. Temporary flags are meant to be
  retired, and the platform helps you do it.
- *"A third party can change our production behavior — security risk."* →
  RBAC + approval workflows gate who can change what; every change is in the
  audit log. The server SDK key is secret; the client-side ID is public *by
  design* and exposes no secrets. SOC 2 / FedRAMP available.

---

## Part 2 — Target

**Sell to:** the developer/team lead shipping a high-traffic component
(40k visitors/day) who can't afford a blast-radius mistake.

**Value statements**
- **Test in production, safely.** Release to yourself, then your team, then 1%,
  then enterprise accounts — real production, controlled audience.
- **Individual + rule-based targeting.** Ship to a named user *or* to everyone
  matching attributes (plan = enterprise, region, beta opt-in) with no code
  change — just a rule.
- **Multi-context.** Target on the user *and* their organization/device/plan
  together — the way real B2B SaaS actually segments.
- **Progressive rollout = de-risked launch.** A bug hits 1% of a canary, not
  40k users.

**Demo beat (this app)**
- Use the "Viewing as" dropdown to switch personas — each is a **multi-context**
  (`user` + `organization`) and `identify()` re-evaluates every flag live.
  - **Riya** → individually targeted by `user.key` → always gets the new hero.
  - **Yuki** → matches the rule `organization.plan = enterprise` → new hero.
  - **Sam / Diego** → not targeted → control (or the experiment split).
- The Flag & Context Inspector shows exactly what the SDK evaluated and *why* —
  great for making "targeting" tangible.

**Expect this question: "How do real users get these attributes?"**
This is the #1 thing a technical audience asks, because the demo's persona
dropdown hides the real mechanism. The crisp answer:
- **The app supplies the identity — LaunchDarkly never detects anything.** Your
  code builds a *context* object (the user + attributes) and hands it to the SDK
  via `initialize()` / `identify()`. Rules evaluate against whatever you put in
  it. Attributes flow **app → SDK**, never the other way.
- **Real production flow:** on login you read the user from your
  auth/session/JWT and profile/billing systems, then build the context —
  `key` = user ID, plus `plan` (from billing), `country` (profile or geo-IP),
  `role`, `beta` (opt-in table). Anonymous visitors get a random cookie/localStorage
  key with `anonymous: true`, then get `identify()`'d into their real context on
  login.
- **LD only targets on attributes you send.** Nothing you don't put in the
  context is visible to LD; `private` attributes can be sent for evaluation but
  never stored.
- **In this demo** the attributes are hardcoded in
  `client/src/lib/personas.js` and chosen from the "Viewing as" dropdown — a
  stand-in so you can flip between made-up users without logging in and out. A
  real product has no persona switcher.

**Public proof points**
- **Savage X Fenty** — 15% improvement in site performance via controlled
  rollout of front-end changes.
- **Blue Cross of Idaho** — 75% reduction in customer-portal troubleshooting
  time.
- **Bayer Climate FieldView** — ~200ms real-time flag/targeting updates at
  scale.

**Likely objections → responses**
- *"At 40k/day, does evaluating flags add latency?"* → No network call per
  request — the SDK holds the ruleset in memory and evaluates locally in
  microseconds. Rule changes stream to the SDK; user requests never wait on LD.
- *"We'd be sending user PII to a vendor."* → Contexts can be anonymous, and
  **private attributes** let you target on values that are never sent to or
  stored by LaunchDarkly. Evaluation is local, so attributes can stay in your
  app entirely.
- *"Our segmentation is complex and lives in our warehouse."* → Segments +
  Big Segments + syncing (e.g. from your data warehouse / CDP) cover
  large, externally-defined audiences; rules compose AND/OR conditions.
- *"Who owns targeting changes — and how do we stop a mistake?"* → No-code UI
  so PMs/ops can target without a deploy, but RBAC + approvals + audit keep it
  governed. A wrong rule is one click to revert.

---

## Extra Credit — Experimentation

**Sell to:** the product manager who needs to prove impact with data, not
opinion.

**Value statements**
- **The flag *is* the experiment.** No second SDK, no duplicate
  instrumentation — the same flag you use to release is the one you measure.
- **Connect releases to business metrics.** Tie a variation directly to
  conversion, revenue, retention, latency — not just "did it error."
- **PM self-service.** Product sets up and reads experiments without pulling
  engineers onto every test.
- **Ship the winner instantly.** The experiment and the rollout are the same
  system — when B wins, roll it to 100% with the flag you already have.

**Demo beat (this app)**
- `npm run experiment` builds a 50/50 control-vs-treatment experiment on the
  `new-landing-hero` flag with the `hero-cta-click` metric.
- `npm run traffic 5000` generates visitors; treatment converts slightly better,
  so LD shows a realistic, detectable lift. Clicking the real hero CTA also
  fires `track('hero-cta-click')`, so live users contribute too.
- Watch results populate under **Experiments → New landing hero**.

**Public proof points**
- **SmugMug** — PMs run A/B tests on trial offers and site design **without
  engineers writing code**, improving free-trial-to-paid conversion.
- **Gamma** — 20% lift in paid subscriptions through experimentation.

**Likely objections → responses**
- *"We already use Optimizely / Statsig / GA."* → Those are separate systems
  bolted onto your release process. Here the experiment runs on the flag you
  already ship with — one platform for release, targeting, and measurement,
  no redundant instrumentation or SDK.
- *"How much traffic / how long to reach significance?"* → With 40k/day you
  reach power fast. LD's engine supports sequential testing (peek safely) and a
  sample-size calculator; CUPED reduces variance to shorten runtime.
- *"Can I trust the statistics?"* → Transparent methodology, guardrail metrics
  to catch regressions, and the ability to define primary vs. secondary metrics
  so you don't cherry-pick.
- *"Experimentation is a data-science project we can't staff."* → The point is
  the opposite: PMs self-serve (SmugMug), and the stats engine does the heavy
  lifting.

---

## Extra Credit — AI Configs

**Sell to:** the AI/product owner iterating on prompts and models in a live
GenAI feature.

**Value statements**
- **Prompt & model as runtime config, not code.** Change the model (Haiku →
  Sonnet), the prompt, or temperature with **no redeploy** — the next request
  uses it.
- **Target and roll out AI like any feature.** Give enterprise users a premium
  model, free tier a cheaper one; canary a new prompt to 5% first.
- **Experiment on prompts/models.** Run the same experimentation engine against
  AI variants using latency, token cost, or user-feedback metrics.
- **Instant rollback for AI misbehavior.** A prompt regression or a runaway
  model is a flag flip away from being pulled — no deploy.

**Demo beat (this app)**
- Open the 💬 chatbot. The server (`server/ai.js`) does **not** hard-code the
  model or prompt — it reads the `support-chatbot` AI Config at request time,
  and the panel shows which model answered.
- In LD, swap the model or edit the prompt → the next message reflects it, no
  restart. (Chatbot is optional; needs an Anthropic key.)

**Public proof points**
- **Dior** — shortened time-to-market for AI changes from ~15 minutes to
  instant runtime updates.
- **Hireology** — programmatically tests prompt/model variants at speed
  ("3 verticals, 10 tests each in <13 seconds") to ship AI features safely.

**Likely objections → responses**
- *"We can just keep prompts in a file / change them in code."* → Then every
  tweak is a deploy, there's no per-user targeting, no experiment, no rollback,
  and no audit of who changed the model. AI Configs makes prompt+model+params a
  governed, targetable, measurable runtime object.
- *"How do we control LLM cost?"* → Route models by user tier, cap who gets the
  expensive model, and track token usage/latency per variation — then kill or
  downgrade a costly config instantly.
- *"How is this different from LangSmith / PromptLayer / a prompt-management
  tool?"* → It's the *same* platform as your flags, targeting, and
  experiments — model, prompt, and parameters controlled and measured together,
  in production, with the governance you already use for releases.
- *"Who's allowed to change what our AI says?"* → RBAC + approvals + audit log,
  same as every other flag change. Governance isn't an afterthought.

---

## Optional — Integrations (if it comes up)

**Value:** LaunchDarkly meets your existing workflow — Slack/Teams
notifications, Jira, Datadog/observability, Terraform (flags as code),
ServiceNow, and triggers/webhooks (as used in Part 1's remediation).

**Objection:** *"Yet another tool to wire into our stack."* → It's designed to
plug into what you already run: manage flags in Terraform, get change alerts in
Slack, correlate flag changes with spikes in Datadog, and drive remediation from
your alerting — so LaunchDarkly reduces context-switching rather than adding it.

---

## Closing

Tie it back to the opening tension: the customer no longer chooses between speed
and safety. Deploy continuously and dark (Part 1), release to the right audience
(Part 2), prove the impact (Experimentation), and now govern AI the same way
(AI Configs) — all on one platform, with an instant undo at every step.
