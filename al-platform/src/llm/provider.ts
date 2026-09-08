// LLM provider abstraction. Swap implementations (mock, Claude, ...) without
// touching the orchestrator. Message shape mirrors Anthropic's content blocks
// so the real provider maps 1:1.

import type { ToolDef } from "../core/tools.js";

export type Role = "user" | "assistant";

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; toolUse: ToolUse }
  | { type: "tool_result"; toolResult: ToolResult };

export interface Message {
  role: Role;
  content: ContentBlock[];
}

// One assistant step: optional spoken text plus zero or more tool calls.
export interface AssistantTurn {
  text?: string;
  toolUses: ToolUse[];
}

export interface LLMProvider {
  readonly name: string;
  complete(system: string, messages: Message[], tools: ToolDef[]): Promise<AssistantTurn>;
}

let counter = 0;
export function newToolUseId(): string {
  counter += 1;
  return `tu_${Date.now()}_${counter}`;
}
