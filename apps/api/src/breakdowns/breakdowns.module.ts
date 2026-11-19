import { Module } from '@nestjs/common';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FileExportModule } from '../common/file-export.module';
import { BreakdownsController } from './breakdowns.controller';
import { BreakdownsService } from './breakdowns.service';

@Module({
  imports: [WorkOrdersModule, NotificationsModule, FileExportModule],
  controllers: [BreakdownsController],
  providers: [BreakdownsService],
  exports: [BreakdownsService],
})
export class BreakdownsModule {}
