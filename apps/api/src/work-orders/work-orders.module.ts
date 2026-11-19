import { Module } from '@nestjs/common';
import { WorkOrderStatusService } from './work-order-status.service';
import { WorkOrderCompletionService } from './work-order-completion.service';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';

@Module({
  controllers: [WorkOrdersController],
  providers: [WorkOrderStatusService, WorkOrderCompletionService, WorkOrdersService],
  exports: [WorkOrderStatusService, WorkOrderCompletionService],
})
export class WorkOrdersModule {}
