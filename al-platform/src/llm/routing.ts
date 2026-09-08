// Two-tier model routing: a fast/cheap model handles simple turns (greetings,
// confirmations, summarizing a tool result), a smart model handles genuine
// reasoning. Cuts both latency and cost on the majority of turns without
// changing the orchestrator, which just sees one LLMProvider.

import type { ToolDef } from "../core/tools.js";
import type { AssistantTurn, LLMProvider, Message } from "./provider.js";

export type Tier = "fast" | "smart";

// Heuristic tier selection from conversation state.
export function chooseTier(messages: Message[]): Tier {
  const last = messages[messages.length - 1];
  if (!last) return "smart";

  // Continuing right after tool results -> usually just confirm/summarize.
  if (last.role === "user" && last.content.some((b) => b.type === "tool_result")) return "fast";

  // Short caller utterances ("yes", "3pm works", "my address is ...") are simple.
  if (last.role === "user") {
    const text = last.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    if (text && text.split(/\s+/).length <= 6) return "fast";
  }

  // First substantive turn / anything else -> smart.
  return "smart";
}

export class RoutingLLMProvider implements LLMProvider {
  readonly name = "routing";
  constructor(
    private fast: LLMProvider,
    private smart: LLMProvider,
    private onRoute?: (tier: Tier) => void,
  ) {}

  complete(system: string, messages: Message[], tools: ToolDef[]): Promise<AssistantTurn> {
    const tier = chooseTier(messages);
    this.onRoute?.(tier);
    return (tier === "fast" ? this.fast : this.smart).complete(system, messages, tools);
  }
}
