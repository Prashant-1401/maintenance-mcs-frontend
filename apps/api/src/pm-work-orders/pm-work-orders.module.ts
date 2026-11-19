import { Module } from '@nestjs/common';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { PmWorkOrdersController } from './pm-work-orders.controller';
import { PmWorkOrdersService } from './pm-work-orders.service';

@Module({
  imports: [WorkOrdersModule],
  controllers: [PmWorkOrdersController],
  providers: [PmWorkOrdersService],
  exports: [PmWorkOrdersService],
})
export class PmWorkOrdersModule {}
