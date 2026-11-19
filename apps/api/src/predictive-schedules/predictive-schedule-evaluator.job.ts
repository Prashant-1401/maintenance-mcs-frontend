import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PredictiveSchedulesService } from './predictive-schedules.service';

@Injectable()
export class PredictiveScheduleEvaluatorJob {
  constructor(private readonly predictiveSchedules: PredictiveSchedulesService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.predictiveSchedules.evaluateDueSchedules();
  }
}
