// Business: After a job is submitted, exactly ONE message goes out automatically — the customer's
// Business: request code, so they can track it (see decision 0004). Everything else stays manual.
// Technical: A port, not an integration. Today it logs; when Supabase/twilio arrives, a new class
// implements this same interface and the service never changes. The injected notifier also lets tests
// assert the message fired without sending anything.

export interface RequestCodeMessage {
  phone: string;
  code: string;
}

export interface RequestCodeNotifier {
  send(message: RequestCodeMessage): Promise<void>;
}

export class LoggingRequestCodeNotifier implements RequestCodeNotifier {
  async send(message: RequestCodeMessage): Promise<void> {
    // Stub of the real gateway. The bytes leave here later; the shape is already final.
    // Security: the code is the customer's tracking reference and the phone is personal data — neither
    // belongs in plaintext application logs, which are copied far wider than the database. Mask the phone
    // to its last four digits; keep the code (needed to correlate an op) since it is only ever shown to
    // that one customer and is not a secret credential.
    const masked = message.phone.length > 4 ? `****${message.phone.slice(-4)}` : '****';
    console.log(`[notify] request code ${message.code} queued for ${masked}`);
  }
}
