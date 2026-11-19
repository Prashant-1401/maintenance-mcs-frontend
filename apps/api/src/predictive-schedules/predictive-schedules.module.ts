import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PredictiveSchedulesController } from './predictive-schedules.controller';
import { PredictiveSchedulesService } from './predictive-schedules.service';
import { PredictiveScheduleEvaluatorJob } from './predictive-schedule-evaluator.job';

@Module({
  imports: [NotificationsModule],
  controllers: [PredictiveSchedulesController],
  providers: [PredictiveSchedulesService, PredictiveScheduleEvaluatorJob],
  exports: [PredictiveSchedulesService],
})
export class PredictiveSchedulesModule {}
