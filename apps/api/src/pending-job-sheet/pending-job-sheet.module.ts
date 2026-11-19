import { Module } from '@nestjs/common';
import { PendingJobSheetController } from './pending-job-sheet.controller';
import { PendingJobSheetService } from './pending-job-sheet.service';

@Module({
  controllers: [PendingJobSheetController],
  providers: [PendingJobSheetService],
})
export class PendingJobSheetModule {}
