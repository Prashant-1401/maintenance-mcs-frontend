import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PredictiveWorkOrdersService } from './predictive-work-orders.service';
import { CompletePredictiveWorkOrderDto } from './dto/complete-predictive-work-order.dto';
import { SubmitPredictiveReadingsDto } from './dto/submit-predictive-readings.dto';

@Controller('predictive-work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PredictiveWorkOrdersController {
  constructor(private readonly service: PredictiveWorkOrdersService) {}

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

  @Put(':id/readings')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  submitReadings(
    @Param('id') id: string,
    @Body() dto: SubmitPredictiveReadingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submitReadings(id, dto, user);
  }

  @Post(':id/complete')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  complete(
    @Param('id') id: string,
    @Body() dto: CompletePredictiveWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.complete(id, dto, user);
  }
}
