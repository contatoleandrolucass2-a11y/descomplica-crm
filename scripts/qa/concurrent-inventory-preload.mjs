import { check } from "./concurrent-core.mjs";
import {
  assertLocalQaEnvironment,
  createQaInventoryFetch,
  verifySyntheticInventoryUpstream,
} from "./concurrent-inventory.mjs";

assertLocalQaEnvironment();
check(
  process.env.QA_E2E_LOCAL_ONLY === "true" &&
    process.env.AUTH_LOCAL_INSECURE_LOOPBACK_QA === "true",
  "qa_preload_local_contract_required",
);
const options = {
  appOrigin: process.env.APP_ORIGIN,
  supabaseOrigin: process.env.SUPABASE_URL,
  upstreamOrigin: process.env.QA_CONCURRENT_INVENTORY_ORIGIN,
};
const guardedFetch = createQaInventoryFetch(options);
await verifySyntheticInventoryUpstream(options.upstreamOrigin, guardedFetch);
globalThis.fetch = guardedFetch;
