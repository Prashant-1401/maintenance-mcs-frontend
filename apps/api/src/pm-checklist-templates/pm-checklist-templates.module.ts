import { Module } from '@nestjs/common';
import { FileExportModule } from '../common/file-export.module';
import { PmChecklistTemplatesController } from './pm-checklist-templates.controller';
import { PmChecklistTemplatesService } from './pm-checklist-templates.service';

@Module({
  imports: [FileExportModule],
  controllers: [PmChecklistTemplatesController],
  providers: [PmChecklistTemplatesService],
  exports: [PmChecklistTemplatesService],
})
export class PmChecklistTemplatesModule {}
