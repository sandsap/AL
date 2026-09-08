// Agent orchestrator: runs the conversation loop, executes tool calls against
// real services, and enforces guardrails. Provider-agnostic (mock or Claude).

import type { CallContext, Slot } from "../core/types.js";
import { TOOLS } from "../core/tools.js";
import { BookingEngine } from "../booking/engine.js";
import type { SchedulingProvider } from "../booking/scheduling.js";
import {
  type ContentBlock,
  type LLMProvider,
  type Message,
  type ToolUse,
} from "../llm/provider.js";

export interface Deps {
  llm: LLMProvider;
  scheduling: SchedulingProvider;
  booking: BookingEngine;
}

export interface TurnResult {
  say: string; // what the agent speaks back
  escalated: boolean;
  bookingId?: string;
}

export class Orchestrator {
  private messages: Message[] = [];
  constructor(private ctx: CallContext, private deps: Deps) {}

  systemPrompt(): string {
    const t = this.ctx.tenant;
    return [
      `You are the front-office agent for ${t.name}, a home-services company.`,
      `Disclosure (say this near the start): "${t.disclosure}"`,
      `Business hours: ${t.businessHours.open}–${t.businessHours.close} ${t.timezone}.`,
      `Job types: ${t.jobTypes.map((j) => `${j.key} (${j.label})`).join(", ")}.`,
      `Goal: book the job. Be warm, brief, and natural. Confirm details before booking.`,
      `Never invent availability — always call get_availability first. Escalate true emergencies.`,
    ].join("\n");
  }

  // Feed one caller utterance, run the tool loop, return what to say back.
  async handleUtterance(text: string): Promise<TurnResult> {
    this.messages.push({ role: "user", content: [{ type: "text", text }] });

    let escalated = false;
    let bookingId: string | undefined;

    // Iterate until the model returns a spoken response with no tool calls.
    for (let hop = 0; hop < 8; hop++) {
      const turn = await this.deps.llm.complete(this.systemPrompt(), this.messages, TOOLS);

      const assistantBlocks: ContentBlock[] = [];
      if (turn.text) assistantBlocks.push({ type: "text", text: turn.text });
      for (const tu of turn.toolUses) assistantBlocks.push({ type: "tool_use", toolUse: tu });
      this.messages.push({ role: "assistant", content: assistantBlocks });

      if (turn.toolUses.length === 0) {
        return { say: turn.text ?? "", escalated, bookingId };
      }

      // Execute each tool call and feed results back.
      const resultBlocks: ContentBlock[] = [];
      for (const tu of turn.toolUses) {
        const out = await this.runTool(tu);
        if (tu.name === "escalate") escalated = true;
        if (tu.name === "book_job") {
          const parsed = JSON.parse(out);
          if (parsed.ok) bookingId = parsed.bookingId;
        }
        resultBlocks.push({
          type: "tool_result",
          toolResult: { toolUseId: tu.id, content: out },
        });
      }
      this.messages.push({ role: "user", content: resultBlocks });
    }

    return { say: "Let me have the office follow up with you shortly.", escalated, bookingId };
  }

  private async runTool(tu: ToolUse): Promise<string> {
    switch (tu.name) {
      case "get_availability": {
        const from = tu.input.fromISO ?? new Date().toISOString();
        const to = tu.input.toISO ?? new Date(Date.now() + 3 * 864e5).toISOString();
        const slots = await this.deps.scheduling.getAvailability(tu.input.jobTypeKey, from, to);
        return JSON.stringify(slots);
      }
      case "lookup_customer": {
        const c = await this.deps.scheduling.lookupCustomer(tu.input.phone);
        return JSON.stringify(c);
      }
      case "escalate": {
        return JSON.stringify({ escalated: true, reason: tu.input.reason });
      }
      case "book_job": {
        const slotStart = tu.input.slotStartISO as string;
        const jobTypeKey = tu.input.jobTypeKey as string;
        // Reconstruct the full slot from current availability (agent only knows start).
        const from = new Date(slotStart);
        from.setHours(0, 0, 0, 0);
        const to = new Date(slotStart);
        to.setHours(23, 59, 59, 999);
        const slots = await this.deps.scheduling.getAvailability(jobTypeKey, from.toISOString(), to.toISOString());
        const slot: Slot | undefined = slots.find((s) => s.start === slotStart);
        if (!slot) return JSON.stringify({ ok: false, reason: "Slot no longer available" });

        const result = await this.deps.booking.book(this.ctx.tenant, {
          tenantId: this.ctx.tenant.id,
          callId: this.ctx.callId,
          jobTypeKey,
          slot,
          customer: {
            name: tu.input.customerName,
            phone: tu.input.customerPhone,
            address: tu.input.customerAddress,
          },
          notes: tu.input.notes,
          idempotencyKey: `${this.ctx.callId}:${jobTypeKey}:${slotStart}`,
        });
        return JSON.stringify(result);
      }
      default:
        return JSON.stringify({ error: `Unknown tool ${tu.name}` });
    }
  }
}
