# First live call — Al on a real phone number

Get Al answering a real phone call end-to-end, on your laptop, in ~30 minutes.
No AWS needed — one `ngrok` tunnel exposes the gateway; Twilio calls it.

```
Caller's phone ──PSTN──▶ Twilio number ──webhook──▶ /twiml/voice (returns <Stream>)
                                          └─wss──▶ /media ──▶ Deepgram ⇄ Claude ⇄ Cartesia
```

The gateway serves **both** the webhook (`/twiml/voice`) and the WebSocket
(`/media`) on one port, so a single tunnel is enough.

---

## 0. What you need (your accounts — costs are small but real)

| Service | Why | Rough cost |
|---|---|---|
| [Twilio](https://twilio.com) | A phone number + Media Streams | ~$1–2/mo number + ~$0.013/min |
| [Deepgram](https://deepgram.com) | Streaming speech-to-text | free credit, then ~$0.004/min |
| [Cartesia](https://cartesia.ai) | Streaming text-to-speech | free tier, then usage |
| [Anthropic](https://console.anthropic.com) | Claude (the agent brain) | usage; a test call is pennies |
| [ngrok](https://ngrok.com) | Public HTTPS/WSS tunnel to your laptop | free |

> ⚠️ **Consent/TCPA:** a real inbound call may be recorded and is handled by AI.
> Al already speaks an AI disclosure at call start (tenant `disclosure` field).
> For testing, **call from your own phone** so all parties consent. Review
> per-state two-party-consent rules before taking real customer calls.

---

## 1. Install + configure

```bash
cd al-platform
npm install
cp .env.example .env
```

Fill these in `.env` (leave the rest blank):

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
DEEPGRAM_API_KEY=...
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=<pick a voice id from the Cartesia dashboard>
```

The gateway auto-detects these keys and switches from mocks to the real
Deepgram / Cartesia / Claude providers — no code change.

## 2. Start the gateway

```bash
# loads .env, then runs the media gateway on :8081
node --env-file=.env --import tsx src/server/media-gateway.ts
```

You should see: `[media-gateway] http+ws on :8081  (asr=deepgram tts=cartesia llm=anthropic)`.
If it still says `asr=mock`, your `.env` didn't load — check the keys.

## 3. Expose it with ngrok

In a second terminal:

```bash
ngrok http 8081
```

Copy the HTTPS forwarding host, e.g. `https://a1b2c3.ngrok-free.app`. Sanity check:

```bash
curl https://a1b2c3.ngrok-free.app/health          # -> {"ok":true,...}
curl https://a1b2c3.ngrok-free.app/twiml/voice      # -> TwiML with wss://a1b2c3.../media
```

The TwiML's `<Stream url>` is derived from the request host, so it already
points at your tunnel — nothing to hardcode.

## 4. Point a Twilio number at it

1. In the Twilio Console, buy a **Voice-capable** number (Phone Numbers → Buy a number).
2. Open the number's config → **Voice Configuration**.
3. **A call comes in** → *Webhook*, URL:
   `https://a1b2c3.ngrok-free.app/twiml/voice`, method **HTTP POST**.
4. Save.

(Optional, via the Twilio CLI:)

```bash
twilio phone-numbers:update <YOUR_TWILIO_NUMBER> \
  --voice-url="https://a1b2c3.ngrok-free.app/twiml/voice" --voice-method POST
```

## 5. Call it ☎️

Dial the Twilio number from your phone. You should hear Al's disclosure and be
able to say: *"My furnace stopped working, can someone come out today?"* — and
Al will look up availability and book the job (into the mock CRM until you set
`HOUSECALL_PRO_API_KEY` and switch the tenant's `crm` to `housecall_pro`).

Watch the gateway terminal for `call started`, `barge_in`, and `turn` events.

---

## What to listen for (and tune)

- **Latency / feel** — this is the whole test. If replies lag, it's usually TTS
  first-byte or LLM first-token; try a faster Cartesia model and confirm you're
  streaming (you are, by default).
- **Barge-in** — talk over Al mid-sentence; it should stop and listen.
- **Endpointing** — if Al cuts you off or waits too long, tune Deepgram
  `endpointing` (in `src/voice/deepgram.ts`) — start at 300ms.
- **Booking correctness** — the mock CRM books deterministic slots; with a real
  CRM, verify the job lands on the right calendar.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Call connects but silence | TTS not producing audio — check `CARTESIA_VOICE_ID` and gateway logs |
| `asr=mock` in the banner | `.env` not loaded / keys missing |
| Twilio "application error" | Webhook URL wrong or ngrok not running; re-check `/twiml/voice` |
| Robotic long pauses | LLM latency — confirm streaming; try two-tier model routing |
| No transcript reaching agent | Deepgram auth (`Token <key>`) or encoding params — see `deepgram.ts` |

## Cost of one test call

A ~3-minute call is roughly **$0.15–0.35** all-in (telephony + ASR + LLM + TTS),
consistent with `ARCHITECTURE.md` §10. You control spend via the model and call
length.

## When it feels right → go to production

Follow the **Launch runbook** in `README.md`: put keys in AWS Secrets Manager,
`terraform apply` the stack in `infra/terraform/` (set `certificate_arn` for
`wss://`), deploy the images, and point the Twilio number at the ALB instead of
ngrok. Then onboard a design-partner contractor in overflow/after-hours mode.
