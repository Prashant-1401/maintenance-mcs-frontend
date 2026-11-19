import { Module } from '@nestjs/common';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { PredictiveModule } from '../predictive/predictive.module';
import { PredictiveWorkOrdersController } from './predictive-work-orders.controller';
import { PredictiveWorkOrdersService } from './predictive-work-orders.service';

@Module({
  imports: [WorkOrdersModule, PredictiveModule],
  controllers: [PredictiveWorkOrdersController],
  providers: [PredictiveWorkOrdersService],
})
export class PredictiveWorkOrdersModule {}
