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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const COLUMNS: ExportColumn[] = [
  { key: 'name', header: 'Name' },
  { key: 'tier', header: 'Tier' },
  { key: 'rank', header: 'Rank' },
  { key: 'capacity', header: 'Capacity' },
  { key: 'hourlyRate', header: 'Hourly Rate' },
  { key: 'maintenanceType', header: 'Trade' },
];

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PermissionTier.ADMIN)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Get('export')
  async export(@Query('format') format: 'xlsx' | 'pdf' = 'xlsx', @Res() res: Response) {
    const roles = await this.rolesService.findAll();
    const rows = roles.map((r) => ({
      name: r.name,
      tier: r.tier,
      rank: r.rank,
      capacity: r.capacity,
      hourlyRate: r.hourlyRate ?? '',
      maintenanceType: r.maintenanceType ?? '',
    }));
    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('Roles', COLUMNS, rows)
        : await this.excelService.exportRows('Roles', COLUMNS, rows);
    sendExportFile(res, format, 'roles', buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File) {
    const rows = await this.excelService.importRows(file.buffer, COLUMNS);
    return this.rolesService.upsertMany(rows);
  }
}
