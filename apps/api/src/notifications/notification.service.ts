import { Injectable } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import type { NotificationChannel } from './notification-channel.interface';

interface BreakdownNotificationInput {
  id: string;
  asset: { tag: string; name: string };
  breakdownDetail?: { symptom: string } | null;
}

interface DeviationNotificationInput {
  asset: { tag: string; name: string };
  reason: string;
  originalDueDate: Date;
  proposedDate: Date;
  raisedByName: string;
}

@Injectable()
export class NotificationService {
  private readonly channels: NotificationChannel[];

  constructor(emailChannel: EmailChannel) {
    this.channels = [emailChannel];
  }

  async notifyNewBreakdown(workOrder: BreakdownNotificationInput): Promise<void> {
    const payload = {
      subject: `New breakdown — ${workOrder.asset.tag}`,
      body: `${workOrder.asset.tag} (${workOrder.asset.name}): ${workOrder.breakdownDetail?.symptom ?? ''}`,
    };
    await Promise.all(this.channels.map((channel) => channel.send(payload)));
  }

  async notifyDeviationRaised(input: DeviationNotificationInput): Promise<void> {
    const payload = {
      subject: `Deviation note needs approval — ${input.asset.tag}`,
      body: `${input.raisedByName} requests pushing ${input.asset.tag} (${input.asset.name}) from ${input.originalDueDate.toDateString()} to ${input.proposedDate.toDateString()}. Reason: ${input.reason}`,
    };
    await Promise.all(this.channels.map((channel) => channel.send(payload)));
  }
}
