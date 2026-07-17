// SERVER-ONLY: Fatorak/Fawaterak payment gateway helpers.
// Public docs: https://fawaterak-api.readme.io (SendPayment/createInvoiceLink + Web Hook)
//
// Authentication is OAuth 2.0 **client_credentials** (Laravel Passport):
//   POST {base}/oauth/token  { grant_type=client_credentials, client_id, client_secret }
//   → { token_type: "Bearer", expires_in, access_token }
// The short-lived access token is then sent as `Authorization: Bearer <token>`
// on API calls (e.g. createInvoiceLink). Confirmed live against
// https://app.fawaterk.com/oauth/token.
//
// Env vars (server only — NEVER NEXT_PUBLIC_):
//   FATORAK_MERCHANT_ID  → OAuth client_id
//   FATORAK_SECRET_KEY   → OAuth client_secret  (also the webhook "vendor key"
//                          in most accounts — see fatorakWebhookSecret)
//   FATORAK_WEBHOOK_SECRET → OPTIONAL: only if your dashboard shows a separate
//                          webhook/vendor key distinct from the client secret
//   FATORAK_BASE_URL     → optional override; staging https://staging.fawaterk.com,
//                          live https://app.fawaterk.com (default)
import crypto from "crypto";

export const FATORAK_BASE_URL = (process.env.FATORAK_BASE_URL || "https://app.fawaterk.com").replace(/\/+$/, "");
export const OAUTH_TOKEN_URL = `${FATORAK_BASE_URL}/oauth/token`;
export const CREATE_INVOICE_PATH = "/api/v2/createInvoiceLink";

function clientId(): string {
  const v = process.env.FATORAK_MERCHANT_ID;
  if (!v) throw new Error("Missing env var FATORAK_MERCHANT_ID (Fatorak OAuth client_id)");
  return v;
}

function clientSecret(): string {
  const v = process.env.FATORAK_SECRET_KEY;
  if (!v) throw new Error("Missing env var FATORAK_SECRET_KEY (Fatorak OAuth client_secret)");
  return v;
}

/** Secret used to verify webhook hashKey (vendor key). */
export function fatorakWebhookSecret(): string {
  return process.env.FATORAK_WEBHOOK_SECRET || clientSecret();
}

// ---------------------------------------------------------------- OAuth token
// Token is cached at module scope (survives warm serverless invocations) and
// refreshed before expiry. Concurrent callers share a single in-flight request.
let cachedToken: { token: string; expiresAt: number } | null = null;
let inflightToken: Promise<string> | null = null;

async function requestAccessToken(): Promise<string> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId(),
      client_secret: clientSecret()
    })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(`Fatorak token request failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
  }
  // Refresh 60s early, never less than 30s total
  const expiresInSec = Number(data.expires_in) || 3600;
  cachedToken = {
    token: String(data.access_token),
    expiresAt: Date.now() + Math.max(expiresInSec - 60, 30) * 1000
  };
  return cachedToken.token;
}

export function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return Promise.resolve(cachedToken.token);
  }
  if (!inflightToken) {
    inflightToken = requestAccessToken().finally(() => {
      inflightToken = null;
    });
  }
  return inflightToken;
}

// ------------------------------------------------------------------ API calls
/** Authenticated POST to the Fatorak API with automatic OAuth token handling.
 *  Retries once with a fresh token if the server rejects (401) — covers
 *  token revocation/rotation that local caching can't foresee. */
export async function fatorakPost(path: string, body: unknown): Promise<Response> {
  const call = (token: string) =>
    fetch(`${FATORAK_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

  let res = await call(await getAccessToken());
  if (res.status === 401) {
    res = await call(await getAccessToken(true));
  }
  return res;
}

// ------------------------------------------------------------------- Webhooks
/**
 * Paid/failed webhook authenticity check — per the official "Web Hook" page:
 *   hashKey = HMAC_SHA256_HEX(
 *     "InvoiceId=<invoice_id>&InvoiceKey=<invoice_key>&PaymentMethod=<payment_method>",
 *     VENDOR_SECRET_KEY
 *   )
 * (Re-verified against the published docs; the page still documents this.)
 */
export function verifyInvoiceWebhookHashKey(payload: {
  hashKey?: string;
  invoice_id?: string | number;
  invoice_key?: string;
  payment_method?: string;
}): boolean {
  if (!payload.hashKey || payload.invoice_id === undefined || !payload.invoice_key || !payload.payment_method) {
    return false;
  }
  const queryParam = `InvoiceId=${payload.invoice_id}&InvoiceKey=${payload.invoice_key}&PaymentMethod=${payload.payment_method}`;
  return safeHmacEqual(queryParam, payload.hashKey);
}

/**
 * Expiry/cancel webhook (fawry/aman/masary) — per the same docs page:
 *   hashKey = HMAC_SHA256_HEX("referenceId=<id>&PaymentMethod=<method>", VENDOR_KEY)
 */
export function verifyExpiryWebhookHashKey(payload: {
  hashKey?: string;
  referenceId?: string | number;
  paymentMethod?: string;
}): boolean {
  if (!payload.hashKey || payload.referenceId === undefined || !payload.paymentMethod) {
    return false;
  }
  const queryParam = `referenceId=${payload.referenceId}&PaymentMethod=${payload.paymentMethod}`;
  return safeHmacEqual(queryParam, payload.hashKey);
}

function safeHmacEqual(queryParam: string, hashKey: string): boolean {
  const expected = crypto
    .createHmac("sha256", fatorakWebhookSecret())
    .update(queryParam)
    .digest("hex")
    .toLowerCase();
  const received = String(hashKey).toLowerCase();
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
