// Media Gateway — terminates Twilio Media Streams over WebSocket and runs the
// real-time voice loop (CallSession) per call. Uses real vendors when keys are
// present, otherwise keyless mocks so the process boots for local testing.
//
// Twilio Media Streams protocol: https://www.twilio.com/docs/voice/media-streams
//   inbound frames:  connected | start | media(base64 μ-law) | stop
//   outbound frames: { event:"media", streamSid, media:{ payload: base64 } }

import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { CallContext, Tenant } from "../core/types.js";
import { BookingEngine } from "../booking/engine.js";
import { makeSchedulingProvider } from "../booking/providerFactory.js";
import { Orchestrator } from "../agent/orchestrator.js";
import { MockLLMProvider } from "../llm/mock.js";
import { AnthropicProvider } from "../llm/anthropic.js";
import type { LLMProvider } from "../llm/provider.js";
import type { ASRProvider } from "../voice/asr.js";
import type { TTSProvider } from "../voice/tts.js";
import { MockASRProvider, MockTTSProvider } from "../voice/mock.js";
import { DeepgramASRProvider } from "../voice/deepgram.js";
import { CartesiaTTSProvider } from "../voice/cartesia.js";
import { CallSession } from "../voice/session.js";

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

function makeLLM(): LLMProvider {
  return process.env.ANTHROPIC_API_KEY ? new AnthropicProvider() : new MockLLMProvider();
}
function makeASR(): ASRProvider {
  return process.env.DEEPGRAM_API_KEY ? new DeepgramASRProvider() : new MockASRProvider();
}
function makeTTS(): TTSProvider {
  return process.env.CARTESIA_API_KEY ? new CartesiaTTSProvider() : new MockTTSProvider();
}

interface TwilioFrame {
  event: "connected" | "start" | "media" | "stop";
  start?: { callSid: string; streamSid: string };
  streamSid?: string;
  media?: { payload: string };
}

export function startMediaGateway(port = Number(process.env.MEDIA_PORT ?? 8081)) {
  // HTTP server carries the ALB health check (`GET /health`); the WebSocket
  // server rides on the same port for Twilio Media Stream upgrades.
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "media-gateway" }));
      return;
    }
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("Upgrade Required");
  });
  const wss = new WebSocketServer({ server });
  server.listen(port, "0.0.0.0", () => {
    console.log(
      `[media-gateway] http+ws on :${port}  (asr=${makeASR().name} tts=${makeTTS().name} llm=${makeLLM().name})`,
    );
  });

  wss.on("connection", (ws: WebSocket) => {
    let session: CallSession | undefined;
    let streamSid = "";

    ws.on("message", (raw) => {
      const frame: TwilioFrame = JSON.parse(raw.toString());
      switch (frame.event) {
        case "start": {
          streamSid = frame.start?.streamSid ?? "";
          const ctx: CallContext = {
            callId: frame.start?.callSid ?? `call_${Date.now()}`,
            tenant: DEMO_TENANT,
            fromNumber: "unknown",
          };
          const scheduling = makeSchedulingProvider(ctx.tenant);
          const orchestrator = new Orchestrator(ctx, {
            llm: makeLLM(),
            scheduling,
            booking: new BookingEngine(scheduling),
          });
          session = new CallSession({
            asr: makeASR(),
            tts: makeTTS(),
            orchestrator,
            onAudioOut: (chunk) => {
              ws.send(JSON.stringify({ event: "media", streamSid, media: { payload: chunk.toString("base64") } }));
            },
            onEvent: (e) => console.log(`[media-gateway] ${ctx.callId} event: ${e.type}`),
          });
          console.log(`[media-gateway] call started ${ctx.callId}`);
          break;
        }
        case "media": {
          if (session && frame.media) session.pushAudio(Buffer.from(frame.media.payload, "base64"));
          break;
        }
        case "stop": {
          console.log("[media-gateway] call ended");
          session?.close();
          // TODO: persist recording/transcript to S3, emit Stripe meter event.
          ws.close();
          break;
        }
      }
    });

    ws.on("close", () => session?.close());
  });

  return { server, wss };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) startMediaGateway();
