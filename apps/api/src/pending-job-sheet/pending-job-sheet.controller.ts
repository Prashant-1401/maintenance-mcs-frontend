import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PendingJobSheetStatus, PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PendingJobSheetService } from './pending-job-sheet.service';
import { UpdatePendingJobSheetItemDto } from './dto/update-pending-job-sheet-item.dto';
import { CreatePendingJobSheetItemDto } from './dto/create-pending-job-sheet-item.dto';

@Controller('pending-job-sheet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
export class PendingJobSheetController {
  constructor(private readonly service: PendingJobSheetService) {}

  @Get()
  findAll(
    @Query('status') status?: PendingJobSheetStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('assetId') assetId?: string,
  ) {
    return this.service.findAll({ status, assignedToId, assetId });
  }

  @Post()
  create(@Body() dto: CreatePendingJobSheetItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePendingJobSheetItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }
}
