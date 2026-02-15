import type Stripe from "stripe";
import type { StripeClient } from "./interpreter";

/**
 * Wraps the official Stripe SDK into a {@link StripeClient}.
 *
 * Uses `stripe.rawRequest()` to send requests, preserving the SDK's
 * built-in authentication, retries, and telemetry.
 *
 * For GET/DELETE requests, params are encoded as query string parameters
 * on the path, since `rawRequest` only accepts body params on POST.
 *
 * @param stripe - A configured Stripe SDK instance.
 * @returns A {@link StripeClient} adapter.
 */
export function wrapStripeSdk(stripe: Stripe): StripeClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();

      if (upperMethod === "POST") {
        // POST: params go in the request body
        return stripe.rawRequest(upperMethod, path, params ?? undefined);
      }

      // GET/DELETE: encode params as query string
      let finalPath = path;
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString();
        finalPath = `${path}?${qs}`;
      }
      return stripe.rawRequest(upperMethod, finalPath);
    },
  };
}
