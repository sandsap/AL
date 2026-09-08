// End-to-end demo of the call loop with ZERO external services.
//   npm run demo
// Simulates a "no heat" HVAC call and prints the conversation + booked job.
// This is the fastest proof the core works before you wire in real vendors.

import type { CallContext, Tenant } from "./core/types.js";
import { BookingEngine } from "./booking/engine.js";
import { MockCrmAdapter } from "./booking/mockCrm.js";
import { Orchestrator } from "./agent/orchestrator.js";
import { MockLLMProvider } from "./llm/mock.js";
import { AnthropicProvider } from "./llm/anthropic.js";
import type { LLMProvider } from "./llm/provider.js";

const tenant: Tenant = {
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

async function main() {
  // Use Claude if a key is present, otherwise the offline mock.
  const llm: LLMProvider = process.env.ANTHROPIC_API_KEY
    ? new AnthropicProvider()
    : new MockLLMProvider();
  console.log(`\n=== Al call simulation (LLM: ${llm.name}) ===\n`);

  const scheduling = new MockCrmAdapter();
  const booking = new BookingEngine(scheduling);
  const ctx: CallContext = { callId: "call_demo_1", tenant, fromNumber: "+15125550142" };
  const agent = new Orchestrator(ctx, { llm, scheduling, booking });

  const callerLines = [
    "Hi, my furnace stopped working and the house is freezing. Can someone come out today?",
  ];

  for (const line of callerLines) {
    console.log(`Caller:  ${line}`);
    const res = await agent.handleUtterance(line);
    console.log(`Al:      ${res.say}`);
    if (res.bookingId) console.log(`\n✅ Job booked in CRM: ${res.bookingId}`);
    if (res.escalated) console.log(`\n⚠️  Escalated to on-call staff.`);
  }
  console.log("\n=== end ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
