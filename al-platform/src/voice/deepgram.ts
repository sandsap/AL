// Real streaming ASR via Deepgram's live WebSocket. Audio is Twilio's native
// μ-law 8kHz, so no transcoding. Emits interim results (for barge-in) and finals.
//
// Verify query params against current Deepgram live-streaming docs before
// production (model, endpointing, encoding all live here).

import WebSocket from "ws";
import type { ASRProvider, ASRSession, Transcript } from "./asr.js";

const DG_URL =
  "wss://api.deepgram.com/v1/listen" +
  "?encoding=mulaw&sample_rate=8000&channels=1" +
  "&interim_results=true&punctuate=true&endpointing=300" +
  `&model=${process.env.DEEPGRAM_MODEL ?? "nova-2-phonecall"}`;

export class DeepgramASRProvider implements ASRProvider {
  readonly name = "deepgram";
  constructor(private apiKey = process.env.DEEPGRAM_API_KEY) {
    if (!this.apiKey) throw new Error("DEEPGRAM_API_KEY not set");
  }

  open(onTranscript: (t: Transcript) => void): ASRSession {
    const ws = new WebSocket(DG_URL, { headers: { Authorization: `Token ${this.apiKey}` } });
    const backlog: Buffer[] = [];
    let ready = false;

    ws.on("open", () => {
      ready = true;
      for (const c of backlog) ws.send(c);
      backlog.length = 0;
    });
    ws.on("message", (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        const alt = msg?.channel?.alternatives?.[0];
        if (alt?.transcript) onTranscript({ text: alt.transcript, isFinal: Boolean(msg.is_final) });
      } catch {
        /* ignore keepalive / non-JSON frames */
      }
    });
    ws.on("error", (err) => console.error("[deepgram] error", err));

    return {
      pushAudio(chunk: Buffer) {
        if (ready) ws.send(chunk);
        else backlog.push(chunk);
      },
      close() {
        try {
          ws.send(JSON.stringify({ type: "CloseStream" }));
          ws.close();
        } catch {
          /* already closed */
        }
      },
    };
  }
}
