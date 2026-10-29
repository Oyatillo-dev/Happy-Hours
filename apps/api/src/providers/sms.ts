export interface SmsProvider {
  send(phone: string, text: string): Promise<void>;
}

/** Prints messages to the log. Replace with a local SMS aggregator in production. */
class ConsoleSmsProvider implements SmsProvider {
  sent: { phone: string; text: string }[] = [];
  async send(phone: string, text: string) {
    this.sent.push({ phone, text });
    if (process.env.NODE_ENV !== 'test') console.info(`[sms] ${phone}: ${text}`);
  }
}

export const smsProvider = new ConsoleSmsProvider();
