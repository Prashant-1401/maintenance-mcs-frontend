import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PmSchedulesController } from './pm-schedules.controller';
import { PmSchedulesService } from './pm-schedules.service';
import { PmScheduleEvaluatorJob } from './pm-schedule-evaluator.job';

@Module({
  imports: [NotificationsModule],
  controllers: [PmSchedulesController],
  providers: [PmSchedulesService, PmScheduleEvaluatorJob],
  exports: [PmSchedulesService],
})
export class PmSchedulesModule {}
