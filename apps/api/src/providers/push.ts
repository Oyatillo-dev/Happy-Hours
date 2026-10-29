import { config } from '../config.js';

export interface PushMessage {
  to: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushProvider {
  send(message: PushMessage): Promise<void>;
}

class ConsolePushProvider implements PushProvider {
  async send(message: PushMessage) {
    if (config.NODE_ENV !== 'test') console.info(`[push] ${message.to.length} device(s): ${message.title}`);
  }
}

/** Expo push service; the mobile app registers Expo push tokens. */
class ExpoPushProvider implements PushProvider {
  async send(message: PushMessage) {
    if (!message.to.length) return;
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        message.to.map((to) => ({ to, title: message.title, body: message.body, data: message.data })),
      ),
    });
    if (!res.ok) console.error(`[push] expo responded ${res.status}`);
  }
}

export const pushProvider: PushProvider =
  config.PUSH_PROVIDER === 'expo' ? new ExpoPushProvider() : new ConsolePushProvider();
