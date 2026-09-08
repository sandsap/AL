// Real streaming TTS via Cartesia. Outputs raw μ-law 8kHz so audio can go
// straight back to Twilio. Cancels immediately on barge-in via AbortSignal.
//
// Verify the endpoint, version header, model id, and output_format against
// current Cartesia docs before production. Set CARTESIA_VOICE_ID to a real voice.

import type { TTSProvider } from "./tts.js";

export class CartesiaTTSProvider implements TTSProvider {
  readonly name = "cartesia";
  constructor(
    private apiKey = process.env.CARTESIA_API_KEY,
    private voiceId = process.env.CARTESIA_VOICE_ID,
  ) {
    if (!this.apiKey) throw new Error("CARTESIA_API_KEY not set");
    if (!this.voiceId) throw new Error("CARTESIA_VOICE_ID not set");
  }

  async synthesize(text: string, onAudio: (chunk: Buffer) => void, signal: AbortSignal): Promise<void> {
    const resp = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey!,
        "Cartesia-Version": process.env.CARTESIA_VERSION ?? "2024-11-13",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: process.env.CARTESIA_MODEL ?? "sonic-2",
        transcript: text,
        voice: { mode: "id", id: this.voiceId },
        output_format: { container: "raw", encoding: "pcm_mulaw", sample_rate: 8000 },
      }),
      signal,
    });
    if (!resp.ok || !resp.body) throw new Error(`Cartesia TTS failed: ${resp.status} ${await safeText(resp)}`);

    const reader = resp.body.getReader();
    for (;;) {
      if (signal.aborted) {
        await reader.cancel().catch(() => {});
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value) onAudio(Buffer.from(value));
    }
  }
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
