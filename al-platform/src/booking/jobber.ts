// Jobber scheduling adapter (GraphQL). Same SchedulingProvider interface as the
// mock and Housecall Pro adapters.
//
// ⚠️ VERIFY BEFORE PRODUCTION: Jobber uses an OAuth2 GraphQL API
// (https://api.getjobber.com/api/graphql) with an X-JOBBER-GRAPHQL-VERSION
// header. The queries/mutations and field names below are the *shape* of the
// integration and MUST be confirmed against the current Jobber GraphQL schema.
// Everything Jobber-specific is centralized here. Marked `// VERIFY`.

import type { Customer, Slot } from "../core/types.js";
import type { CreateBookingInput, SchedulingProvider } from "./scheduling.js";

export interface JobberConfig {
  accessToken?: string;
  apiVersion?: string;
  endpoint?: string;
}

export class JobberAdapter implements SchedulingProvider {
  readonly kind = "jobber";
  private token: string;
  private apiVersion: string;
  private endpoint: string;

  constructor(cfg: JobberConfig = {}) {
    const token = cfg.accessToken ?? process.env.JOBBER_ACCESS_TOKEN;
    if (!token) throw new Error("JOBBER_ACCESS_TOKEN not set");
    this.token = token;
    this.apiVersion = cfg.apiVersion ?? process.env.JOBBER_API_VERSION ?? "2023-11-15"; // VERIFY
    this.endpoint = cfg.endpoint ?? process.env.JOBBER_ENDPOINT ?? "https://api.getjobber.com/api/graphql";
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const resp = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "X-JOBBER-GRAPHQL-VERSION": this.apiVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await resp.json()) as { data?: T; errors?: unknown };
    if (!resp.ok || json.errors) {
      throw new Error(`Jobber GraphQL error: ${resp.status} ${JSON.stringify(json.errors)}`);
    }
    return json.data as T;
  }

  async lookupCustomer(phone: string): Promise<Customer | null> {
    // VERIFY: clients query + field names.
    const data = await this.graphql<{ clients: { nodes: RawClient[] } }>(
      `query($q:String!){ clients(searchTerm:$q, first:1){ nodes { id firstName lastName phones { number } billingAddress { street } } } }`,
      { q: phone },
    );
    const c = data.clients?.nodes?.[0];
    return c ? mapClient(c) : null;
  }

  async getAvailability(_jobTypeKey: string, fromISO: string, _toISO: string): Promise<Slot[]> {
    // Jobber has no "open slots" endpoint — availability is derived from working
    // hours minus already-scheduled visits. Production: query visits for the day
    // and subtract them. Here we return candidate slots from configurable working
    // hours so the booking engine has something to validate against. VERIFY.
    const day = new Date(fromISO);
    const openH = Number(process.env.JOBBER_OPEN_HOUR ?? 8);
    const closeH = Number(process.env.JOBBER_CLOSE_HOUR ?? 18);
    const stepH = 3;
    const slots: Slot[] = [];
    for (let h = openH; h + Math.ceil(stepH / 2) <= closeH; h += stepH) {
      const start = new Date(day);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start.getTime() + 90 * 60 * 1000);
      slots.push({ start: start.toISOString(), end: end.toISOString(), technicianId: "unassigned" });
    }
    return slots;
  }

  async createBooking(input: CreateBookingInput): Promise<{ id: string }> {
    const clientId = await this.ensureClient(input);
    // VERIFY: mutation name + input shape (jobCreate / visitCreate).
    const data = await this.graphql<{ jobCreate: { job: { id: string }; userErrors: { message: string }[] } }>(
      `mutation($input:JobCreateInput!){ jobCreate(input:$input){ job { id } userErrors { message } } }`,
      {
        input: {
          clientId,
          title: input.jobTypeKey,
          instructions: input.notes ?? "",
          visits: [{ startAt: input.slot.start, endAt: input.slot.end }],
        },
      },
    );
    const errs = data.jobCreate?.userErrors ?? [];
    if (errs.length) throw new Error(`Jobber jobCreate: ${errs.map((e) => e.message).join("; ")}`);
    return { id: data.jobCreate.job.id };
  }

  private async ensureClient(input: CreateBookingInput): Promise<string> {
    const existing = await this.lookupCustomer(input.customer.phone);
    if (existing && (existing as RawClientRef).id) return (existing as RawClientRef).id!;
    const [firstName, ...rest] = input.customer.name.split(" ");
    // VERIFY: clientCreate mutation + input shape.
    const data = await this.graphql<{ clientCreate: { client: { id: string } } }>(
      `mutation($input:ClientCreateInput!){ clientCreate(input:$input){ client { id } } }`,
      {
        input: {
          firstName,
          lastName: rest.join(" ") || null,
          phones: [{ number: input.customer.phone, primary: true }],
          billingAddress: { street: input.customer.address },
        },
      },
    );
    return data.clientCreate.client.id;
  }
}

// --- Raw GraphQL shapes + mappers (one place to fix field names) ---
interface RawClient {
  id: string;
  firstName?: string;
  lastName?: string;
  phones?: { number: string }[];
  billingAddress?: { street?: string };
}
type RawClientRef = Customer & { id?: string };

function mapClient(c: RawClient): Customer {
  const ref: RawClientRef = {
    name: [c.firstName, c.lastName].filter(Boolean).join(" "),
    phone: c.phones?.[0]?.number ?? "",
    address: c.billingAddress?.street ?? "",
  };
  ref.id = c.id;
  return ref;
}
