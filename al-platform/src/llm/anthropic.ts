// Real LLM provider backed by Claude (Anthropic API). Maps our content-block
// messages to the Messages API and back. Model is env-configurable so it tracks
// the latest Claude release without a code change.

import Anthropic from "@anthropic-ai/sdk";
import type { ToolDef } from "../core/tools.js";
import { type AssistantTurn, type LLMProvider, type Message, type ToolUse } from "./provider.js";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, model = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Use MockLLMProvider for offline runs, or set the key to use Claude.",
      );
    }
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(system: string, messages: Message[], tools: ToolDef[]): Promise<AssistantTurn> {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
      messages: messages.map(toAnthropicMessage),
    });

    let text: string | undefined;
    const toolUses: ToolUse[] = [];
    for (const block of resp.content) {
      if (block.type === "text") text = (text ?? "") + block.text;
      else if (block.type === "tool_use") {
        toolUses.push({ id: block.id, name: block.name, input: block.input as Record<string, any> });
      }
    }
    return { text, toolUses };
  }
}

function toAnthropicMessage(m: Message): Anthropic.MessageParam {
  return {
    role: m.role,
    content: m.content.map((b): Anthropic.ContentBlockParam => {
      if (b.type === "text") return { type: "text", text: b.text };
      if (b.type === "tool_use") {
        return { type: "tool_use", id: b.toolUse.id, name: b.toolUse.name, input: b.toolUse.input };
      }
      return { type: "tool_result", tool_use_id: b.toolResult.toolUseId, content: b.toolResult.content };
    }),
  };
}
