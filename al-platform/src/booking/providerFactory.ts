// Selects the scheduling adapter for a tenant. Add new CRMs here as their
// adapters land (ServiceTitan, Jobber). Falls back to the in-memory mock.

import type { Tenant } from "../core/types.js";
import type { SchedulingProvider } from "./scheduling.js";
import { MockCrmAdapter } from "./mockCrm.js";
import { HousecallProAdapter } from "./housecallPro.js";
import { JobberAdapter } from "./jobber.js";

export function makeSchedulingProvider(tenant: Tenant): SchedulingProvider {
  switch (tenant.crm) {
    case "housecall_pro":
      return new HousecallProAdapter();
    case "jobber":
      return new JobberAdapter();
    // case "servicetitan": return new ServiceTitanAdapter();
    case "mock":
    default:
      return new MockCrmAdapter();
  }
}
