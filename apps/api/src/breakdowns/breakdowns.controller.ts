import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PermissionTier, WorkOrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ExcelService, type ExportColumn } from '../common/excel.service';
import { PdfService } from '../common/pdf.service';
import { sendExportFile } from '../common/send-export-file';
import { BreakdownsService } from './breakdowns.service';
import { RaiseBreakdownDto } from './dto/raise-breakdown.dto';
import { CloseBreakdownDto } from './dto/close-breakdown.dto';
import { UpdateBreakdownDto } from './dto/update-breakdown.dto';

const COLUMNS: ExportColumn[] = [
  { key: 'tag', header: 'Machine Code' },
  { key: 'name', header: 'Machine Name' },
  { key: 'failureCategory', header: 'Category' },
  { key: 'occurredAt', header: 'Occurred Date' },
  { key: 'restoredAt', header: 'Restored Date' },
  { key: 'symptom', header: 'Symptom' },
  { key: 'actionTaken', header: 'Action Taken' },
  { key: 'status', header: 'Status' },
];

@Controller('breakdowns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BreakdownsController {
  constructor(
    private readonly breakdownsService: BreakdownsService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  @Get('export')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  async export(
    @Query('format') format: 'xlsx' | 'pdf' = 'xlsx',
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const list = await this.breakdownsService.findAllForUser(user);
    const rows = list.map((wo) => ({
      tag: wo.asset.tag,
      name: wo.asset.name,
      failureCategory: wo.breakdownDetail?.failureCategory ?? 'MECHANICAL',
      occurredAt: wo.breakdownDetail?.occurredAt ? new Date(wo.breakdownDetail.occurredAt).toISOString().replace('T', ' ').slice(0, 16) : '',
      restoredAt: wo.breakdownDetail?.restoredAt ? new Date(wo.breakdownDetail.restoredAt).toISOString().replace('T', ' ').slice(0, 16) : '',
      symptom: wo.breakdownDetail?.symptom ?? '',
      actionTaken: wo.breakdownDetail?.actionTaken ?? '',
      status: wo.status,
    }));

    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('Breakdown History', COLUMNS, rows)
        : await this.excelService.exportRows('Breakdown History', COLUMNS, rows);
    sendExportFile(res, format, 'breakdown-history', buffer);
  }

  @Post('import')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    const rows = await this.excelService.importRows(file.buffer, COLUMNS);
    return this.breakdownsService.upsertMany(rows, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.breakdownsService.findAllForUser(user);
  }

  @Get('history')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  adminHistory(
    @Query('locationId') locationId?: string,
    @Query('assetId') assetId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('failureCategory') failureCategory?: string,
    @Query('status') status?: WorkOrderStatus,
  ) {
    return this.breakdownsService.adminHistory({ locationId, assetId, dateFrom, dateTo, failureCategory, status });
  }

  @Get('heatmap')
  heatmap(@Query('locationId') locationId?: string) {
    return this.breakdownsService.heatmap(locationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.breakdownsService.findOne(id);
  }

  @Get('asset/:assetId/history')
  historyForAsset(@Param('assetId') assetId: string) {
    return this.breakdownsService.historyForAsset(assetId);
  }

  @Post()
  raise(@Body() dto: RaiseBreakdownDto, @CurrentUser() user: AuthenticatedUser) {
    return this.breakdownsService.raise(dto, user);
  }

  @Post(':id/attend')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  attend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.breakdownsService.attend(id, user);
  }

  @Post(':id/close')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  close(@Param('id') id: string, @Body() dto: CloseBreakdownDto, @CurrentUser() user: AuthenticatedUser) {
    return this.breakdownsService.close(id, dto, user);
  }

  /** Admin correction at any status, including already-CLOSED — requires a reason, always audited. */
  @Patch(':id')
  @Roles(PermissionTier.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateBreakdownDto, @CurrentUser() user: AuthenticatedUser) {
    return this.breakdownsService.update(id, dto, user);
  }
}
