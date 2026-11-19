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
import { PmChecklistTemplatesService } from './pm-checklist-templates.service';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { parsePmChecklistWorkbook } from './pm-import.parser';

const COLUMNS: ExportColumn[] = [
  { key: 'name', header: 'Name' },
  { key: 'assetCategory', header: 'Asset Category' },
  { key: 'maintenanceType', header: 'Trade' },
  { key: 'version', header: 'Version' },
  { key: 'itemCount', header: 'Checklist Items' },
];

@Controller('pm-checklist-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PmChecklistTemplatesController {
  constructor(
    private readonly service: PmChecklistTemplatesService,
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
      itemCount: t.items.length,
    }));
    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('PM Checklist Templates', COLUMNS, rows)
        : await this.excelService.exportRows('PM Checklist Templates', COLUMNS, rows);
    sendExportFile(res, format, 'pm-checklist-templates', buffer);
  }

  @Post('import/preview')
  @Roles(PermissionTier.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(@UploadedFile() file: Express.Multer.File, @Query('templateName') templateName?: string) {
    const name = templateName || file.originalname.replace(/\.[^.]+$/, '');
    return parsePmChecklistWorkbook(file.buffer, name);
  }

  @Post('import/commit')
  @Roles(PermissionTier.ADMIN)
  importCommit(@Body() dto: CreateChecklistTemplateDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(PermissionTier.ADMIN)
  create(@Body() dto: CreateChecklistTemplateDto) {
    return this.service.create(dto);
  }
}
