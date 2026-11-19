import { Module } from '@nestjs/common';
import { EmailChannel } from './email.channel';
import { NotificationService } from './notification.service';

@Module({
  providers: [EmailChannel, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
