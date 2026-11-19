export interface NotificationPayload {
  subject: string;
  body: string;
}

/**
 * Delivery mechanism for a notification. `EmailChannel` today just logs — swap in a real
 * SMTP/API implementation later without touching NotificationService or its callers.
 */
export interface NotificationChannel {
  send(payload: NotificationPayload): Promise<void>;
}
