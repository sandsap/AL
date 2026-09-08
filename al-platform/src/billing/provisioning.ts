// Tenant provisioning state driven by Stripe webhooks. Activate on checkout,
// suspend on cancellation, record payments. In-memory here; back it with the
// `subscriptions` table in production.

import type Stripe from "stripe";
import { provisioningActionFor } from "./stripe.js";

export type TenantStatus = "pending" | "active" | "past_due" | "suspended";

export interface ProvisioningState {
  tenantId: string;
  status: TenantStatus;
  stripeCustomerId?: string;
  updatedAt: string;
}

const store = new Map<string, ProvisioningState>();

export function getProvisioning(tenantId: string): ProvisioningState {
  return store.get(tenantId) ?? { tenantId, status: "pending", updatedAt: new Date(0).toISOString() };
}

function set(tenantId: string, patch: Partial<ProvisioningState>): ProvisioningState {
  const next: ProvisioningState = {
    ...getProvisioning(tenantId),
    ...patch,
    tenantId,
    updatedAt: new Date().toISOString(),
  };
  store.set(tenantId, next);
  return next;
}

// Apply a verified Stripe event to provisioning state. Returns what changed.
export function applyStripeEvent(event: Stripe.Event): { action: string; state?: ProvisioningState } {
  const decided = provisioningActionFor(event);

  switch (decided.action) {
    case "activate_tenant": {
      if (!decided.tenantId) return { action: "activate_tenant:no_tenant" };
      const s = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof s.customer === "string" ? s.customer : undefined;
      return { action: "activate_tenant", state: set(decided.tenantId, { status: "active", stripeCustomerId: customerId }) };
    }
    case "mark_paid": {
      const inv = event.data.object as Stripe.Invoice;
      const tenantId = tenantIdFromCustomer(typeof inv.customer === "string" ? inv.customer : undefined);
      if (!tenantId) return { action: "mark_paid:unmapped_customer" };
      return { action: "mark_paid", state: set(tenantId, { status: "active" }) };
    }
    case "suspend_tenant": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = tenantIdFromCustomer(typeof sub.customer === "string" ? sub.customer : undefined);
      if (!tenantId) return { action: "suspend_tenant:unmapped_customer" };
      return { action: "suspend_tenant", state: set(tenantId, { status: "suspended" }) };
    }
    default:
      return { action: "ignore" };
  }
}

// Reverse lookup customer -> tenant (invoice/subscription events carry the
// customer, not our tenant id). Backed by the activate step's mapping.
function tenantIdFromCustomer(customerId?: string): string | undefined {
  if (!customerId) return undefined;
  for (const s of store.values()) if (s.stripeCustomerId === customerId) return s.tenantId;
  return undefined;
}
