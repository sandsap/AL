# Al Platform

The agentic voice-agent platform behind **Al** — the AI front-office employee for
home-services businesses. A customer calls; an AI agent answers, converses, and **books
the job into the contractor's CRM**. See `../ARCHITECTURE.md` for the full design and
`../BUSINESS_PLAN.md` for the business context.

> **Status: working foundation, not a launched product.** The core agent loop, booking
> engine, and CRM adapter interface are real and runnable today in mock mode. The
> real-time media path and cloud deploy are scaffolded with clearly marked TODOs. See
> **Launch runbook** below for exactly what only *you* can do to go live.

## Run the demo (no accounts, no keys)

```bash
cd al-platform
npm install
npm run demo
```

You'll see a simulated "no heat" HVAC call run end-to-end and print a booked job id. The
demo uses a **mock LLM** and **in-memory CRM**, so it needs no external services. Set
`ANTHROPIC_API_KEY` to run the same loop against real Claude instead of the mock.

Run the control API + owner dashboard:

```bash
npm run dev:api      # then open http://localhost:8080/  (owner dashboard)
                     #      http://localhost:8080/health
curl -X POST localhost:8080/tenants/t_demo/simulate-call \
  -H 'content-type: application/json' -d '{"text":"my furnace is out"}'
```

The dashboard shows revenue captured, jobs booked, booking rate, after-hours and
escalation counts, p95 latency, a recent-calls table, and per-call transcripts —
the ROI view that fights churn. It's served by the control API and seeded with
clearly-marked example data; production swaps the in-memory store for the
`calls`/`bookings` Postgres tables and ports the page to Next.js.

## What's real vs. scaffolded

| Piece | State |
|---|---|
| Agent orchestrator (tool-use loop, guardrails) | ✅ real, runnable |
| Deterministic booking engine (rules, idempotency) | ✅ real, runnable |
| Real-time voice loop (ASR→agent→TTS, barge-in) | ✅ real; keyless mocks + Deepgram/Cartesia |
| Media Gateway (Twilio Media Streams) | ✅ real loop; add /health route + TLS for prod |
| CRM adapters | ✅ mock + Housecall Pro (HTTP) + Jobber (GraphQL), endpoints flagged VERIFY; ServiceTitan TODO |
| LLM providers (mock + Claude) | ✅ real; two-tier fast/smart routing in the gateway |
| Control API (health, tenant, simulate, webhook) | ✅ real (in-memory store) |
| Owner dashboard (ROI tiles, calls, transcripts) | ✅ real, served by control API (example data); Next.js port TODO |
| Stripe billing + provisioning | ✅ real; webhook verifies signature and activates/suspends tenants |
| AWS Terraform (VPC, ALB, ECS, Aurora, Redis, IAM) | ✅ authored, not yet `validate`d; HTTPS/autoscaling TODO |

Run the voice loop end-to-end offline:

```bash
npm run demo:voice   # simulates a Twilio media stream through the full CallSession
```

## Layout

```
src/
  core/       types + tool definitions
  llm/        provider interface, mock provider, Claude provider
  booking/    scheduling adapter interface, mock CRM, booking engine
  agent/      orchestrator (the conversation + tool loop)
  billing/    Stripe subscriptions + metered usage + webhooks
  dashboard/  owner dashboard: call store + metrics + served page
  server/     control-api (Fastify) and media-gateway (Twilio WS)
  demo.ts     end-to-end offline simulation
infra/terraform/   AWS deployment skeleton
```

## Wiring real-time vendors

In `src/server/media-gateway.ts`, the `start`/`media`/`stop` handlers mark where to:
1. Open a **Deepgram** streaming ASR socket per call.
2. On each final transcript, call `orchestrator.handleUtterance()`.
3. Stream the agent's text to **Cartesia/ElevenLabs** TTS and send audio frames back to
   Twilio.
4. Implement **barge-in** (cancel TTS if the caller speaks) and emit a Stripe **meter
   event** on `stop`.

Add real CRM adapters under `src/booking/` implementing `SchedulingProvider`
(`HousecallProAdapter`, `ServiceTitanAdapter`, `JobberAdapter`).

## Make a real phone call

To hear Al on an actual phone number in ~30 minutes (Twilio + ngrok, no AWS),
follow **[`FIRST_LIVE_CALL.md`](./FIRST_LIVE_CALL.md)**. The gateway serves the
Twilio voice webhook (`/twiml/voice`) and the Media Stream (`/media`) on one
port, so a single tunnel is enough.

## Launch runbook (what only you can do)

Launching is **plug in your accounts + `terraform apply`** — but every item here requires
*your* credentials, money, or legal sign-off, so an AI can't and shouldn't do it for you:

1. **Company + compliance** — a registered business entity; TCPA/two-party-consent review
   for call recording; your AI-disclosure script per state.
2. **Accounts & keys** — AWS, Twilio (buy a number + business verification), Stripe (real
   bank/entity), Anthropic, Deepgram, Cartesia/ElevenLabs. Put keys in AWS Secrets Manager
   (mirror `.env.example`).
3. **Stripe products** — create Starter ($399) and Pro ($699) Prices + a usage meter; set
   `STRIPE_PRICE_*` and the webhook secret.
4. **Provision infra** — finish the TODOs in `infra/terraform/`, then
   `terraform init && terraform plan && terraform apply` in *your* AWS account. Review the
   plan and its cost first.
5. **Deploy** — build images, push to ECR, roll out the ECS services (CI stub in
   `.github/workflows/ci.yml`; add a deploy job).
6. **Connect telephony** — point your Twilio number's voice webhook at the deployed media
   gateway's public WSS URL.
7. **Onboard a design partner** — connect one real contractor's CRM via OAuth, load their
   hours/pricing, and run overflow/after-hours mode first (lowest risk) per the Phase 0
   plan in `../ARCHITECTURE.md`.

## Legal note

Build integrations only against APIs you're authorized to use, and sell only software you
build or properly license. Don't ship third-party code without a license that permits it.
