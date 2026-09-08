// Keyless mock ASR + TTS so the voice loop is testable and CI-able with no
// vendor accounts. Mock ASR treats each pushed chunk as UTF-8 text (the harness
// "speaks" text); mock TTS emits the words back as chunks, honoring barge-in.

import type { ASRProvider, ASRSession, Transcript } from "./asr.js";
import type { TTSProvider } from "./tts.js";

export class MockASRProvider implements ASRProvider {
  readonly name = "mock-asr";
  open(onTranscript: (t: Transcript) => void): ASRSession {
    return {
      pushAudio(chunk: Buffer) {
        const text = chunk.toString("utf8").trim();
        if (text) onTranscript({ text, isFinal: true });
      },
      close() {},
    };
  }
}

export class MockTTSProvider implements TTSProvider {
  readonly name = "mock-tts";
  async synthesize(text: string, onAudio: (chunk: Buffer) => void, signal: AbortSignal): Promise<void> {
    for (const word of text.split(" ")) {
      if (signal.aborted) return; // barge-in
      onAudio(Buffer.from(word + " ", "utf8"));
      await new Promise((r) => setTimeout(r, 1));
    }
  }
}
