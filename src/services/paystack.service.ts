import crypto from 'crypto';

/**
 * Paystack card and bank payments for coin purchases on the web.
 *
 * Needs PAYSTACK_SECRET_KEY (sk_test_... or sk_live_...). The web app opens the
 * Paystack popup with the access code from [initializeTransaction]; coins are
 * credited only after [verifyTransaction] confirms the charge with Paystack,
 * either from the app or from the webhook, whichever arrives first.
 */

const API = 'https://api.paystack.co';

export type PaystackTransaction = {
  status: string; // success, failed, abandoned, ...
  reference: string;
  amount: number;
  currency: string;
  id: number;
  metadata?: { userId?: string; productId?: string } | string | null;
};

type PaystackEnvelope<T> = { status: boolean; message: string; data: T };

const secretKey = (): string | null => process.env.PAYSTACK_SECRET_KEY || null;

export const isPaystackConfigured = (): boolean => !!secretKey();

const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const key = secretKey();
  if (!key) throw new Error('Paystack is not configured');

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json()) as PaystackEnvelope<T>;

  if (!response.ok || !body.status) {
    throw new Error(body.message || `Paystack request failed (${response.status})`);
  }
  return body.data;
};

export const initializeTransaction = (params: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  metadata: { userId: string; productId: string };
}) =>
  call<{ authorization_url: string; access_code: string; reference: string }>(
    '/transaction/initialize',
    { method: 'POST', body: JSON.stringify(params) }
  );

export const verifyTransaction = (reference: string) =>
  call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);

export const metadataOf = (tx: PaystackTransaction): { userId?: string; productId?: string } => {
  if (!tx.metadata) return {};
  if (typeof tx.metadata === 'string') {
    try {
      return JSON.parse(tx.metadata);
    } catch {
      return {};
    }
  }
  return tx.metadata;
};

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export const isValidWebhookSignature = (rawBody: Buffer | undefined, signature?: string): boolean => {
  const key = secretKey();
  if (!key || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha512', key).update(rawBody).digest('hex');
  return (
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
};
