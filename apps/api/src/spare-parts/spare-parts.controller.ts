import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PermissionTier, WorkOrderType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExcelService, type ExportColumn } from '../common/excel.service';
import { PdfService } from '../common/pdf.service';
import { sendExportFile } from '../common/send-export-file';
import { SparePartsService } from './spare-parts.service';
import { CreateSparePartDto } from './dto/create-spare-part.dto';
import { UpdateSparePartDto } from './dto/update-spare-part.dto';

const COLUMNS: ExportColumn[] = [
  { key: 'itemCode', header: 'Item Code' },
  { key: 'name', header: 'Name' },
  { key: 'unit', header: 'Unit' },
  { key: 'unitCost', header: 'Unit Cost' },
];

const INVENTORY_COLUMNS: ExportColumn[] = [
  { key: 'itemCode', header: 'Item Code' },
  { key: 'name', header: 'Spare Part Name' },
  { key: 'unit', header: 'Unit' },
  { key: 'unitCost', header: 'Unit Cost' },
  { key: 'timesUsed', header: 'Times Used (Frequency)' },
  { key: 'totalQuantityUsed', header: 'Total Quantity Consumed' },
  { key: 'totalCost', header: 'Total Cost' },
  { key: 'lastUsedAt', header: 'Last Used' },
];

@Controller('spare-parts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
export class SparePartsController {
  constructor(
    private readonly service: SparePartsService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('inventory')
  getInventory(
    @Query('search') search?: string,
    @Query('type') type?: WorkOrderType,
    @Query('assetId') assetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getInventory({ search, type, assetId, from, to });
  }

  @Get('inventory/export')
  async exportInventory(
    @Query('format') format: 'xlsx' | 'pdf' = 'xlsx',
    @Query('search') search?: string,
    @Query('type') type?: WorkOrderType,
    @Query('assetId') assetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const data = await this.service.getInventory({ search, type, assetId, from, to });
    const rows = data.items.map((item) => ({
      itemCode: item.itemCode,
      name: item.name,
      unit: item.unit ?? '',
      unitCost: item.unitCost != null ? `$${item.unitCost.toFixed(2)}` : '',
      timesUsed: item.timesUsed,
      totalQuantityUsed: `${item.totalQuantityUsed} ${item.unit ?? ''}`.trim(),
      totalCost: `$${item.totalCost.toFixed(2)}`,
      lastUsedAt: item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : 'Never',
    }));

    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('Spare Parts Inventory & Usage', INVENTORY_COLUMNS, rows)
        : await this.excelService.exportRows('Spare Parts Usage', INVENTORY_COLUMNS, rows);

    sendExportFile(res!, format, 'spare-parts-inventory', buffer);
  }

  @Post()
  @Roles(PermissionTier.ADMIN)
  create(@Body() dto: CreateSparePartDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(PermissionTier.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSparePartDto) {
    return this.service.update(id, dto);
  }

  @Get('export')
  @Roles(PermissionTier.ADMIN)
  async export(@Query('format') format: 'xlsx' | 'pdf' = 'xlsx', @Res() res: Response) {
    const parts = await this.service.findAll();
    const rows = parts.map((p) => ({ itemCode: p.itemCode, name: p.name, unit: p.unit ?? '', unitCost: p.unitCost ?? '' }));
    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('Spare Parts', COLUMNS, rows)
        : await this.excelService.exportRows('Spare Parts', COLUMNS, rows);
    sendExportFile(res, format, 'spare-parts', buffer);
  }

  @Post('import')
  @Roles(PermissionTier.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File) {
    const rows = await this.excelService.importRows(file.buffer, COLUMNS);
    return this.service.upsertMany(rows);
  }
}

