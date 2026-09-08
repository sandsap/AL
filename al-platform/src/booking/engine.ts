// Deterministic booking engine — the trust boundary. The agent proposes; this
// enforces. It re-validates availability and business rules, then writes to the
// CRM idempotently. Nothing reaches a customer's calendar except through here.

import type { BookingRequest, BookingResult, Slot, Tenant } from "../core/types.js";
import type { SchedulingProvider } from "./scheduling.js";

export class BookingEngine {
  constructor(private readonly provider: SchedulingProvider) {}

  async book(tenant: Tenant, req: BookingRequest): Promise<BookingResult> {
    const jobType = tenant.jobTypes.find((j) => j.key === req.jobTypeKey);
    if (!jobType) return { ok: false, reason: `Unknown job type: ${req.jobTypeKey}` };

    // Service-area check.
    const zip = extractZip(req.customer.address);
    if (tenant.serviceArea.length > 0 && zip && !tenant.serviceArea.includes(zip)) {
      return { ok: false, reason: `Address ${zip} is outside the service area` };
    }

    // Re-check the slot is still open (guards against the model proposing a
    // stale slot). Emergencies may book outside business hours.
    const window = dayWindow(req.slot.start);
    const open = await this.provider.getAvailability(req.jobTypeKey, window.from, window.to);
    const stillOpen = open.some((s) => s.start === req.slot.start && s.technicianId === req.slot.technicianId);
    if (!stillOpen) return { ok: false, reason: "That time was just taken — pick another slot" };

    if (!jobType.emergency && !withinBusinessHours(tenant, req.slot)) {
      return { ok: false, reason: "That time is outside business hours" };
    }

    const { id } = await this.provider.createBooking({
      jobTypeKey: req.jobTypeKey,
      slot: req.slot,
      customer: req.customer,
      notes: req.notes,
      idempotencyKey: req.idempotencyKey,
    });

    return { ok: true, bookingId: id, slot: req.slot };
  }
}

function extractZip(address: string): string | null {
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

function dayWindow(iso: string): { from: string; to: string } {
  const start = new Date(iso);
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(start);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function withinBusinessHours(tenant: Tenant, slot: Slot): boolean {
  const [openH, openM] = tenant.businessHours.open.split(":").map(Number);
  const [closeH, closeM] = tenant.businessHours.close.split(":").map(Number);
  const d = new Date(slot.start);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= openH * 60 + openM && minutes <= closeH * 60 + closeM;
}
