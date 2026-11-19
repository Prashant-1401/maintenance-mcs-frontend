import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionTier, RcaActionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { RcaService } from './rca.service';
import { CreateRcaRecordDto } from './dto/create-rca-record.dto';
import { UpdateRcaRecordDto } from './dto/update-rca-record.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';
import { UpdateFullActionItemDto } from './dto/update-full-action-item.dto';
import { AddActionItemDto } from './dto/add-action-item.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RcaController {
  constructor(private readonly rcaService: RcaService) {}

  @Get('rca')
  findAll() {
    return this.rcaService.findAll();
  }

  @Get('rca/:id')
  findOne(@Param('id') id: string) {
    return this.rcaService.findOne(id);
  }

  @Get('work-orders/:workOrderId/rca')
  findForWorkOrder(@Param('workOrderId') workOrderId: string) {
    return this.rcaService.findForWorkOrder(workOrderId);
  }

  @Post('rca')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  create(@Body() dto: CreateRcaRecordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rcaService.create(dto, user);
  }

  @Patch('rca/:id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  update(@Param('id') id: string, @Body() dto: UpdateRcaRecordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rcaService.update(id, dto, user);
  }

  @Post('rca/:id/action-items')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  addActionItem(@Param('id') id: string, @Body() dto: AddActionItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rcaService.addActionItem(id, dto, user);
  }

  @Get('rca-actions')
  actionItems(@Query('status') status?: RcaActionStatus, @Query('ownerId') ownerId?: string) {
    return this.rcaService.actionItems({ status, ownerId });
  }

  @Patch('rca-actions/:id/status')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  updateActionItemStatus(
    @Param('id') id: string,
    @Body() dto: UpdateActionItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rcaService.updateActionItemStatus(id, dto, user);
  }

  @Patch('rca-actions/:id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  updateActionItem(
    @Param('id') id: string,
    @Body() dto: UpdateFullActionItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rcaService.updateActionItem(id, dto, user);
  }

  @Delete('rca-actions/:id')
  @Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
  removeActionItem(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rcaService.removeActionItem(id, user);
  }
}
