// SERVER-ONLY: Fatorak/Fawaterak payment gateway helpers.
// Docs: https://fawaterak-api.readme.io (SendPayment / createInvoiceLink + Web Hook)
//
// Env vars (server only — NEVER NEXT_PUBLIC_):
//   FATORAK_MERCHANT_ID → the Fawaterak API key (sent as Bearer to the API)
//   FATORAK_SECRET_KEY  → the vendor secret key used to verify webhook hashKey
//   FATORAK_BASE_URL    → optional override; staging is https://staging.fawaterk.com,
//                         live is https://app.fawaterk.com (default below)
import crypto from "crypto";

export const FATORAK_BASE_URL = (process.env.FATORAK_BASE_URL || "https://app.fawaterk.com").replace(/\/+$/, "");
export const CREATE_INVOICE_URL = `${FATORAK_BASE_URL}/api/v2/createInvoiceLink`;

export function fatorakApiKey(): string {
  const key = process.env.FATORAK_MERCHANT_ID;
  if (!key) throw new Error("Missing env var FATORAK_MERCHANT_ID (Fawaterak API key)");
  return key;
}

export function fatorakSecretKey(): string {
  const key = process.env.FATORAK_SECRET_KEY;
  if (!key) throw new Error("Missing env var FATORAK_SECRET_KEY (Fawaterak vendor key)");
  return key;
}

/**
 * Webhook authenticity check, per Fawaterak docs ("Web Hook" page):
 *   hashKey = HMAC_SHA256_HEX(
 *     "InvoiceId=<invoice_id>&InvoiceKey=<invoice_key>&PaymentMethod=<payment_method>",
 *     VENDOR_SECRET_KEY
 *   )
 * Used by both the "paid" and the "failed" webhook bodies.
 */
export function verifyWebhookHashKey(payload: {
  hashKey?: string;
  invoice_id?: string | number;
  invoice_key?: string;
  payment_method?: string;
}): boolean {
  if (!payload.hashKey || payload.invoice_id === undefined || !payload.invoice_key || !payload.payment_method) {
    return false;
  }
  const queryParam = `InvoiceId=${payload.invoice_id}&InvoiceKey=${payload.invoice_key}&PaymentMethod=${payload.payment_method}`;
  const expected = crypto.createHmac("sha256", fatorakSecretKey()).update(queryParam).digest("hex");
  const received = String(payload.hashKey).toLowerCase();
  const expectedLower = expected.toLowerCase();
  const a = Buffer.from(received);
  const b = Buffer.from(expectedLower);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
