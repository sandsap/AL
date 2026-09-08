// Media Gateway skeleton — terminates Twilio Media Streams over WebSocket and
// wires the real-time path: audio in -> ASR -> Orchestrator -> TTS -> audio out.
//
// This is a runnable skeleton: it speaks the Twilio Media Streams protocol
// (connected / start / media / stop) and shows exactly where to plug Deepgram
// (ASR) and Cartesia/ElevenLabs (TTS). Those calls are stubbed so the process
// boots without vendor keys. See README §"Wiring real-time vendors".

import { WebSocketServer, type WebSocket } from "ws";

interface TwilioFrame {
  event: "connected" | "start" | "media" | "stop";
  start?: { callSid: string; streamSid: string };
  media?: { payload: string }; // base64 μ-law 8kHz
}

export function startMediaGateway(port = Number(process.env.MEDIA_PORT ?? 8081)) {
  const wss = new WebSocketServer({ port });
  console.log(`[media-gateway] listening on ws://0.0.0.0:${port}`);

  wss.on("connection", (ws: WebSocket) => {
    let callSid = "";
    // TODO: create per-call ASR stream (Deepgram) + Orchestrator here.

    ws.on("message", (raw) => {
      const frame: TwilioFrame = JSON.parse(raw.toString());
      switch (frame.event) {
        case "start":
          callSid = frame.start?.callSid ?? "";
          console.log(`[media-gateway] call started ${callSid}`);
          // TODO: open ASR stream; on final transcript -> orchestrator.handleUtterance()
          //       -> stream orchestrator text to TTS -> ws.send media frames back.
          break;
        case "media":
          // frame.media.payload is base64 μ-law audio. Forward to ASR.
          // Implement barge-in: if caller speaks while TTS is playing, cancel TTS.
          break;
        case "stop":
          console.log(`[media-gateway] call ended ${callSid}`);
          // TODO: finalize transcript, emit usage/meter event, persist recording.
          ws.close();
          break;
      }
    });

    ws.on("close", () => {
      // TODO: tear down ASR stream + timers.
    });
  });

  return wss;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) startMediaGateway();
