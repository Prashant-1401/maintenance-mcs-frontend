import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExcelService, type ExportColumn } from '../common/excel.service';
import { PdfService } from '../common/pdf.service';
import { sendExportFile } from '../common/send-export-file';
import { PredictiveChecklistTemplatesService } from './predictive-checklist-templates.service';
import { CreatePredictiveChecklistTemplateDto } from './dto/create-predictive-checklist-template.dto';
import { parsePredictiveChecklistWorkbook } from './predictive-import.parser';

const COLUMNS: ExportColumn[] = [
  { key: 'name', header: 'Name' },
  { key: 'assetCategory', header: 'Asset Category' },
  { key: 'maintenanceType', header: 'Trade' },
  { key: 'version', header: 'Version' },
  { key: 'checkPointCount', header: 'Check Points' },
];

@Controller('predictive-checklist-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PredictiveChecklistTemplatesController {
  constructor(
    private readonly service: PredictiveChecklistTemplatesService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('export')
  @Roles(PermissionTier.ADMIN)
  async export(@Query('format') format: 'xlsx' | 'pdf' = 'xlsx', @Res() res: Response) {
    const templates = await this.service.findAll();
    const rows = templates.map((t) => ({
      name: t.name,
      assetCategory: t.assetCategory ?? '',
      maintenanceType: t.maintenanceType,
      version: t.version,
      checkPointCount: t.checkPoints.length,
    }));
    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('Predictive Checklist Templates', COLUMNS, rows)
        : await this.excelService.exportRows('Predictive Checklist Templates', COLUMNS, rows);
    sendExportFile(res, format, 'predictive-checklist-templates', buffer);
  }

  @Post('import/preview')
  @Roles(PermissionTier.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(@UploadedFile() file: Express.Multer.File) {
    return parsePredictiveChecklistWorkbook(file.buffer);
  }

  @Post('import/commit')
  @Roles(PermissionTier.ADMIN)
  importCommit(@Body() dto: CreatePredictiveChecklistTemplateDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(PermissionTier.ADMIN)
  create(@Body() dto: CreatePredictiveChecklistTemplateDto) {
    return this.service.create(dto);
  }
}
