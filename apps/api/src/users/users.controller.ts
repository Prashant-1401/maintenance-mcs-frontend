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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const COLUMNS: ExportColumn[] = [
  { key: 'email', header: 'Email' },
  { key: 'name', header: 'Name' },
  { key: 'role', header: 'Role' },
];

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles(PermissionTier.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(PermissionTier.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Get('export')
  @Roles(PermissionTier.ADMIN)
  async export(@Query('format') format: 'xlsx' | 'pdf' = 'xlsx', @Res() res: Response) {
    const users = await this.usersService.findAll();
    const rows = users.map((u) => ({ email: u.email, name: u.name, role: u.role.name }));
    const buffer =
      format === 'pdf'
        ? await this.pdfService.exportTable('Users', COLUMNS, rows)
        : await this.excelService.exportRows('Users', COLUMNS, rows);
    sendExportFile(res, format, 'users', buffer);
  }

  @Post('import')
  @Roles(PermissionTier.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File) {
    const rows = await this.excelService.importRows(file.buffer, COLUMNS);
    return this.usersService.upsertMany(rows);
  }
}
