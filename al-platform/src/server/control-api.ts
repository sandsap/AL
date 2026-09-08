// Control-plane API (Fastify). Health, tenant read, a call simulator that runs
// the real orchestrator with mock providers, and the Stripe webhook (raw body).
//   npm run dev:api
// NOTE: this uses an in-memory tenant for demo. Swap TENANTS for your Postgres
// data layer with tenant_id scoping before production.

import Fastify from "fastify";
import type { Tenant, CallContext } from "../core/types.js";
import { BookingEngine } from "../booking/engine.js";
import { MockCrmAdapter } from "../booking/mockCrm.js";
import { Orchestrator } from "../agent/orchestrator.js";
import { MockLLMProvider } from "../llm/mock.js";
import { listCalls, getCall, metrics } from "../dashboard/store.js";
import { dashboardHtml } from "../dashboard/page.js";

const DEMO_TENANT: Tenant = {
  id: "t_demo",
  name: "Lone Star Heating & Air",
  timezone: "America/Chicago",
  businessHours: { open: "07:00", close: "20:00" },
  serviceArea: ["78745", "78704", "78748"],
  jobTypes: [
    { key: "hvac_repair", label: "HVAC repair", durationMinutes: 90, emergency: true },
    { key: "tune_up", label: "Seasonal tune-up", durationMinutes: 60, emergency: false },
  ],
  crm: "mock",
  disclosure: "Hi, you've reached Lone Star Heating and Air — I'm an AI assistant and this call may be recorded.",
};
const TENANTS: Record<string, Tenant> = { [DEMO_TENANT.id]: DEMO_TENANT };

export function build() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true, service: "control-api" }));

  // --- Owner dashboard (served page + JSON it fetches) ---
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(dashboardHtml(DEMO_TENANT.id));
  });

  app.get<{ Params: { id: string } }>("/api/tenants/:id/metrics", async (req, reply) => {
    if (!TENANTS[req.params.id]) return reply.code(404).send({ error: "tenant not found" });
    return metrics(req.params.id);
  });

  app.get<{ Params: { id: string } }>("/api/tenants/:id/calls", async (req, reply) => {
    if (!TENANTS[req.params.id]) return reply.code(404).send({ error: "tenant not found" });
    return listCalls(req.params.id);
  });

  app.get<{ Params: { id: string; callId: string } }>(
    "/api/tenants/:id/calls/:callId",
    async (req, reply) => {
      const call = getCall(req.params.id, req.params.callId);
      if (!call) return reply.code(404).send({ error: "call not found" });
      return call;
    },
  );

  app.get<{ Params: { id: string } }>("/tenants/:id", async (req, reply) => {
    const t = TENANTS[req.params.id];
    if (!t) return reply.code(404).send({ error: "not found" });
    return t;
  });

  // Run the agent loop over a single caller utterance (mock providers).
  app.post<{ Params: { id: string }; Body: { text: string } }>(
    "/tenants/:id/simulate-call",
    async (req, reply) => {
      const tenant = TENANTS[req.params.id];
      if (!tenant) return reply.code(404).send({ error: "tenant not found" });
      const scheduling = new MockCrmAdapter();
      const booking = new BookingEngine(scheduling);
      const ctx: CallContext = { callId: `sim_${Date.now()}`, tenant, fromNumber: "+15125550142" };
      const agent = new Orchestrator(ctx, { llm: new MockLLMProvider(), scheduling, booking });
      const result = await agent.handleUtterance(req.body?.text ?? "My furnace is out.");
      return result;
    },
  );

  // Stripe webhook needs the raw body for signature verification.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body);
  });
  app.post("/webhooks/stripe", async (req, reply) => {
    // In production: verify with Billing.constructEvent(req.body, sig) and
    // dispatch provisioningActionFor(event). Left unwired so the server boots
    // without Stripe keys.
    req.log.info("stripe webhook received (verification not wired in demo)");
    return reply.code(200).send({ received: true });
  });

  return app;
}

// Boot when run directly.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = build();
  const port = Number(process.env.PORT ?? 8080);
  app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
