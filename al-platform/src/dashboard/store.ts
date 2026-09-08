// Call store + metrics for the owner dashboard. In-memory with seeded EXAMPLE
// data so the dashboard renders in a realistic working state out of the box.
// Production: back this with the `calls`/`bookings` Postgres tables.

export interface TranscriptLine {
  role: "caller" | "al";
  text: string;
}

export type CallOutcome = "booked" | "message" | "escalated";

export interface CallRecord {
  id: string;
  tenantId: string;
  fromNumber: string;
  startedAt: string; // ISO
  durationSec: number;
  afterHours: boolean;
  outcome: CallOutcome;
  jobType?: string;
  jobValueUsd?: number;
  bookingId?: string;
  latencyP95Ms: number;
  transcript: TranscriptLine[];
}

export interface Metrics {
  callsHandled: number;
  jobsBooked: number;
  bookingRatePct: number;
  revenueCapturedUsd: number;
  afterHoursCalls: number;
  avgLatencyMs: number;
  escalated: number;
}

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

// EXAMPLE data — clearly not real customer calls.
const SEED: CallRecord[] = [
  {
    id: "call_1042", tenantId: "t_demo", fromNumber: "+1 (512) 555-0142", startedAt: hoursAgo(1),
    durationSec: 168, afterHours: false, outcome: "booked", jobType: "HVAC repair", jobValueUsd: 480,
    bookingId: "bk_9f2a", latencyP95Ms: 720,
    transcript: [
      { role: "al", text: "Lone Star Heating and Air — I'm an AI assistant and this call may be recorded. How can I help?" },
      { role: "caller", text: "My furnace quit and the house is freezing." },
      { role: "al", text: "Sorry to hear that — I can get a tech out today at 3 PM. Does that work?" },
      { role: "caller", text: "Yes please." },
      { role: "al", text: "Booked. You'll get a text confirmation shortly." },
    ],
  },
  {
    id: "call_1041", tenantId: "t_demo", fromNumber: "+1 (512) 555-0197", startedAt: hoursAgo(3),
    durationSec: 205, afterHours: false, outcome: "booked", jobType: "Seasonal tune-up", jobValueUsd: 189,
    bookingId: "bk_7c11", latencyP95Ms: 690,
    transcript: [
      { role: "al", text: "Thanks for calling Lone Star — how can I help?" },
      { role: "caller", text: "I'd like to schedule my A/C tune-up before summer." },
      { role: "al", text: "Great — I have Thursday at 10 AM or Friday at 1 PM." },
      { role: "caller", text: "Thursday works." },
      { role: "al", text: "You're all set for Thursday at 10." },
    ],
  },
  {
    id: "call_1040", tenantId: "t_demo", fromNumber: "+1 (512) 555-0175", startedAt: hoursAgo(9),
    durationSec: 96, afterHours: true, outcome: "escalated", jobType: "HVAC repair", latencyP95Ms: 760,
    transcript: [
      { role: "al", text: "Lone Star Heating and Air, this call may be recorded — how can I help?" },
      { role: "caller", text: "I smell gas near the furnace." },
      { role: "al", text: "That's an emergency — I'm connecting you to our on-call technician right now. Please step outside." },
    ],
  },
  {
    id: "call_1039", tenantId: "t_demo", fromNumber: "+1 (512) 555-0123", startedAt: hoursAgo(14),
    durationSec: 142, afterHours: true, outcome: "booked", jobType: "HVAC repair", jobValueUsd: 512,
    bookingId: "bk_5d90", latencyP95Ms: 740,
    transcript: [
      { role: "al", text: "Lone Star Heating and Air — how can I help?" },
      { role: "caller", text: "No heat upstairs, can someone come tomorrow morning?" },
      { role: "al", text: "I can do 8 AM tomorrow. Booked — confirmation on its way." },
    ],
  },
  {
    id: "call_1038", tenantId: "t_demo", fromNumber: "+1 (512) 555-0161", startedAt: hoursAgo(20),
    durationSec: 88, afterHours: false, outcome: "message", latencyP95Ms: 705,
    transcript: [
      { role: "al", text: "Thanks for calling Lone Star — how can I help?" },
      { role: "caller", text: "Just asking about a quote for a full system replacement." },
      { role: "al", text: "I'll have someone call you back with pricing. What's the best number?" },
    ],
  },
  {
    id: "call_1037", tenantId: "t_demo", fromNumber: "+1 (512) 555-0188", startedAt: hoursAgo(26),
    durationSec: 176, afterHours: false, outcome: "booked", jobType: "HVAC repair", jobValueUsd: 640,
    bookingId: "bk_3a02", latencyP95Ms: 710,
    transcript: [
      { role: "al", text: "Lone Star Heating and Air — how can I help?" },
      { role: "caller", text: "A/C is blowing warm air." },
      { role: "al", text: "Likely a capacitor or low refrigerant — I've booked a diagnostic for 2 PM today." },
    ],
  },
];

const calls: CallRecord[] = [...SEED];

export function listCalls(tenantId: string): CallRecord[] {
  return calls
    .filter((c) => c.tenantId === tenantId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getCall(tenantId: string, id: string): CallRecord | undefined {
  return calls.find((c) => c.tenantId === tenantId && c.id === id);
}

export function addCall(record: CallRecord): void {
  calls.unshift(record);
}

export function metrics(tenantId: string): Metrics {
  const t = listCalls(tenantId);
  const booked = t.filter((c) => c.outcome === "booked");
  const revenue = booked.reduce((sum, c) => sum + (c.jobValueUsd ?? 0), 0);
  const avgLatency = t.length ? Math.round(t.reduce((s, c) => s + c.latencyP95Ms, 0) / t.length) : 0;
  return {
    callsHandled: t.length,
    jobsBooked: booked.length,
    bookingRatePct: t.length ? Math.round((booked.length / t.length) * 100) : 0,
    revenueCapturedUsd: revenue,
    afterHoursCalls: t.filter((c) => c.afterHours).length,
    avgLatencyMs: avgLatency,
    escalated: t.filter((c) => c.outcome === "escalated").length,
  };
}
