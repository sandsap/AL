// Tool definitions exposed to the agent. The LLM may *propose* these calls;
// side effects (especially book_job) run through deterministic services, never
// the model directly.

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_availability",
    description:
      "Look up open appointment slots for a job type within a time window. " +
      "Call this before proposing a time to the caller.",
    input_schema: {
      type: "object",
      properties: {
        jobTypeKey: { type: "string", description: "Job type key, e.g. hvac_repair" },
        fromISO: { type: "string", description: "Window start, ISO 8601" },
        toISO: { type: "string", description: "Window end, ISO 8601" },
      },
      required: ["jobTypeKey"],
    },
  },
  {
    name: "book_job",
    description:
      "Book a confirmed appointment. Only call after the caller has agreed to a " +
      "specific slot returned by get_availability. Writes to the contractor's CRM.",
    input_schema: {
      type: "object",
      properties: {
        jobTypeKey: { type: "string" },
        slotStartISO: { type: "string" },
        customerName: { type: "string" },
        customerPhone: { type: "string" },
        customerAddress: { type: "string" },
        notes: { type: "string" },
      },
      required: [
        "jobTypeKey",
        "slotStartISO",
        "customerName",
        "customerPhone",
        "customerAddress",
      ],
    },
  },
  {
    name: "lookup_customer",
    description: "Look up a returning customer by phone number for their history.",
    input_schema: {
      type: "object",
      properties: { phone: { type: "string" } },
      required: ["phone"],
    },
  },
  {
    name: "escalate",
    description:
      "Escalate to on-call staff for true emergencies or out-of-scope requests. " +
      "Use for gas leaks, flooding, no-heat in freezing weather, or an upset caller.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];
