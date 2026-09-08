// In-memory scheduling provider for local demo + tests. Real adapters
// (HousecallProAdapter, ServiceTitanAdapter, JobberAdapter) implement the same
// interface against their HTTP APIs with OAuth + retries.

import type { Customer, Slot } from "../core/types.js";
import type { CreateBookingInput, SchedulingProvider } from "./scheduling.js";

export class MockCrmAdapter implements SchedulingProvider {
  readonly kind = "mock";
  private booked = new Map<string, { id: string; slot: Slot }>();
  private customers = new Map<string, Customer>();

  constructor(seedCustomers: Customer[] = []) {
    for (const c of seedCustomers) this.customers.set(c.phone, c);
  }

  async getAvailability(_jobTypeKey: string, fromISO?: string, _toISO?: string): Promise<Slot[]> {
    // Fixed daily slots (09:00 / 12:00 / 15:00) anchored to the DAY of `fromISO`.
    // Deterministic across calls so the booking engine's re-validation finds the
    // same slot the agent proposed.
    const day = fromISO ? new Date(fromISO) : new Date();
    const hours = [9, 12, 15];
    return hours.map((h, idx) => {
      const start = new Date(day);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      return { start: start.toISOString(), end: end.toISOString(), technicianId: `tech_${idx}` };
    });
  }

  async createBooking(input: CreateBookingInput): Promise<{ id: string }> {
    // Idempotent: same key returns the same booking id.
    const existing = this.booked.get(input.idempotencyKey);
    if (existing) return { id: existing.id };
    const id = `bk_${Math.random().toString(36).slice(2, 10)}`;
    this.booked.set(input.idempotencyKey, { id, slot: input.slot });
    return { id };
  }

  async lookupCustomer(phone: string): Promise<Customer | null> {
    return this.customers.get(phone) ?? null;
  }
}
