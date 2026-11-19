import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { DeviationNoteStatus, PermissionTier, WorkOrderType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DeviationNotesService } from './deviation-notes.service';

@Controller('deviation-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
export class DeviationNotesController {
  constructor(private readonly service: DeviationNotesService) {}

  @Get()
  findAll(@Query('type') type?: WorkOrderType, @Query('status') status?: DeviationNoteStatus) {
    return this.service.findAll({ type, status });
  }

  @Patch(':id/approve')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approve(id, user);
  }

  @Patch(':id/reject')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  reject(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reject(id, user);
  }
}
