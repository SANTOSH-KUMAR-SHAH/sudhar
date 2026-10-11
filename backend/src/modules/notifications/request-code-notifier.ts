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
    console.log(`[notify] request code ${message.code} queued for ${message.phone}`);
  }
}
