import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export interface PaymentEvent {
  providerRef: string;
  status: 'SUCCEEDED' | 'FAILED';
}

/**
 * Adapter for a payment acquirer (bank ELQR / card acquiring).
 * A production adapter (e.g. MBank, Optima, Demir) implements the same contract.
 */
export interface PaymentProvider {
  readonly name: string;
  createPayment(input: {
    paymentId: string;
    orderNumber: string;
    amountKgs: number;
    description: string;
  }): Promise<{ providerRef: string; payUrl: string }>;
  refund(input: { providerRef: string; amountKgs: number }): Promise<void>;
  /** Returns the event if the signature is valid, otherwise null. */
  parseWebhook(headers: Record<string, unknown>, rawBody: string): PaymentEvent | null;
}

export function signPayload(rawBody: string) {
  return createHmac('sha256', config.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
}

/**
 * Development provider: serves its own "bank" page at /mock-pay/:ref and sends
 * signed webhooks exactly like a real acquirer would.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  refunds: { providerRef: string; amountKgs: number }[] = [];

  async createPayment(input: { paymentId: string }) {
    const providerRef = `mock_${input.paymentId}`;
    return { providerRef, payUrl: `${config.PUBLIC_URL}/mock-pay/${providerRef}` };
  }

  async refund(input: { providerRef: string; amountKgs: number }) {
    this.refunds.push(input);
  }

  parseWebhook(headers: Record<string, unknown>, rawBody: string): PaymentEvent | null {
    const signature = String(headers['x-signature'] ?? '');
    const expected = signPayload(rawBody);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }
    const body = JSON.parse(rawBody) as Partial<PaymentEvent>;
    if (!body.providerRef || (body.status !== 'SUCCEEDED' && body.status !== 'FAILED')) return null;
    return { providerRef: body.providerRef, status: body.status };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
