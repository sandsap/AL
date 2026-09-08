// CallSession wires the real-time loop for one call:
//   audio in -> ASR -> Orchestrator -> TTS -> audio out
// with barge-in: if the caller starts speaking while the agent is talking, the
// in-flight TTS is cancelled and we listen again.

import type { Orchestrator } from "../agent/orchestrator.js";
import type { ASRProvider, ASRSession, Transcript } from "./asr.js";
import type { TTSProvider } from "./tts.js";

export interface CallEvent {
  type: "barge_in" | "turn" | "error";
  data?: unknown;
}

export interface CallSessionOpts {
  asr: ASRProvider;
  tts: TTSProvider;
  orchestrator: Orchestrator;
  onAudioOut: (chunk: Buffer) => void;
  onEvent?: (e: CallEvent) => void;
}

export class CallSession {
  private asrSession: ASRSession;
  private speaking = false;
  private processing = false;
  private ttsAbort?: AbortController;

  constructor(private opts: CallSessionOpts) {
    this.asrSession = opts.asr.open((t) => this.onTranscript(t));
  }

  pushAudio(chunk: Buffer): void {
    this.asrSession.pushAudio(chunk);
  }

  private onTranscript(t: Transcript): void {
    // Barge-in: any caller speech while the agent is talking cancels TTS.
    if (t.text && this.speaking) {
      this.opts.onEvent?.({ type: "barge_in" });
      this.ttsAbort?.abort();
      this.speaking = false;
    }
    if (!t.isFinal || !t.text) return;
    if (this.processing) return; // drop overlapping finals; one turn at a time
    void this.handleFinal(t.text);
  }

  private async handleFinal(text: string): Promise<void> {
    this.processing = true;
    try {
      const res = await this.opts.orchestrator.handleUtterance(text);
      await this.speak(res.say);
      this.opts.onEvent?.({ type: "turn", data: res });
    } catch (err) {
      this.opts.onEvent?.({ type: "error", data: err });
    } finally {
      this.processing = false;
    }
  }

  private async speak(text: string): Promise<void> {
    if (!text) return;
    this.ttsAbort = new AbortController();
    this.speaking = true;
    try {
      await this.opts.tts.synthesize(text, this.opts.onAudioOut, this.ttsAbort.signal);
    } finally {
      this.speaking = false;
    }
  }

  close(): void {
    this.ttsAbort?.abort();
    this.asrSession.close();
  }
}
