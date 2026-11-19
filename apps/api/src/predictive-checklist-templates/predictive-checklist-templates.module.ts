import { Module } from '@nestjs/common';
import { FileExportModule } from '../common/file-export.module';
import { PredictiveChecklistTemplatesController } from './predictive-checklist-templates.controller';
import { PredictiveChecklistTemplatesService } from './predictive-checklist-templates.service';

@Module({
  imports: [FileExportModule],
  controllers: [PredictiveChecklistTemplatesController],
  providers: [PredictiveChecklistTemplatesService],
  exports: [PredictiveChecklistTemplatesService],
})
export class PredictiveChecklistTemplatesModule {}
