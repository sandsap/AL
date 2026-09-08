// Keyless voice-loop harness:  npm run demo:voice
// Simulates a Twilio media stream by pushing text "audio" frames through the
// full CallSession (mock ASR/TTS + orchestrator), including a barge-in test.
// Proves the real-time wiring without any vendor accounts.

import type { CallContext, Tenant } from "../core/types.js";
import { BookingEngine } from "../booking/engine.js";
import { MockCrmAdapter } from "../booking/mockCrm.js";
import { Orchestrator } from "../agent/orchestrator.js";
import { MockLLMProvider } from "../llm/mock.js";
import { MockASRProvider, MockTTSProvider } from "../voice/mock.js";
import { CallSession } from "../voice/session.js";

const tenant: Tenant = {
  id: "t_demo",
  name: "Lone Star Heating & Air",
  timezone: "America/Chicago",
  businessHours: { open: "07:00", close: "20:00" },
  serviceArea: ["78745", "78704", "78748"],
  jobTypes: [{ key: "hvac_repair", label: "HVAC repair", durationMinutes: 90, emergency: true }],
  crm: "mock",
  disclosure: "Hi, you've reached Lone Star Heating and Air — I'm an AI assistant and this call may be recorded.",
};

async function main() {
  console.log("\n=== voice-loop harness (mock ASR/TTS) ===\n");
  const scheduling = new MockCrmAdapter();
  const ctx: CallContext = { callId: "call_voice_1", tenant, fromNumber: "+15125550142" };
  const orchestrator = new Orchestrator(ctx, { llm: new MockLLMProvider(), scheduling, booking: new BookingEngine(scheduling) });

  let spoken = "";
  const session = new CallSession({
    asr: new MockASRProvider(),
    tts: new MockTTSProvider(),
    orchestrator,
    onAudioOut: (chunk) => {
      spoken += chunk.toString("utf8");
    },
    onEvent: (e) => {
      if (e.type === "turn") {
        const d = e.data as { say: string; bookingId?: string };
        console.log(`Al (audio out): ${spoken.trim()}`);
        if (d.bookingId) console.log(`\n✅ Job booked in CRM: ${d.bookingId}`);
        spoken = "";
      }
      if (e.type === "barge_in") console.log("⚡ barge-in detected — TTS cancelled");
    },
  });

  const caller = "Hi, my furnace stopped working and the house is freezing. Can someone come out today?";
  console.log(`Caller (audio in): ${caller}`);
  session.pushAudio(Buffer.from(caller, "utf8")); // one frame = one utterance in mock

  // Give the async turn time to complete.
  await new Promise((r) => setTimeout(r, 100));
  session.close();
  console.log("\n=== end ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
