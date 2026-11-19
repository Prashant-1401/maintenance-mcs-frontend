import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { PermissionTier, WorkOrderType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { WorkOrdersService } from './work-orders.service';
import { AssignWorkOrderDto } from './dto/assign-work-order.dto';

@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
export class WorkOrdersController {
  constructor(private readonly service: WorkOrdersService) {}

  @Get('open')
  findOpen() {
    return this.service.findOpen();
  }

  @Get('workload')
  workload() {
    return this.service.workload();
  }

  @Get('calendar')
  calendar(@Query('type') type: WorkOrderType, @Query('from') from: string, @Query('to') to: string) {
    return this.service.calendar(type, new Date(from), new Date(to));
  }

  @Patch(':id/assign')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  assign(@Param('id') id: string, @Body() dto: AssignWorkOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.assign(id, dto, user);
  }
}
