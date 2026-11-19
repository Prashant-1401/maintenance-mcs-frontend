import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PmSchedulesService } from './pm-schedules.service';

@Injectable()
export class PmScheduleEvaluatorJob {
  constructor(private readonly pmSchedules: PmSchedulesService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.pmSchedules.evaluateDueSchedules();
  }
}
