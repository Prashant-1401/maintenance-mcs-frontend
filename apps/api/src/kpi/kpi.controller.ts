import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PermissionTier } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KpiService, type KpiMetric, type TrendGranularity } from './kpi.service';

const DEFAULT_MONTHS_BACK = 6;

/** A bare "YYYY-MM-DD" (no time component) means end-of-day when used as an upper bound. */
function endOfDayIfDateOnly(value: string, date: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to ? endOfDayIfDateOnly(to, new Date(to)) : new Date();
  let fromDate: Date;
  if (from) {
    fromDate = new Date(from);
  } else {
    fromDate = new Date(toDate);
    fromDate.setMonth(fromDate.getMonth() - (DEFAULT_MONTHS_BACK - 1));
    fromDate.setDate(1);
    fromDate.setHours(0, 0, 0, 0);
  }
  return { from: fromDate, to: toDate };
}

@Controller('kpi')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PermissionTier.ADMIN, PermissionTier.MANAGEMENT, PermissionTier.TECHNICIAN)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Get('dashboard')
  getDashboard() {
    return this.kpiService.getDashboard();
  }

  @Get('lines')
  getLines(@Query('from') from?: string, @Query('to') to?: string) {
    if (!from && !to) return this.kpiService.getLines();
    const range = resolveRange(from, to);
    return this.kpiService.getLines(range.from, range.to);
  }

  @Get('assets/:assetId')
  getAssetKpi(@Param('assetId') assetId: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!from && !to) return this.kpiService.getAssetKpi(assetId);
    const range = resolveRange(from, to);
    return this.kpiService.getAssetKpi(assetId, range.from, range.to);
  }

  @Get('trends')
  getTrends(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: TrendGranularity,
    @Query('assetId') assetId?: string,
    @Query('locationId') locationId?: string,
  ) {
    const range = resolveRange(from, to);
    return this.kpiService.getTrends(range.from, range.to, granularity, assetId, locationId);
  }

  @Get('costs')
  getCosts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.kpiService.getCosts(
      from ? new Date(from) : undefined,
      to ? endOfDayIfDateOnly(to, new Date(to)) : undefined,
    );
  }

  @Get('cost-trend')
  getCostTrend(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: TrendGranularity,
    @Query('assetId') assetId?: string,
    @Query('locationId') locationId?: string,
  ) {
    const range = resolveRange(from, to);
    return this.kpiService.getCostTrend(range.from, range.to, granularity, assetId, locationId);
  }

  @Get('equipment-performance')
  getEquipmentPerformance(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('locationId') locationId?: string,
  ) {
    const range = resolveRange(from, to);
    return this.kpiService.getEquipmentPerformance(range.from, range.to, locationId);
  }

  /** Single-metric trend for a StatCard's click-to-popup chart. */
  @Get('kpi-trend')
  getKpiTrend(
    @Query('metric') metric: KpiMetric,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('granularity') granularity?: TrendGranularity,
    @Query('assetId') assetId?: string,
    @Query('locationId') locationId?: string,
  ) {
    const range = resolveRange(from, to);
    return this.kpiService.getKpiTrend(metric, range.from, range.to, granularity, assetId, locationId);
  }
}
