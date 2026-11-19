import { Injectable, Logger } from '@nestjs/common';
import type { NotificationChannel, NotificationPayload } from './notification-channel.interface';

@Injectable()
export class EmailChannel implements NotificationChannel {
  private readonly logger = new Logger('EmailChannel (stub)');

  async send(payload: NotificationPayload): Promise<void> {
    this.logger.log(`Would email maintenance team — ${payload.subject}: ${payload.body}`);
  }
}
