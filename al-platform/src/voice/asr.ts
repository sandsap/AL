// Streaming speech-to-text abstraction. The call session feeds audio chunks and
// receives interim + final transcripts. Swap Deepgram for another vendor by
// implementing this interface.

export interface Transcript {
  text: string;
  isFinal: boolean;
}

export interface ASRSession {
  pushAudio(chunk: Buffer): void;
  close(): void;
}

export interface ASRProvider {
  readonly name: string;
  open(onTranscript: (t: Transcript) => void): ASRSession;
}
