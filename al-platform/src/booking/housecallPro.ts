// Housecall Pro scheduling adapter (real HTTP). Implements the same
// SchedulingProvider interface as the mock, so the agent and booking engine are
// unchanged.
//
// ⚠️ VERIFY BEFORE PRODUCTION: Housecall Pro's API requires a Pro-plan API key
// and partner access. The exact endpoint paths, auth scheme, and JSON field
// names below are the *shape* of the integration and MUST be confirmed against
// the current Housecall Pro API docs. Every API specific is centralized here so
// corrections are one-file changes. Endpoints marked `// VERIFY`.

import type { Customer, Slot } from "../core/types.js";
import type { CreateBookingInput, SchedulingProvider } from "./scheduling.js";

export interface HousecallProConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class HousecallProAdapter implements SchedulingProvider {
  readonly kind = "housecall_pro";
  private apiKey: string;
  private baseUrl: string;

  constructor(cfg: HousecallProConfig = {}) {
    const key = cfg.apiKey ?? process.env.HOUSECALL_PRO_API_KEY;
    if (!key) throw new Error("HOUSECALL_PRO_API_KEY not set");
    this.apiKey = key;
    this.baseUrl = cfg.baseUrl ?? process.env.HOUSECALL_PRO_BASE_URL ?? "https://api.housecallpro.com";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        // VERIFY: Housecall Pro auth header scheme (Token vs Bearer).
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Housecall Pro ${init.method ?? "GET"} ${path} -> ${resp.status} ${body}`);
    }
    return (await resp.json()) as T;
  }

  async getAvailability(jobTypeKey: string, fromISO: string, toISO: string): Promise<Slot[]> {
    // VERIFY: availability/scheduling endpoint. Housecall exposes employee
    // schedules; open slots may need to be derived from working hours minus
    // booked jobs. This maps whatever slot list the endpoint returns.
    const query = new URLSearchParams({ job_type: jobTypeKey, start: fromISO, end: toISO });
    const data = await this.request<{ available_slots?: RawSlot[] }>(`/schedule/availability?${query}`); // VERIFY
    return (data.available_slots ?? []).map(mapSlot);
  }

  async createBooking(input: CreateBookingInput): Promise<{ id: string }> {
    // Ensure the customer exists (create if new), then create the job.
    const customerId = await this.upsertCustomer(input.customer);
    const job = await this.request<{ id: string }>(`/jobs`, {
      // VERIFY: jobs endpoint + payload shape.
      method: "POST",
      // Idempotency-Key guards against double-booking on retries. VERIFY header support.
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        customer_id: customerId,
        job_type: input.jobTypeKey,
        schedule: { start_time: input.slot.start, end_time: input.slot.end },
        assigned_employee_ids: [input.slot.technicianId],
        note: input.notes,
      }),
    });
    return { id: job.id };
  }

  async lookupCustomer(phone: string): Promise<Customer | null> {
    const query = new URLSearchParams({ q: phone });
    const data = await this.request<{ customers?: RawCustomer[] }>(`/customers?${query}`); // VERIFY
    const c = data.customers?.[0];
    return c ? mapCustomer(c) : null;
  }

  private async upsertCustomer(customer: Customer): Promise<string> {
    const existing = await this.lookupCustomer(customer.phone);
    if (existing && (existing as RawCustomerRef).id) return (existing as RawCustomerRef).id!;
    const [firstName, ...rest] = customer.name.split(" ");
    const created = await this.request<{ id: string }>(`/customers`, {
      method: "POST", // VERIFY
      body: JSON.stringify({
        first_name: firstName,
        last_name: rest.join(" ") || undefined,
        mobile_number: customer.phone,
        addresses: [{ street: customer.address }],
      }),
    });
    return created.id;
  }
}

// --- Raw API shapes + mappers (the one place to fix field names) ---
interface RawSlot {
  start_time: string;
  end_time: string;
  employee_id: string;
}
interface RawCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  addresses?: { street?: string }[];
}
type RawCustomerRef = Customer & { id?: string };

function mapSlot(s: RawSlot): Slot {
  return { start: s.start_time, end: s.end_time, technicianId: s.employee_id };
}
function mapCustomer(c: RawCustomer): Customer {
  const ref: RawCustomerRef = {
    name: [c.first_name, c.last_name].filter(Boolean).join(" "),
    phone: c.mobile_number ?? "",
    address: c.addresses?.[0]?.street ?? "",
  };
  ref.id = c.id;
  return ref;
}
