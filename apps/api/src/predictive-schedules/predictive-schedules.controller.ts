import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PredictiveSchedulesService } from './predictive-schedules.service';
import { CreatePredictiveScheduleDto } from './dto/create-predictive-schedule.dto';
import { StartScheduleDto } from './dto/start-schedule.dto';
import { DelayScheduleDto } from './dto/delay-schedule.dto';

@Controller('predictive-schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PredictiveSchedulesController {
  constructor(private readonly service: PredictiveSchedulesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.service.history(id);
  }

  @Post()
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  create(@Body() dto: CreatePredictiveScheduleDto) {
    return this.service.create(dto);
  }

  /** Force-generate a predictive check work order now, regardless of due date. */
  @Post(':id/generate')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT)
  generateNow(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generateNow(id, user.id);
  }

  /** Find-or-create the current-cycle instance, assign a technician, and start it (OPEN -> ATTENDED). */
  @Post(':id/start')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  start(@Param('id') id: string, @Body() dto: StartScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.start(id, dto, user);
  }

  /** Raise a deviation note requesting the due date be pushed out — requires Admin/Management approval. */
  @Post(':id/delay')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  delay(@Param('id') id: string, @Body() dto: DelayScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.delay(id, dto, user);
  }
}
