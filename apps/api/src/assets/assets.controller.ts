import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExcelService, type ExportColumn } from '../common/excel.service';
import { PdfService } from '../common/pdf.service';
import { sendExportFile } from '../common/send-export-file';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

const COLUMNS: ExportColumn[] = [
  { key: 'tag', header: 'Machine Code' },
  { key: 'name', header: 'Machine Name' },
  { key: 'category', header: 'Category' },
  { key: 'criticality', header: 'Criticality' },
  { key: 'line', header: 'Line' },
];

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }

  @Get('export')
  @Roles(PermissionTier.ADMIN)
  async export(@Query('format') format: 'xlsx' | 'pdf' = 'xlsx', @Res() res: Response) {
    const assets = await this.assetsService.findAll();
    const rows = assets.map((a) => ({
      tag: a.tag,
      name: a.name,
      category: a.category ?? '',
      criticality: a.criticality,
      line: a.location.name,
    }));
    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('Machine Master', COLUMNS, rows)
        : await this.excelService.exportRows('Machine Master', COLUMNS, rows);
    sendExportFile(res, format, 'machine-master', buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Post()
  @Roles(PermissionTier.ADMIN)
  create(@Body() dto: CreateAssetDto) {
    return this.assetsService.create(dto);
  }

  @Patch(':id')
  @Roles(PermissionTier.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(id, dto);
  }

  @Post('import')
  @Roles(PermissionTier.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File) {
    const rows = await this.excelService.importRows(file.buffer, COLUMNS);
    return this.assetsService.upsertMany(rows);
  }
}
