// Stripe billing: subscriptions + metered usage. Card data never touches our
// servers (Checkout is hosted), keeping us at PCI SAQ-A. Webhooks provision and
// deprovision tenants.

import Stripe from "stripe";

export interface BillingConfig {
  secretKey?: string;
  webhookSecret?: string;
  priceStarter?: string; // Stripe Price id for Starter ($399/mo)
  pricePro?: string; // Stripe Price id for Pro ($699/mo)
}

export class Billing {
  private stripe: Stripe;
  private webhookSecret: string;
  private prices: { starter?: string; pro?: string };

  constructor(cfg: BillingConfig = {}) {
    const key = cfg.secretKey ?? process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    this.stripe = new Stripe(key);
    this.webhookSecret = cfg.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";
    this.prices = {
      starter: cfg.priceStarter ?? process.env.STRIPE_PRICE_STARTER,
      pro: cfg.pricePro ?? process.env.STRIPE_PRICE_PRO,
    };
  }

  // Hosted Checkout for a new subscription.
  async createCheckout(tenantId: string, plan: "starter" | "pro", successUrl: string, cancelUrl: string) {
    const price = plan === "pro" ? this.prices.pro : this.prices.starter;
    if (!price) throw new Error(`No Stripe price configured for ${plan}`);
    return this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: tenantId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  // Report metered usage (minutes/calls over bundle) at call end.
  async reportUsage(meterEventName: string, stripeCustomerId: string, value: number) {
    return this.stripe.billing.meterEvents.create({
      event_name: meterEventName,
      payload: { stripe_customer_id: stripeCustomerId, value: String(value) },
    });
  }

  // Verify + parse an incoming webhook. Caller passes the RAW request body.
  constructEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    if (!this.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }
}

// Map a verified event to a provisioning action. Wire these to your tenant store.
export function provisioningActionFor(event: Stripe.Event): { action: string; tenantId?: string } {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      return { action: "activate_tenant", tenantId: s.client_reference_id ?? undefined };
    }
    case "invoice.paid":
      return { action: "mark_paid" };
    case "customer.subscription.deleted":
      return { action: "suspend_tenant" };
    default:
      return { action: "ignore" };
  }
}
