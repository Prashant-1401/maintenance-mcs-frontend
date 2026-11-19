import { Injectable } from '@nestjs/common';
import { ReadingStatus, RcaActionStatus, RcaRecordStatus, WorkOrderStatus, WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

function average(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

export type TrendGranularity = 'day' | 'month';
export type KpiMetric = 'breakdownCount' | 'mttr' | 'mtbf' | 'pmCompliance' | 'rcaClosureRate' | 'predictiveCompliance';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodKey(d: Date, granularity: TrendGranularity): string {
  return granularity === 'day' ? dayKey(d) : monthKey(d);
}

/** Inclusive list of "YYYY-MM" month keys spanning [from, to]. */
function monthBuckets(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

/** Inclusive list of "YYYY-MM-DD" day keys spanning [from, to]. */
function dayBuckets(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor.getTime() <= end.getTime()) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function periodBuckets(from: Date, to: Date, granularity: TrendGranularity): string[] {
  return granularity === 'day' ? dayBuckets(from, to) : monthBuckets(from, to);
}

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [closedBreakdowns, pmWorkOrders, predictiveWorkOrders, actionItems, recentReadings] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: { type: WorkOrderType.BREAKDOWN, status: WorkOrderStatus.CLOSED },
        include: { breakdownDetail: true, asset: true },
      }),
      this.prisma.workOrder.findMany({ where: { type: WorkOrderType.PM } }),
      this.prisma.workOrder.findMany({ where: { type: WorkOrderType.PREDICTIVE } }),
      this.prisma.rcaActionItem.findMany({ where: { rcaRecord: { status: RcaRecordStatus.FINAL } } }),
      this.prisma.workOrderPredictiveReading.findMany({
        where: { recordedAt: { gte: new Date(Date.now() - 30 * MS_PER_DAY) } },
      }),
    ]);

    // MTTR — mean time to repair, across all closed breakdowns
    const downtimesMinutes = closedBreakdowns
      .filter((wo) => wo.breakdownDetail?.restoredAt)
      .map((wo) => (wo.breakdownDetail!.restoredAt!.getTime() - wo.breakdownDetail!.occurredAt.getTime()) / MS_PER_MINUTE);
    const mttrMinutes = average(downtimesMinutes);

    // Breakdown frequency + cumulative downtime per asset (Pareto)
    const byAsset = new Map<string, { assetId: string; assetTag: string; assetName: string; count: number; downtimeMinutes: number; occurredDates: number[] }>();
    for (const wo of closedBreakdowns) {
      if (!wo.breakdownDetail) continue;
      const entry = byAsset.get(wo.assetId) ?? {
        assetId: wo.assetId,
        assetTag: wo.asset?.tag ?? 'Unknown',
        assetName: wo.asset?.name ?? 'Unknown',
        count: 0,
        downtimeMinutes: 0,
        occurredDates: [],
      };
      entry.count += 1;
      entry.occurredDates.push(wo.breakdownDetail.occurredAt.getTime());
      if (wo.breakdownDetail.restoredAt) {
        entry.downtimeMinutes += (wo.breakdownDetail.restoredAt.getTime() - wo.breakdownDetail.occurredAt.getTime()) / MS_PER_MINUTE;
      }
      byAsset.set(wo.assetId, entry);
    }

    const topFailingAssets = [...byAsset.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ occurredDates, ...rest }) => rest);

    // MTBF per asset (days), for assets with 2+ breakdowns
    const mtbfByAsset = [...byAsset.values()]
      .filter((entry) => entry.count >= 2)
      .map((entry) => {
        const sorted = [...entry.occurredDates].sort((a, b) => a - b);
        const spanDays = (sorted[sorted.length - 1] - sorted[0]) / MS_PER_DAY;
        return { assetId: entry.assetId, assetTag: entry.assetTag, mtbfDays: spanDays / (entry.count - 1) };
      });
    const mtbfDaysOverall = average(mtbfByAsset.map((a) => a.mtbfDays));

    // PM compliance — % of generated PM work orders that reached CLOSED
    const totalPm = pmWorkOrders.length;
    const closedPm = pmWorkOrders.filter((wo) => wo.status === WorkOrderStatus.CLOSED).length;
    const pmComplianceRate = totalPm > 0 ? closedPm / totalPm : null;

    // Predictive compliance — % of generated predictive check work orders that reached CLOSED
    const totalPredictive = predictiveWorkOrders.length;
    const closedPredictive = predictiveWorkOrders.filter((wo) => wo.status === WorkOrderStatus.CLOSED).length;
    const predictiveComplianceRate = totalPredictive > 0 ? closedPredictive / totalPredictive : null;

    // RCA closure rate + overdue action items
    const doneOrVerified = actionItems.filter(
      (a) => a.status === RcaActionStatus.DONE || a.status === RcaActionStatus.VERIFIED,
    ).length;
    const rcaClosureRate = actionItems.length > 0 ? doneOrVerified / actionItems.length : null;
    const now = Date.now();
    const overdueActionItems = actionItems.filter(
      (a) => a.dueDate.getTime() < now && a.status !== RcaActionStatus.DONE && a.status !== RcaActionStatus.VERIFIED,
    ).length;

    // Predictive trend, last 30 days
    const predictiveTrend = {
      normal: recentReadings.filter((r) => r.status === ReadingStatus.NORMAL).length,
      warning: recentReadings.filter((r) => r.status === ReadingStatus.WARNING).length,
      critical: recentReadings.filter((r) => r.status === ReadingStatus.CRITICAL).length,
    };

    return {
      mttrMinutes,
      mtbfDaysOverall,
      mtbfByAsset,
      topFailingAssets,
      breakdownCount: closedBreakdowns.length,
      pm: { totalPm, closedPm, pmComplianceRate },
      predictive: { totalPredictive, closedPredictive, predictiveComplianceRate },
      rca: { totalActionItems: actionItems.length, doneOrVerified, rcaClosureRate, overdueActionItems },
      predictiveTrend,
    };
  }

  /** Line-wise (top-level Location) summary — walks each asset's location up to its root. */
  async getLines(from?: Date, to?: Date) {
    const occurredAtFilter = from && to ? { occurredAt: { gte: from, lte: to } } : {};
    const [locations, closedBreakdowns] = await Promise.all([
      this.prisma.location.findMany(),
      this.prisma.workOrder.findMany({
        where: { type: WorkOrderType.BREAKDOWN, status: WorkOrderStatus.CLOSED, breakdownDetail: occurredAtFilter },
        include: { breakdownDetail: true, asset: true },
      }),
    ]);

    const locationById = new Map(locations.map((l) => [l.id, l]));
    const rootOf = (locationId: string): { id: string; name: string } => {
      let current = locationById.get(locationId);
      if (!current) return { id: locationId, name: 'Unknown' };
      while (current.parentId) {
        const parent = locationById.get(current.parentId);
        if (!parent) break;
        current = parent;
      }
      return { id: current.id, name: current.name };
    };

    const byLine = new Map<string, { location: { id: string; name: string }; breakdownCount: number; downtimeMinutes: number }>();
    for (const wo of closedBreakdowns) {
      if (!wo.breakdownDetail) continue;
      const root = wo.asset?.locationId ? rootOf(wo.asset.locationId) : { id: 'general', name: 'General Area' };
      const entry = byLine.get(root.id) ?? { location: root, breakdownCount: 0, downtimeMinutes: 0 };
      entry.breakdownCount += 1;
      if (wo.breakdownDetail.restoredAt) {
        entry.downtimeMinutes += (wo.breakdownDetail.restoredAt.getTime() - wo.breakdownDetail.occurredAt.getTime()) / MS_PER_MINUTE;
      }
      byLine.set(root.id, entry);
    }

    return [...byLine.values()]
      .map((e) => ({
        ...e,
        mttrMinutes: e.breakdownCount > 0 ? e.downtimeMinutes / e.breakdownCount : null,
      }))
      .sort((a, b) => b.breakdownCount - a.breakdownCount);
  }

  /** Machine-wise (single-asset) KPI tier — combines breakdown history stats with PM/RCA scoped to the asset. */
  async getAssetKpi(assetId: string, from?: Date, to?: Date) {
    const occurredAtFilter = from && to ? { occurredAt: { gte: from, lte: to } } : {};
    const [asset, breakdowns, pmWorkOrders, actionItems] = await Promise.all([
      this.prisma.asset.findUniqueOrThrow({ where: { id: assetId } }),
      this.prisma.workOrder.findMany({
        where: { assetId, type: WorkOrderType.BREAKDOWN, status: WorkOrderStatus.CLOSED, breakdownDetail: occurredAtFilter },
        include: { breakdownDetail: true },
      }),
      this.prisma.workOrder.findMany({ where: { assetId, type: WorkOrderType.PM } }),
      this.prisma.rcaActionItem.findMany({ where: { rcaRecord: { status: RcaRecordStatus.FINAL, workOrder: { assetId } } } }),
    ]);

    const downtimesMinutes = breakdowns
      .filter((wo) => wo.breakdownDetail?.restoredAt)
      .map((wo) => (wo.breakdownDetail!.restoredAt!.getTime() - wo.breakdownDetail!.occurredAt.getTime()) / MS_PER_MINUTE);
    const mttrMinutes = average(downtimesMinutes);

    const occurredDates = breakdowns.filter((wo) => wo.breakdownDetail).map((wo) => wo.breakdownDetail!.occurredAt.getTime()).sort((a, b) => a - b);
    const mtbfDays =
      occurredDates.length >= 2 ? (occurredDates[occurredDates.length - 1] - occurredDates[0]) / MS_PER_DAY / (occurredDates.length - 1) : null;

    const totalPm = pmWorkOrders.length;
    const closedPm = pmWorkOrders.filter((wo) => wo.status === WorkOrderStatus.CLOSED).length;
    const doneOrVerified = actionItems.filter((a) => a.status === RcaActionStatus.DONE || a.status === RcaActionStatus.VERIFIED).length;

    return {
      asset,
      breakdownCount: breakdowns.length,
      mttrMinutes,
      mtbfDays,
      pm: { totalPm, closedPm, pmComplianceRate: totalPm > 0 ? closedPm / totalPm : null },
      rca: { totalActionItems: actionItems.length, doneOrVerified, rcaClosureRate: actionItems.length > 0 ? doneOrVerified / actionItems.length : null },
    };
  }

  /** Breakdown count/downtime trend across [from, to] (inclusive), bucketed by day or month, optionally scoped by asset or line. */
  async getTrends(from: Date, to: Date, granularity: TrendGranularity = 'month', assetId?: string, locationId?: string) {
    const periods = periodBuckets(from, to, granularity);

    const breakdowns = await this.prisma.workOrder.findMany({
      where: {
        type: WorkOrderType.BREAKDOWN,
        status: WorkOrderStatus.CLOSED,
        breakdownDetail: { occurredAt: { gte: from, lte: to } },
        ...(assetId ? { assetId } : {}),
        ...(locationId ? { asset: { locationId } } : {}),
      },
      include: { breakdownDetail: true },
    });

    const buckets = new Map<string, { period: string; breakdownCount: number; downtimeMinutes: number }>();
    for (const key of periods) buckets.set(key, { period: key, breakdownCount: 0, downtimeMinutes: 0 });

    for (const wo of breakdowns) {
      if (!wo.breakdownDetail) continue;
      const key = periodKey(wo.breakdownDetail.occurredAt, granularity);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.breakdownCount += 1;
      if (wo.breakdownDetail.restoredAt) {
        bucket.downtimeMinutes += (wo.breakdownDetail.restoredAt.getTime() - wo.breakdownDetail.occurredAt.getTime()) / MS_PER_MINUTE;
      }
    }

    return [...buckets.values()];
  }

  /** Manpower vs spares cost trend across [from, to] (inclusive), bucketed by day or month, optionally scoped by asset or line. */
  async getCostTrend(from: Date, to: Date, granularity: TrendGranularity = 'month', assetId?: string, locationId?: string) {
    const periods = periodBuckets(from, to, granularity);

    const [spareRows, participantRows] = await Promise.all([
      this.prisma.workOrderSparePart.findMany({
        where: {
          unitCost: { not: null },
          workOrder: {
            completedAt: { gte: from, lte: to },
            ...(assetId ? { assetId } : {}),
            ...(locationId ? { asset: { locationId } } : {}),
          },
        },
        include: { workOrder: { select: { completedAt: true } } },
      }),
      this.prisma.workOrderParticipant.findMany({
        where: {
          hoursSpent: { not: null },
          workOrder: {
            completedAt: { gte: from, lte: to },
            ...(assetId ? { assetId } : {}),
            ...(locationId ? { asset: { locationId } } : {}),
          },
        },
        include: { workOrder: { select: { completedAt: true } }, user: { include: { role: true } } },
      }),
    ]);

    const buckets = new Map<string, { period: string; manpowerCost: number; sparesCost: number }>();
    for (const key of periods) buckets.set(key, { period: key, manpowerCost: 0, sparesCost: 0 });

    for (const row of spareRows) {
      if (!row.workOrder.completedAt) continue;
      const bucket = buckets.get(periodKey(row.workOrder.completedAt, granularity));
      if (!bucket) continue;
      bucket.sparesCost += row.quantity * (row.unitCost ?? 0);
    }
    for (const row of participantRows) {
      if (!row.workOrder.completedAt) continue;
      const bucket = buckets.get(periodKey(row.workOrder.completedAt, granularity));
      if (!bucket) continue;
      bucket.manpowerCost += (row.hoursSpent ?? 0) * (row.user.role.hourlyRate ?? 0);
    }

    return [...buckets.values()];
  }

  /** Per-asset MTTR/MTBF/availability within [from, to], optionally filtered by line. */
  async getEquipmentPerformance(from: Date, to: Date, locationId?: string) {
    const breakdowns = await this.prisma.workOrder.findMany({
      where: {
        type: WorkOrderType.BREAKDOWN,
        status: WorkOrderStatus.CLOSED,
        breakdownDetail: { occurredAt: { gte: from, lte: to } },
        ...(locationId ? { asset: { locationId } } : {}),
      },
      include: { breakdownDetail: true, asset: true },
    });

    const windowMinutes = Math.max((to.getTime() - from.getTime()) / MS_PER_MINUTE, 1);

    const byAsset = new Map<
      string,
      { assetId: string; assetTag: string; assetName: string; count: number; downtimeMinutes: number; occurredDates: number[] }
    >();
    for (const wo of breakdowns) {
      if (!wo.breakdownDetail) continue;
      const entry = byAsset.get(wo.assetId) ?? {
        assetId: wo.assetId,
        assetTag: wo.asset?.tag ?? 'Unknown',
        assetName: wo.asset?.name ?? 'Unknown',
        count: 0,
        downtimeMinutes: 0,
        occurredDates: [],
      };
      entry.count += 1;
      entry.occurredDates.push(wo.breakdownDetail.occurredAt.getTime());
      if (wo.breakdownDetail.restoredAt) {
        entry.downtimeMinutes += (wo.breakdownDetail.restoredAt.getTime() - wo.breakdownDetail.occurredAt.getTime()) / MS_PER_MINUTE;
      }
      byAsset.set(wo.assetId, entry);
    }

    return [...byAsset.values()]
      .map((entry) => {
        const sorted = [...entry.occurredDates].sort((a, b) => a - b);
        const mtbfDays =
          entry.count >= 2 ? (sorted[sorted.length - 1] - sorted[0]) / MS_PER_DAY / (entry.count - 1) : null;
        return {
          assetId: entry.assetId,
          assetTag: entry.assetTag,
          assetName: entry.assetName,
          breakdownCount: entry.count,
          mttrMinutes: entry.count > 0 ? entry.downtimeMinutes / entry.count : null,
          mtbfDays,
          availability: Math.max(0, 1 - entry.downtimeMinutes / windowMinutes),
        };
      })
      .sort((a, b) => b.breakdownCount - a.breakdownCount);
  }

  /**
   * Single-metric trend for the click-to-popup StatCard charts: breakdown count, MTTR (breakdowns
   * bucketed by occurredAt), PM/Predictive compliance (work orders of that type bucketed by
   * createdAt, value = fraction CLOSED), or RCA closure rate (action items bucketed by dueDate,
   * value = fraction DONE/VERIFIED). `value` is null for empty buckets rather than 0, so charts can
   * distinguish "no data" from "0%".
   */
  async getKpiTrend(metric: KpiMetric, from: Date, to: Date, granularity: TrendGranularity = 'month', assetId?: string, locationId?: string) {
    const periods = periodBuckets(from, to, granularity);

    if (metric === 'breakdownCount' || metric === 'mttr' || metric === 'mtbf') {
      const breakdowns = await this.prisma.workOrder.findMany({
        where: {
          type: WorkOrderType.BREAKDOWN,
          status: WorkOrderStatus.CLOSED,
          breakdownDetail: { occurredAt: { gte: from, lte: to } },
          ...(assetId ? { assetId } : {}),
          ...(locationId ? { asset: { locationId } } : {}),
        },
        include: { breakdownDetail: true },
      });
      const counts = new Map<string, number>(periods.map((k) => [k, 0]));
      const durations = new Map<string, number[]>(periods.map((k) => [k, []]));
      const occurredDates = new Map<string, number[]>(periods.map((k) => [k, []]));
      for (const wo of breakdowns) {
        if (!wo.breakdownDetail) continue;
        const key = periodKey(wo.breakdownDetail.occurredAt, granularity);
        if (!counts.has(key)) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        occurredDates.get(key)!.push(wo.breakdownDetail.occurredAt.getTime());
        if (wo.breakdownDetail.restoredAt) {
          durations.get(key)!.push((wo.breakdownDetail.restoredAt.getTime() - wo.breakdownDetail.occurredAt.getTime()) / MS_PER_MINUTE);
        }
      }
      if (metric === 'breakdownCount') {
        return periods.map((period) => ({ period, value: counts.get(period) ?? 0 }));
      }
      if (metric === 'mttr') {
        return periods.map((period) => ({ period, value: average(durations.get(period) ?? []) }));
      }
      // mtbf — span between the first and last failure in the period, divided by (count-1)
      return periods.map((period) => {
        const dates = (occurredDates.get(period) ?? []).slice().sort((a, b) => a - b);
        if (dates.length < 2) return { period, value: null };
        const spanDays = (dates[dates.length - 1] - dates[0]) / MS_PER_DAY;
        return { period, value: spanDays / (dates.length - 1) };
      });
    }

    if (metric === 'pmCompliance' || metric === 'predictiveCompliance') {
      const type = metric === 'pmCompliance' ? WorkOrderType.PM : WorkOrderType.PREDICTIVE;
      const workOrders = await this.prisma.workOrder.findMany({
        where: {
          type,
          createdAt: { gte: from, lte: to },
          ...(assetId ? { assetId } : {}),
          ...(locationId ? { asset: { locationId } } : {}),
        },
        select: { createdAt: true, status: true },
      });
      const total = new Map<string, number>(periods.map((k) => [k, 0]));
      const closed = new Map<string, number>(periods.map((k) => [k, 0]));
      for (const wo of workOrders) {
        const key = periodKey(wo.createdAt, granularity);
        if (!total.has(key)) continue;
        total.set(key, (total.get(key) ?? 0) + 1);
        if (wo.status === WorkOrderStatus.CLOSED) closed.set(key, (closed.get(key) ?? 0) + 1);
      }
      return periods.map((period) => {
        const t = total.get(period) ?? 0;
        return { period, value: t > 0 ? (closed.get(period) ?? 0) / t : null };
      });
    }

    // rcaClosureRate
    const actionItems = await this.prisma.rcaActionItem.findMany({
      where: {
        dueDate: { gte: from, lte: to },
        rcaRecord: {
          status: RcaRecordStatus.FINAL,
          ...(assetId ? { workOrder: { assetId } } : {}),
          ...(locationId ? { workOrder: { asset: { locationId } } } : {}),
        },
      },
      select: { dueDate: true, status: true },
    });
    const total = new Map<string, number>(periods.map((k) => [k, 0]));
    const done = new Map<string, number>(periods.map((k) => [k, 0]));
    for (const item of actionItems) {
      const key = periodKey(item.dueDate, granularity);
      if (!total.has(key)) continue;
      total.set(key, (total.get(key) ?? 0) + 1);
      if (item.status === RcaActionStatus.DONE || item.status === RcaActionStatus.VERIFIED) {
        done.set(key, (done.get(key) ?? 0) + 1);
      }
    }
    return periods.map((period) => {
      const t = total.get(period) ?? 0;
      return { period, value: t > 0 ? (done.get(period) ?? 0) / t : null };
    });
  }

  /**
   * Maintenance cost snapshot: manpower (hoursSpent x the participant's Role.hourlyRate, resolved
   * at query time — not snapshotted) + spares (unitCost x quantity, snapshotted at capture).
   * Both are scoped to work orders completed within [from, to] when given.
   */
  async getCosts(from?: Date, to?: Date) {
    const completedAtFilter =
      from || to ? { completedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

    const [spareRows, participantRows] = await Promise.all([
      this.prisma.workOrderSparePart.findMany({
        where: { unitCost: { not: null }, workOrder: completedAtFilter },
        select: { quantity: true, unitCost: true },
      }),
      this.prisma.workOrderParticipant.findMany({
        where: { hoursSpent: { not: null }, workOrder: completedAtFilter },
        include: { user: { include: { role: true } } },
      }),
    ]);

    const sparesCost = spareRows.reduce((sum, r) => sum + r.quantity * (r.unitCost ?? 0), 0);
    const manpowerCost = participantRows.reduce((sum, r) => sum + (r.hoursSpent ?? 0) * (r.user.role.hourlyRate ?? 0), 0);

    return { manpowerCost, sparesCost, totalCost: manpowerCost + sparesCost };
  }
}
