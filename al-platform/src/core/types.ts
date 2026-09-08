// Core domain types shared across the platform.

export type CrmKind = "housecall_pro" | "servicetitan" | "jobber" | "mock";

export interface JobType {
  key: string; // e.g. "hvac_repair"
  label: string; // e.g. "HVAC repair"
  durationMinutes: number;
  emergency: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  timezone: string; // IANA, e.g. "America/Chicago"
  businessHours: { open: string; close: string }; // "08:00" / "17:00"
  serviceArea: string[]; // ZIP codes served
  jobTypes: JobType[];
  crm: CrmKind;
  // Mandatory AI disclosure spoken at call start (TCPA / consent).
  disclosure: string;
}

export interface Slot {
  start: string; // ISO 8601
  end: string; // ISO 8601
  technicianId: string;
}

export interface Customer {
  name: string;
  phone: string;
  address: string;
}

export interface BookingRequest {
  tenantId: string;
  callId: string;
  customer: Customer;
  jobTypeKey: string;
  slot: Slot;
  notes?: string;
  // Dedupe key so retries never double-book a calendar.
  idempotencyKey: string;
}

export interface BookingResult {
  ok: boolean;
  bookingId?: string;
  slot?: Slot;
  reason?: string;
}

export interface CallContext {
  callId: string;
  tenant: Tenant;
  fromNumber: string;
}
