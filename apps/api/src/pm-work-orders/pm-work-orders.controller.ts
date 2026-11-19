import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PmWorkOrdersService } from './pm-work-orders.service';
import { SubmitChecklistResponsesDto } from './dto/submit-checklist-responses.dto';
import { CompletePmWorkOrderDto } from './dto/complete-pm-work-order.dto';

@Controller('pm-work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PmWorkOrdersController {
  constructor(private readonly service: PmWorkOrdersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/start')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.start(id, user);
  }

  @Put(':id/responses')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  submitResponses(
    @Param('id') id: string,
    @Body() dto: SubmitChecklistResponsesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submitResponses(id, dto, user);
  }

  @Post(':id/complete')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  complete(
    @Param('id') id: string,
    @Body() dto: CompletePmWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.complete(id, dto, user);
  }
}
