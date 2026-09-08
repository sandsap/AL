# Al — Business Plan

**The AI front-office employee for home-services businesses.**

*Working name: "Al." Category: AI vertical agent for SMBs. Stage: Pre-seed / Seed. Prepared 2026.*

---

## 1. Executive summary

Home-services contractors — HVAC, plumbing, and electrical companies — run on the
phone. When the phone rings, it is almost always a customer with an urgent, high-value
job: a dead furnace, a flooded basement, no power. Yet the typical small contractor
**misses 25–35% of inbound calls** because the owner is on a roof, the one office
person is on another line, or it's after 5pm. Every missed call is a booked job that
goes to a competitor. For a trade where the average job is worth **$400–$3,000+**, that
is the single largest, most fixable leak in the business.

**Al** is an AI agent that answers *every* call, 24/7, in a natural voice. It qualifies
the caller, books the job directly into the contractor's scheduling software, handles
reschedules and FAQs, and follows up on quotes — the work a great front-desk person
does, at a fraction of the cost and without turnover. Unlike a horizontal "AI
receptionist," Al is built specifically for the trades: it knows what a "capacitor" or
a "main line backup" is, it integrates deeply with field-service platforms
(ServiceTitan, Housecall Pro, Jobber), and it is measured on one number the owner cares
about — **jobs booked.**

We sell a painful, quantifiable problem with an obvious ROI: at ~$500/month, Al pays for
itself if it captures a single extra job a month. We reach these owners through the
channels they already trust — trade software marketplaces, franchise groups, and
peer referral — and we compound a defensible **data moat** from millions of real
service calls that let us fine-tune vertical voice models no horizontal competitor can
match.

**The ask:** We are raising a **$4.0M seed round** to reach ~$3–5M ARR and Series-A
readiness within 18–24 months.

---

## 2. The problem

Home services is a ~$600B+ US market made up of millions of small businesses, most with
fewer than 20 employees. These owners are technicians first and operators second. Their
front office is chronically understaffed and the phone is their lifeblood:

- **Phone is still the primary channel.** 60%+ of home-services jobs originate from an
  inbound call. Customers with an emergency call; they do not fill out a web form.
- **Missed calls = lost revenue.** Industry studies and our customer discovery put
  missed-call rates at **25–35%** for sub-20-employee shops, spiking during storms and
  heat waves — exactly when demand and job value peak.
- **Labor is scarce and expensive.** A competent front-desk/CSR costs $40–55k+ fully
  loaded, is hard to hire, quits often, and doesn't work nights or weekends. Answering
  services are cheap but book poorly and frustrate customers.
- **After-hours is a black hole.** 30–40% of calls come outside 9–5. Voicemail loses
  most of them.

The owner *knows* they're losing money on the phone but has no scalable way to fix it.
That is the wedge.

---

## 3. The solution

**Al answers every call and turns it into a booked job.** Core capabilities:

1. **24/7 natural-voice answering.** Sub-second latency, interruptible, trade-fluent.
   Picks up on the first ring, every ring, including overflow when staff are busy.
2. **Booking, not just messaging.** Al reads live availability from the contractor's
   schedule, books the right job type into the right slot/technician, and confirms —
   writing directly to ServiceTitan / Housecall Pro / Jobber.
3. **Qualification & triage.** Distinguishes emergency from routine, captures address,
   equipment, and problem, and routes true emergencies to on-call staff.
4. **Reschedules, reminders, and quote follow-up.** Reduces no-shows and revives stale
   estimates — outbound revenue Al creates on its own.
5. **Owner dashboard.** Every call transcribed, summarized, and scored, with a running
   tally of **jobs booked and revenue captured** — the ROI, in dollars, front and center.

Al is configured in under an hour from the contractor's existing data and goes live the
same day.

---

## 4. Why now

- **Voice AI crossed the usability threshold.** As of 2024–2025, streaming
  speech-to-speech latency and naturalness reached the point where callers no longer
  reliably know they're talking to software — the prerequisite for booking real jobs.
- **Inference costs are falling fast**, turning a per-minute voice agent from
  margin-negative into a healthy-margin product over our planning horizon.
- **Deep SMB software penetration.** Field-service platforms now have the APIs and
  marketplaces that make same-day, write-back integrations — and low-CAC distribution —
  possible.
- **A worsening skilled-labor shortage** makes "an employee that never quits" an easy
  yes for owners who already can't hire.

The window is now: the technology just became good enough, and the horizontal players
haven't yet gone deep on any single vertical.

---

## 5. Market size

Bottom-up, US-only, initial trades (HVAC, plumbing, electrical):

| Segment | Definition | Businesses | Blended ACV | Value |
|---|---|---|---|---|
| **TAM** | All US home-services SMBs, phone-driven | ~1,000,000 | $7,200 | **~$7.2B** |
| **SAM** | HVAC / plumbing / electrical, 2–50 techs, US | ~300,000 | $7,200 | **~$2.2B** |
| **SOM (Yr 3)** | ~1% of SAM | ~3,000 customers | $7,200 | **~$21M ARR** |

ACV blends a ~$500/mo subscription with usage. Expansion beyond the first three trades
(roofing, garage doors, pest, landscaping, water treatment, appliance repair) and into
Canada/UK/AU roughly **triples the TAM** without changing the product core.

---

## 6. Product & technology

**Architecture.** A real-time voice pipeline (telephony → streaming ASR → an
orchestration layer over frontier + fine-tuned LLMs → streaming TTS) wrapped in a
deterministic **booking engine** that enforces business rules and writes to the CRM.
Voice is the interface; the booking engine and integrations are the product.

**The moat is data + integrations + workflow depth:**

- **Vertical data flywheel.** Every call — with outcome labels (booked / not, job type,
  value) — trains models that get measurably better at *this* conversation than any
  general assistant. More customers → more calls → better booking rate → lower churn and
  higher willingness to pay. Horizontal competitors cannot easily replicate trade-specific
  data.
- **Deep, certified integrations.** Same-day write-back to ServiceTitan, Housecall Pro,
  and Jobber is hard, high-trust engineering. Marketplace listings double as distribution.
- **Workflow depth.** Emergency triage, dispatch rules, multi-location, and financing
  scripts are unglamorous work that compounds into switching costs.
- **Outcome accountability.** We instrument booked-jobs and dollars-captured, so the
  product proves its own ROI and anchors pricing.

---

## 7. Business model & unit economics

**Pricing (land-and-expand).**

- **Starter — $399/mo:** overflow + after-hours answering and booking, 1 location.
- **Pro — $699/mo:** 24/7 primary line, outbound follow-up, multi-tech dispatch.
- **Multi-location / franchise:** custom, per-location.
- Usage overage above bundled minutes. **Blended ACV ≈ $7,200.**

**Illustrative unit economics at scale:**

| Metric | Target |
|---|---|
| Blended ACV | ~$7,200 |
| Gross margin | ~50% early → **70%+** as inference costs fall |
| CAC | $1,500–3,000 (blended inbound + partner) |
| CAC payback | **< 12 months** |
| Gross logo churn | 3%/mo early → **< 1.5%** with integration depth |
| LTV : CAC | **> 3:1** |

The ROI story keeps churn low: an owner watching "jobs booked" tick up does not cancel
the thing booking jobs.

---

## 8. Go-to-market

**ICP:** owner-operated HVAC / plumbing / electrical firms, 3–30 technicians, already on
a supported field-service platform, feeling the pain of missed calls.

**Motion — win the trusted channels these owners already use:**

1. **Software marketplaces & integration partnerships** (ServiceTitan, Housecall Pro,
   Jobber) — co-listing and co-marketing for warm, low-CAC distribution.
2. **Franchise & buying groups / private-equity roll-ups** — land one location, expand
   to the network; PE-owned home-services platforms are actively hunting exactly this ROI.
3. **Peer channels** — trade Facebook groups, Nexstar/BDR-style coaching networks,
   podcasts, and referral incentives. Trades run on word of mouth.
4. **Founder-led outbound** to prove the motion before scaling a small inside-sales team.

**Land → expand:** start on overflow/after-hours (low risk), earn trust with booked
jobs, upgrade to the 24/7 primary line and outbound follow-up, then multi-location.

---

## 9. Competition

| Category | Examples | Why we win |
|---|---|---|
| Human answering services | Traditional call centers | Cheaper, 24/7, actually *books* into the CRM, never has a bad day |
| Horizontal AI receptionists | General voice-AI agents | We go deep on the trades: trade-fluent, certified CRM write-back, outcome-based |
| CRM-native add-ons | Field-service platforms' own features | We're best-of-breed and cross-platform; platforms are slow and generic on voice |
| DIY / status quo | Voicemail, the owner's cell | We recover the 25–35% of calls that status quo loses |

**Defensibility** compounds through the vertical data flywheel, integration switching
costs, and being the system of record for "jobs booked."

---

## 10. Traction & milestones

*(Populate with live metrics before sending to investors.)*

- **Now:** [X] design partners live; [Y] calls handled; booking rate [Z]%; [$] revenue
  captured for customers; early logo retention.
- **Seed goal (18–24 mo):** ~$3–5M ARR, efficient growth (net revenue retention > 100%,
  CAC payback < 12 mo, gross churn trending < 2%/mo), 2+ certified integrations live.

---

## 11. Team

*(Fill in.)*

- **[Founder / CEO]** — [domain + GTM background; ideally home-services or SMB software].
- **[Founder / CTO]** — [real-time voice / ML systems background].
- **Early hires (seed):** founding voice/ML engineer, integrations engineer, founding
  AE, customer success lead.
- **Advisors:** a multi-location home-services operator, a field-service-platform
  executive, a voice-AI researcher.

*Why us: [unfair advantage — prior exits, deep trade relationships, or proprietary voice
tech].*

---

## 12. Financial projections

Illustrative, ending-ARR basis. Assumes seed close in H1 and disciplined, ROI-led growth.

| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Customers (end of year) | 150 | 700 | 2,200 |
| Ending ARR | ~$1.0M | ~$5.0M | ~$16M |
| Gross margin | ~50% | ~60% | ~70% |
| Headcount | ~12 | ~30 | ~65 |
| Net burn (annual) | ~$2.2M | ~$3.0M | ~breakeven trend |

Series-A raise targeted in Year 2 on the strength of ~$3–5M ARR and efficient-growth
metrics.

---

## 13. The ask & use of funds

**Raising $4.0M seed** for an 18–24 month runway to Series-A metrics.

| Use | Allocation | Purpose |
|---|---|---|
| Engineering & product | ~50% | Voice pipeline, booking engine, ServiceTitan/HCP/Jobber integrations, data flywheel |
| Go-to-market | ~30% | Partnerships, founding sales & CS, marketplace presence |
| AI / infrastructure | ~12% | Inference, telephony, model fine-tuning |
| G&A / runway buffer | ~8% | Ops, legal, compliance |

**Milestones this funds:** 2+ certified integrations, $3–5M ARR, proven repeatable GTM
motion, LTV:CAC > 3:1, and a fine-tuned vertical voice model outperforming horizontal
baselines on booking rate.

---

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Voice quality / bad call = lost customer trust** | Vertical fine-tuning, seamless human handoff, obsessive booking-rate monitoring, start on low-risk overflow |
| **Platforms build this themselves** | Move faster, go cross-platform, own the data flywheel and the ROI relationship; become an attractive acquisition |
| **Inference cost / margin pressure** | Costs are falling; usage-based pricing passes through; route to right-sized models |
| **SMB churn / budget sensitivity** | Anchor on dollars-booked ROI; deepen integration switching costs; land on overflow before primary line |
| **Regulatory (call recording, TCPA, AI disclosure)** | Clear AI disclosure, per-state consent handling, compliance built into onboarding |
| **Long, noisy sales cycles** | Ride trusted channels (marketplaces, franchises, peer referral) rather than cold SMB acquisition |

---

## 15. Roadmap (12–18 months)

- **Q1–Q2:** Harden voice + booking engine; first certified integration; 10–20 design
  partners to a repeatable onboarding.
- **Q2–Q3:** Second integration; launch outbound follow-up; stand up partner/marketplace
  channel; reach ~$1M ARR.
- **Q3–Q4:** Multi-location/franchise tier; ship v1 fine-tuned vertical model; scale
  inside sales.
- **Next 6 mo:** Third integration and second trade cohort; ~$3–5M ARR; raise Series A.

---

*This is a planning document with illustrative, clearly-labeled figures; validate all
market and financial assumptions with primary data before circulating to investors.*
