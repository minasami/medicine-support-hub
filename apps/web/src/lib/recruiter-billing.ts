/**
 * Company recruiter billing — calls the existing Vercel handler.
 * medicinesupport.app is Appwrite Sites and does not run /api/billing.
 * Do not add a second Stripe stack or a new entitlements table.
 *
 * @see docs/recruiter-shortlist-stripe.md
 * @see api/billing.js
 */

export const RECRUITER_BILLING_ORIGIN =
  "https://medicine-support-hub.vercel.app";

export const SHORTLIST_UNLOCK_MINOR = 2900;
export const SHORTLIST_UNLOCK_SKU = "shortlist_unlock";

export type CheckoutResult = { url: string };

export async function startRecruiterCheckout(
  paymentRequestId: string,
  accessToken: string,
): Promise<CheckoutResult> {
  const response = await fetch(
    `${RECRUITER_BILLING_ORIGIN}/api/billing?action=checkout`,
    {
      method: "POST",
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payment_request_id: paymentRequestId }),
    },
  );
  const data = (await response.json().catch(() => ({}))) as {
    url?: string;
    message?: string;
  };
  if (!response.ok || !data.url) {
    throw new Error(data.message || "Could not start checkout.");
  }
  return { url: data.url };
}
