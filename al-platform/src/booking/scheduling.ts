// Adapter interface every CRM integration implements. Adding a new field-service
// platform = one new implementation; the agent and booking engine never change.

import type { Customer, Slot } from "../core/types.js";

export interface CreateBookingInput {
  jobTypeKey: string;
  slot: Slot;
  customer: Customer;
  notes?: string;
  idempotencyKey: string;
}

export interface SchedulingProvider {
  readonly kind: string;
  getAvailability(jobTypeKey: string, fromISO: string, toISO: string): Promise<Slot[]>;
  createBooking(input: CreateBookingInput): Promise<{ id: string }>;
  lookupCustomer(phone: string): Promise<Customer | null>;
}
