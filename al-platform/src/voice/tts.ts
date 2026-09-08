// Streaming text-to-speech abstraction. `synthesize` streams audio chunks and
// MUST stop promptly when `signal` aborts — that's how barge-in cancels the
// agent mid-sentence when the caller starts talking.

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, onAudio: (chunk: Buffer) => void, signal: AbortSignal): Promise<void>;
}
