# Al — Platform Architecture & Build Plan

**The agentic AI platform behind Al, the AI front-office employee for home-services businesses.**

*Companion to `BUSINESS_PLAN.md`. Engineering blueprint for a real-time voice agent that answers calls and books jobs. Prepared 2026.*

---

## 0. What we're building (in one paragraph)

A **multi-tenant, real-time voice-agent platform**. A customer calls a contractor's
number; the call is answered in under a second by an AI agent that listens, reasons,
and **books the job into the contractor's field-service software** — then hands true
emergencies to on-call staff. The hard parts are (1) a **sub-800ms conversational loop**,
(2) a **deterministic booking engine** the agent drives through tools, and (3) **deep
CRM integrations**. Everything runs on AWS, billing runs through Stripe, and every call
feeds a **data flywheel** that fine-tunes our vertical models.

**Non-negotiable design principle:** the LLM *reasons and converses*; it never *decides*
a booking on its own. Writes to a customer's calendar go through a deterministic engine
that validates availability and business rules. This keeps the product trustworthy and
auditable.

---

## 1. System overview

Two planes:

- **Real-time plane (the call path)** — latency-critical, stateful, always-on. Handles
  live audio: telephony ↔ ASR ↔ agent orchestrator ↔ tools ↔ TTS.
- **Control plane** — tenant onboarding/config, integrations, billing, dashboard,
  analytics, and the offline data/ML pipeline. Not latency-critical.

```
                       ┌───────────────────────── CONTROL PLANE ─────────────────────────┐
                       │  Dashboard (Next.js)   Onboarding   Billing (Stripe)   Analytics │
                       │            │                │             │               │      │
                       │        Control API (TypeScript / Fastify)  ───────────────┘      │
                       └───────┬─────────────────────┬───────────────────────┬────────────┘
                               │ tenant config        │ CRM OAuth              │ usage events
   Caller ── PSTN ── Twilio ── ▼ ── Media Gateway ── ASR (Deepgram) ── Agent Orchestrator ⇄ Tools
   (phone)         (Media      (WSS audio,           (streaming        (Claude, tool-use)   │
                    Streams)    barge-in/VAD)          partials)              │             │
                                     ▲                                        ▼             │
                                     └──────────── TTS (Cartesia) ◄─── response  Booking Engine (deterministic)
                                                                                 │  CRM Adapters (ServiceTitan / HCP / Jobber)
                                                                                 │  Knowledge base (RAG, pgvector)
                                                                                 └─ Escalation / human handoff

   Data: Postgres (Aurora) · Redis (session/call state) · S3 (recordings, transcripts) · pgvector (KB)
```

---

## 2. The real-time call path (latency budget)

The whole product lives or dies on conversational latency. Target: **< 800ms** from
end-of-user-speech to start-of-agent-audio (natural human turn-taking is ~200–500ms; we
aim to feel human).

| Stage | Tech | Budget |
|---|---|---|
| Telephony media in | Twilio Media Streams (μ-law 8kHz over WSS) | streaming |
| Speech-to-text | Deepgram streaming (interim + final) | ~150–300ms to final |
| Endpointing / VAD / barge-in | Media Gateway logic | ~50–150ms |
| Agent reasoning (first token) | Claude, streaming, tool-use | ~300–500ms |
| Text-to-speech (first byte) | Cartesia / ElevenLabs streaming | ~100–250ms |
| **Total perceived** | | **~700–900ms** |

**How we hit it:**
- **Stream everything** — never wait for a full transcript or full LLM response. Start
  TTS on the first sentence chunk.
- **Two-tier model routing** — a fast, cheap model handles simple turns (greetings,
  confirmations, capturing an address); escalate to a larger model only for genuine
  reasoning. Cuts both latency and cost.
- **Barge-in** — if the caller talks over the agent, cancel TTS immediately and re-listen.
- **Speculative prefetch** — begin availability lookups as soon as intent is clear, before
  the caller finishes.
- **Co-locate** all real-time services in one AWS region/AZ to kill network hops.

---

## 3. Components

### 3.1 Media Gateway  *(real-time plane)*
Long-lived WebSocket service that terminates Twilio Media Streams, buffers/forwards audio
to ASR, plays TTS back, and runs turn-taking (VAD, endpointing, barge-in). **Stateful and
connection-heavy → runs on containers (ECS Fargate), never Lambda.** One instance handles
many concurrent calls; scale horizontally on concurrent-call count.

### 3.2 Agent Orchestrator  *(the "brain")*
Drives the conversation loop: maintains dialog state, calls the LLM with the tenant's
system prompt + tools, executes tool calls, and enforces a **guardrail/policy layer**
(no bookings outside business rules, mandatory AI disclosure, escalation triggers). Tools
exposed to the agent:

- `get_availability(job_type, window)` → reads live CRM calendar
- `book_job(...)` → **calls the Booking Engine** (never writes CRM directly)
- `lookup_customer(phone)` → prior history/memory
- `search_knowledge(query)` → RAG over the tenant's pricing/FAQ/policies
- `escalate(reason)` → warm transfer / on-call dispatch
- `send_followup(...)` → SMS confirmation / quote follow-up

### 3.3 Booking Engine  *(deterministic, the trust boundary)*
Pure business logic. Validates the agent's proposed booking against real availability,
job-type rules, service area, and tech skills; writes to the CRM **idempotently** (dedupe
keys prevent double-booking on retries); returns a confirmed slot or a rejection the agent
must work around. This is what makes the system safe to put on the primary line.

### 3.4 CRM Adapters  *(integration layer)*
An adapter per platform behind one `SchedulingProvider` interface
(`ServiceTitanAdapter`, `HousecallProAdapter`, `JobberAdapter`). OAuth per tenant,
token refresh, rate-limit handling, and webhook ingestion for two-way sync. Adding a
new CRM = one new adapter, no changes to the agent or booking engine.

### 3.5 Control API + Dashboard  *(control plane)*
Tenant config, phone-number provisioning, prompt/knowledge management, integration OAuth,
Stripe billing, and the owner dashboard (calls, transcripts, **jobs booked & revenue
captured**). Next.js dashboard on a Fastify/TypeScript API.

### 3.6 Data & ML pipeline  *(offline)*
Every call → transcript + outcome labels (booked/not, job type, value) landed in S3 and
Postgres. Powers analytics, the dashboard ROI numbers, eval harness (booking-rate
regression tests), and the **fine-tuning flywheel** for vertical models. Python here;
everything online stays TypeScript.

---

## 4. Tech stack (recommended, seed-lean)

| Layer | Choice | Why |
|---|---|---|
| Real-time services | **TypeScript / Node** | Best streaming/WebSocket story; one language online |
| Control API | TypeScript / **Fastify** | Shared types with dashboard, fast |
| Dashboard | **Next.js** + Tailwind | Fast to build, hostable on Vercel or AWS |
| Telephony | **Twilio** Programmable Voice + Media Streams | Mature, Media Streams for low-latency audio |
| ASR | **Deepgram** (streaming) | Low latency, strong telephony models |
| LLM | **Claude** (Anthropic API) | Strong tool-use/reasoning; stream + route by turn |
| TTS | **Cartesia** / ElevenLabs | Low-latency, natural streaming voices |
| DB | **Postgres** (Aurora Serverless v2) + **pgvector** | One store for relational + RAG at seed scale |
| Cache / state | **Redis** (ElastiCache) | Live call/session state, rate limits |
| Object store | **S3** | Recordings, transcripts, audio |
| Billing | **Stripe** Billing + metered usage | Subscriptions + usage; PCI burden stays SAQ-A |
| ML / data | **Python** (offline only) | Fine-tuning, evals, analytics |

*Single online language (TS) keeps a small team fast; Python is quarantined to the offline
pipeline where its ecosystem earns its place.*

---

## 5. AWS deployment architecture

Infrastructure-as-code in **Terraform** (or AWS CDK). One production account/region to
start (add a second region only when latency or resiliency demands it).

- **Compute** — **ECS Fargate** for all services (Media Gateway *must* be containers for
  long-lived WS; keep the control API alongside it). EKS only if/when scale justifies it.
- **Networking** — VPC with public/private subnets; **ALB** (WSS) fronting the Media
  Gateway and Control API; NAT for egress; Twilio reaches us over public WSS with signed
  requests.
- **Data** — **Aurora Serverless v2 Postgres** (scales to load, cheap at seed), **ElastiCache
  Redis**, **S3** with lifecycle rules for recordings.
- **Secrets & crypto** — **Secrets Manager** for API keys/OAuth tokens; **KMS** for
  encryption at rest everywhere; TLS in transit everywhere.
- **Observability** — OpenTelemetry → **CloudWatch** + traces; per-call latency dashboards
  and alerting (the p95 conversational latency is our top SLO).
- **CI/CD** — GitHub Actions → build → **ECR** → ECS rolling deploy. Preview envs per PR.
- **Cost control** — Fargate right-sized on concurrent calls; Aurora Serverless scales
  down off-peak; S3 lifecycle to Glacier for old recordings.

**Why not Lambda for the call path?** Live media is a persistent bidirectional stream for
the call's duration — that's the opposite of Lambda's short-request model. Lambda is fine
for control-plane webhooks (Stripe, CRM sync) and cron jobs.

---

## 6. Multi-tenancy & data model

Single database, **tenant-scoped rows** (a `tenant_id` on every table + row-level
enforcement in the data layer). Simpler than DB-per-tenant and fine to low-thousands of
tenants; revisit sharding later. Core tables:

`tenants` · `users` · `phone_numbers` · `integrations` (CRM OAuth, encrypted) ·
`agent_configs` (prompt, voice, hours, business rules) · `knowledge_docs` (+ `embeddings`
via pgvector) · `calls` (recording S3 key, transcript, latency metrics) ·
`bookings` (outcome, job type, value, CRM id) · `subscriptions` / `usage_events` (Stripe).

Tenant isolation is a **security boundary**, not just a filter — enforced centrally so a
query can't cross tenants.

---

## 7. Billing (Stripe) architecture

- **Model** — Stripe **Products/Prices** for Starter ($399/mo) and Pro ($699/mo);
  **metered usage** for minutes/calls above the bundle via Stripe **Meter** events emitted
  from the Media Gateway on call end.
- **Signup** — Stripe **Checkout** (hosted) for subscription start; **Customer Portal**
  for self-serve plan changes and payment methods.
- **Provisioning** — Stripe **webhooks** (`checkout.session.completed`, `invoice.paid`,
  `customer.subscription.updated/deleted`) drive tenant activation/suspension. Webhook
  handler verifies signatures and is idempotent.
- **PCI** — card data never touches our servers (Stripe-hosted fields) → we stay at
  **SAQ-A**, the lightest compliance tier. This is the whole reason to use Stripe hosted.

---

## 8. Security & compliance

| Area | Approach |
|---|---|
| **Call recording / consent (TCPA)** | AI disclosure at call start; per-state two-party-consent config; consent captured before recording where required |
| **Encryption** | KMS at rest (DB, S3, Redis); TLS 1.2+ in transit everywhere |
| **Secrets** | Secrets Manager; no secrets in code or env files; least-privilege IAM |
| **Tenant isolation** | Centrally enforced `tenant_id` scoping; audited data-access layer |
| **PII** | Minimize captured PII; retention policy on recordings/transcripts; deletion on request |
| **Payments** | Stripe hosted → PCI SAQ-A |
| **Enterprise readiness** | SOC 2 Type II track once selling to franchises / PE roll-ups |
| **AI safety** | Guardrail layer, mandatory human handoff, no autonomous bookings, full transcript audit trail |

---

## 9. Agent quality & the data flywheel

- **Eval harness** — a labeled set of real call scenarios; booking-rate is a regression
  gate on every prompt/model change. No prompt ships that lowers booking rate.
- **Guardrails** — the agent cannot book outside business rules, must disclose it's AI,
  and escalates on defined triggers (anger, true emergency, out-of-scope request).
- **Flywheel** — labeled call outcomes fine-tune a **vertical voice model** that beats
  horizontal baselines on trade-specific conversations. More tenants → more labeled calls
  → higher booking rate → lower churn. This is the moat from the business plan, made
  concrete.

---

## 10. Unit-cost model (ties to the business plan)

Per-call COGS early (a typical ~3-minute call):

| Item | Approx cost |
|---|---|
| Telephony (Twilio inbound + Media Streams) | ~$0.04–0.06 |
| ASR (Deepgram streaming) | ~$0.01–0.02 |
| LLM (Claude, streamed, routed) | ~$0.05–0.20 |
| TTS (Cartesia / ElevenLabs) | ~$0.03–0.08 |
| **Total per call** | **~$0.15–0.35** |

At Pro ($699/mo) with a few hundred calls/month, that lands the **~50% early → 70%+
gross margin** the business plan assumes — and improves as inference and TTS costs fall
and model routing tightens.

---

## 11. Build roadmap

### Phase 0 — MVP (Weeks 0–6)
Prove the loop end-to-end for **one design-partner contractor**.
- Twilio → Media Gateway → Deepgram → Claude → Cartesia, streaming, with barge-in.
- **One** CRM integration (Housecall Pro), one job type, deterministic booking engine.
- Overflow / after-hours mode only (lowest risk).
- Minimal dashboard: live transcripts + booked-jobs count. Manual onboarding.
- **Exit:** a real call books a real job in a real contractor's calendar.

### Phase 1 — Sellable product (Weeks 6–16)
- Multi-tenant + self-serve config (hours, prompt, business rules, phone provisioning).
- **Second** CRM integration (ServiceTitan or Jobber).
- **Stripe billing** live (subscriptions + metered usage) with webhook provisioning.
- Recording + per-state consent; observability + latency SLOs; eval harness.
- **Exit:** a contractor can sign up, connect their CRM, and pay — with no founder in the loop.

### Phase 2 — Scale & moat (Months 4–9)
- Outbound follow-up (no-shows, stale quotes) and 24/7 primary-line mode.
- **Third** integration; RAG knowledge base per tenant; multi-location/franchise tier.
- **v1 fine-tuned vertical model**; SOC 2 kickoff; infra hardening for concurrency.
- **Exit:** repeatable GTM + metrics that support the Series A (~$3–5M ARR path).

---

## 12. Team & sequencing

Matches the seed hiring plan in the business plan:

- **Founding voice/real-time engineer** — Media Gateway, latency, telephony.
- **Integrations engineer** — CRM adapters + booking engine.
- **Full-stack** — control plane, dashboard, Stripe.
- **(Later) ML engineer** — evals + fine-tuning flywheel.

Two strong engineers can deliver Phase 0–1; the platform is deliberately boring where it
can be (one language online, one database, managed services) so the team spends its
scarce time on the two things that are actually hard: **conversational latency** and the
**booking-engine + integration correctness**.

---

## 13. Key risks (engineering)

| Risk | Mitigation |
|---|---|
| Latency creeps over ~1s and calls feel robotic | p95 latency as top SLO; stream everything; model routing; single-region co-location |
| Double-booking / bad writes to a customer's calendar | Deterministic booking engine, idempotent writes, dedupe keys, availability re-check before commit |
| CRM API rate limits / breakage | Adapter layer with backoff, caching, webhook sync; graceful degradation to "we'll confirm shortly" |
| Vendor lock-in (ASR/TTS/LLM) | Thin provider interfaces so each can be swapped as price/quality shifts |
| Cost per call spikes with long calls | Metered billing passes usage through; routing caps model spend; call-length guardrails |

---

*This is an engineering plan with recommended defaults, not a fixed spec — validate vendor
latencies and costs against your own load tests before committing, and revisit the
build/DB-per-tenant decisions as scale demands.*
