// Deterministic mock provider: drives a realistic booking conversation with no
// API key, so `npm run demo` and CI work offline. It inspects which tools have
// already run and advances a simple state machine.

import type { ToolDef } from "../core/tools.js";
import {
  type AssistantTurn,
  type LLMProvider,
  type Message,
  newToolUseId,
} from "./provider.js";

function toolAlreadyUsed(messages: Message[], name: string): boolean {
  return messages.some(
    (m) => m.role === "assistant" && m.content.some((b) => b.type === "tool_use" && b.toolUse.name === name),
  );
}

function lastToolResult(messages: Message[], name: string): string | undefined {
  // Find the tool_use id for `name`, then its matching tool_result.
  let useId: string | undefined;
  for (const m of messages) {
    for (const b of m.content) {
      if (b.type === "tool_use" && b.toolUse.name === name) useId = b.toolUse.id;
    }
  }
  if (!useId) return undefined;
  for (const m of messages) {
    for (const b of m.content) {
      if (b.type === "tool_result" && b.toolResult.toolUseId === useId) return b.toolResult.content;
    }
  }
  return undefined;
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  async complete(_system: string, messages: Message[], _tools: ToolDef[]): Promise<AssistantTurn> {
    // 1. First, check availability.
    if (!toolAlreadyUsed(messages, "get_availability")) {
      return {
        text: "Sorry to hear the furnace is out — let me find the soonest time we can get a tech to you.",
        toolUses: [
          {
            id: newToolUseId(),
            name: "get_availability",
            input: { jobTypeKey: "hvac_repair" },
          },
        ],
      };
    }

    // 2. Once we have slots, book the first one.
    if (!toolAlreadyUsed(messages, "book_job")) {
      const availabilityJson = lastToolResult(messages, "get_availability");
      const slots = availabilityJson ? JSON.parse(availabilityJson) : [];
      const first = slots[0];
      if (!first) {
        return { text: "I'm not seeing any open slots right now — let me take a message and have the office call you back.", toolUses: [] };
      }
      return {
        text: `I can get someone out at ${new Date(first.start).toLocaleString()}.`,
        toolUses: [
          {
            id: newToolUseId(),
            name: "book_job",
            input: {
              jobTypeKey: "hvac_repair",
              slotStartISO: first.start,
              customerName: "Jamie Rivera",
              customerPhone: "+15125550142",
              customerAddress: "812 Oak Ridge Dr, Austin, TX 78745",
              notes: "No heat; furnace not igniting.",
            },
          },
        ],
      };
    }

    // 3. Booking done — confirm to the caller.
    const bookingJson = lastToolResult(messages, "book_job");
    const booking = bookingJson ? JSON.parse(bookingJson) : { ok: false };
    if (booking.ok) {
      return {
        text: `You're all set — booking ${booking.bookingId} is confirmed. You'll get a text confirmation shortly. Anything else?`,
        toolUses: [],
      };
    }
    return { text: `I couldn't lock that in (${booking.reason}). Let me try another time.`, toolUses: [] };
  }
}
