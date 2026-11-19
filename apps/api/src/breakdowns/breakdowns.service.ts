import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetStatus, PermissionTier, WorkOrderStatus, WorkOrderType, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkOrderStatusService } from '../work-orders/work-order-status.service';
import { WorkOrderCompletionService } from '../work-orders/work-order-completion.service';
import { NotificationService } from '../notifications/notification.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { RaiseBreakdownDto } from './dto/raise-breakdown.dto';
import { CloseBreakdownDto } from './dto/close-breakdown.dto';
import { UpdateBreakdownDto } from './dto/update-breakdown.dto';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

const DETAIL_INCLUDE = {
  asset: { include: { location: true } },
  breakdownDetail: {
    include: {
      reportedBy: { select: SAFE_USER_SELECT },
      attendedBy: { select: SAFE_USER_SELECT },
    },
  },
  createdBy: { select: SAFE_USER_SELECT },
  assignedTo: { select: SAFE_USER_SELECT },
  statusHistory: {
    orderBy: { changedAt: 'asc' as const },
    include: { changedBy: { select: SAFE_USER_SELECT } },
  },
  spareParts: true,
  participants: { include: { user: { select: SAFE_USER_SELECT } } },
  pendingJobSheetItems: {
    include: {
      raisedBy: { select: SAFE_USER_SELECT },
      assignedTo: { select: SAFE_USER_SELECT },
    },
  },
};

@Injectable()
export class BreakdownsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrderStatus: WorkOrderStatusService,
    private readonly completion: WorkOrderCompletionService,
    private readonly notifications: NotificationService,
  ) {}

  async raise(dto: RaiseBreakdownDto, user: AuthenticatedUser) {
    const occurredAt = new Date(dto.occurredAt);

    const workOrder = await this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          type: WorkOrderType.BREAKDOWN,
          status: WorkOrderStatus.OPEN,
          assetId: dto.assetId,
          createdById: user.id,
          downtimeStart: occurredAt,
          breakdownDetail: {
            create: {
              occurredAt,
              failureCategory: dto.failureCategory,
              symptom: dto.symptom,
              reportedById: user.id,
            },
          },
        },
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: wo.id,
          toStatus: WorkOrderStatus.OPEN,
          changedById: user.id,
          notes: dto.notes ?? 'Breakdown slip raised',
        },
      });

      await tx.asset.update({ where: { id: dto.assetId }, data: { status: AssetStatus.DOWN } });

      return wo;
    });

    const result = await this.findOne(workOrder.id);
    await this.notifications.notifyNewBreakdown(result);
    return result;
  }

  async attend(id: string, user: AuthenticatedUser) {
    const workOrder = await this.getBreakdownWorkOrder(id);

    await this.workOrderStatus.transition(id, WorkOrderStatus.ATTENDED, user, 'Breakdown attended');

    await this.prisma.$transaction([
      this.prisma.workOrder.update({ where: { id }, data: { assignedToId: user.id } }),
      this.prisma.breakdownDetail.update({
        where: { workOrderId: id },
        data: { attendedAt: new Date(), attendedById: user.id },
      }),
    ]);

    return this.findOne(workOrder.id);
  }

  async close(id: string, dto: CloseBreakdownDto, user: AuthenticatedUser) {
    const workOrder = await this.getBreakdownWorkOrder(id);
    const restoredAt = dto.restoredAt ? new Date(dto.restoredAt) : new Date();

    await this.workOrderStatus.transition(id, WorkOrderStatus.CLOSED, user, 'Breakdown closed');

    const completionOps = await this.completion.buildOperations(id, workOrder.assetId, dto, user.id);

    await this.prisma.$transaction([
      this.prisma.workOrder.update({ where: { id }, data: { downtimeEnd: restoredAt } }),
      this.prisma.breakdownDetail.update({
        where: { workOrderId: id },
        data: { restoredAt, actionTaken: dto.actionTaken },
      }),
      this.prisma.asset.update({
        where: { id: workOrder.assetId },
        data: { status: AssetStatus.OPERATIONAL },
      }),
      ...completionOps,
    ]);

    return this.findOne(id);
  }

  /**
   * Admin correction at any status (including CLOSED). Never re-triggers the DOWN/OPERATIONAL asset
   * side effects — only adjusts `downtimeEnd` if `restoredAt` itself changed. Always writes an
   * audit-trail status-history row (status unchanged) carrying the admin's reason.
   */
  async update(id: string, dto: UpdateBreakdownDto, user: AuthenticatedUser) {
    const workOrder = await this.getBreakdownWorkOrder(id);

    const detailUpdate: Prisma.BreakdownDetailUpdateInput = {};
    if (dto.occurredAt !== undefined) detailUpdate.occurredAt = new Date(dto.occurredAt);
    if (dto.failureCategory !== undefined) detailUpdate.failureCategory = dto.failureCategory;
    if (dto.symptom !== undefined) detailUpdate.symptom = dto.symptom;
    if (dto.actionTaken !== undefined) detailUpdate.actionTaken = dto.actionTaken;
    if (dto.restoredAt !== undefined) detailUpdate.restoredAt = new Date(dto.restoredAt);

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.breakdownDetail.update({ where: { workOrderId: id }, data: detailUpdate }),
      this.prisma.workOrderStatusHistory.create({
        data: {
          workOrderId: id,
          fromStatus: workOrder.status,
          toStatus: workOrder.status,
          changedById: user.id,
          notes: `Edited by ${user.name}: ${dto.reason}`,
        },
      }),
    ];

    if (dto.restoredAt !== undefined) {
      ops.push(this.prisma.workOrder.update({ where: { id }, data: { downtimeEnd: new Date(dto.restoredAt) } }));
    }

    if (dto.spareParts !== undefined) {
      ops.push(this.prisma.workOrderSparePart.deleteMany({ where: { workOrderId: id } }));
    }
    if (dto.participants !== undefined) {
      ops.push(this.prisma.workOrderParticipant.deleteMany({ where: { workOrderId: id } }));
    }
    if (dto.spareParts !== undefined || dto.participants !== undefined) {
      const createOps = await this.completion.buildOperations(id, workOrder.assetId, dto, user.id);
      ops.push(...createOps);
    }

    await this.prisma.$transaction(ops);
    return this.findOne(id);
  }

  findAllForUser(user: AuthenticatedUser) {
    return this.prisma.workOrder.findMany({
      where: {
        type: WorkOrderType.BREAKDOWN,
        ...(user.tier === PermissionTier.REQUESTER ? { breakdownDetail: { reportedById: user.id } } : {}),
      },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, type: WorkOrderType.BREAKDOWN },
      include: DETAIL_INCLUDE,
    });
    if (!workOrder) {
      throw new NotFoundException('Breakdown slip not found');
    }
    return workOrder;
  }

  /** The "breakdown history card" — chronological breakdown log for one asset with running stats. */
  async historyForAsset(assetId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: { assetId, type: WorkOrderType.BREAKDOWN },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    const closed = workOrders.filter((wo) => wo.breakdownDetail?.restoredAt);
    const downtimesMinutes = closed.map((wo) => {
      const occurred = wo.breakdownDetail!.occurredAt.getTime();
      const restored = wo.breakdownDetail!.restoredAt!.getTime();
      return Math.max(0, Math.round((restored - occurred) / 60000));
    });

    const cumulativeDowntimeMinutes = downtimesMinutes.reduce((sum, m) => sum + m, 0);
    const averageDowntimeMinutes = closed.length > 0 ? Math.round(cumulativeDowntimeMinutes / closed.length) : 0;
    const lastBreakdown = workOrders[0]?.breakdownDetail?.occurredAt ?? null;
    const daysSinceLastBreakdown = lastBreakdown
      ? Math.floor((Date.now() - lastBreakdown.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      asset,
      breakdownCount: workOrders.length,
      cumulativeDowntimeMinutes,
      averageDowntimeMinutes,
      daysSinceLastBreakdown,
      breakdowns: workOrders,
    };
  }

  /** Admin cross-asset breakdown history: filterable, grouped by Location ("line") then Asset. */
  async adminHistory(filters: {
    locationId?: string;
    assetId?: string;
    dateFrom?: string;
    dateTo?: string;
    failureCategory?: string;
    status?: WorkOrderStatus;
  }) {
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        type: WorkOrderType.BREAKDOWN,
        ...(filters.assetId ? { assetId: filters.assetId } : {}),
        ...(filters.locationId ? { asset: { locationId: filters.locationId } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        breakdownDetail: {
          ...(filters.failureCategory ? { failureCategory: filters.failureCategory as never } : {}),
          ...(filters.dateFrom || filters.dateTo
            ? {
                occurredAt: {
                  ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                  ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
                },
              }
            : {}),
        },
      },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    type Group = {
      location: { id: string; name: string };
      assets: Map<string, { asset: (typeof workOrders)[number]['asset']; breakdowns: typeof workOrders }>;
    };
    const groups = new Map<string, Group>();

    for (const wo of workOrders) {
      const locId = wo.asset.locationId;
      if (!groups.has(locId)) {
        groups.set(locId, { location: wo.asset.location, assets: new Map() });
      }
      const group = groups.get(locId)!;
      if (!group.assets.has(wo.assetId)) {
        group.assets.set(wo.assetId, { asset: wo.asset, breakdowns: [] });
      }
      group.assets.get(wo.assetId)!.breakdowns.push(wo);
    }

    const groupedByLine = [...groups.values()].map((group) => ({
      location: group.location,
      machines: [...group.assets.values()].map(({ asset, breakdowns }) => ({
        asset,
        breakdownCount: breakdowns.length,
        breakdowns,
      })),
    }));

    return { groups: groupedByLine, breakdowns: workOrders };
  }

  /** Breakdown heatmap: one tile per asset (with breakdown history), MTBF/MTTR/count, grouped by line. */
  async heatmap(locationId?: string) {
    const closedBreakdowns = await this.prisma.workOrder.findMany({
      where: {
        type: WorkOrderType.BREAKDOWN,
        status: WorkOrderStatus.CLOSED,
        ...(locationId ? { asset: { locationId } } : {}),
      },
      include: { breakdownDetail: true, asset: { include: { location: true } } },
    });

    const byAsset = new Map<
      string,
      { asset: (typeof closedBreakdowns)[number]['asset']; count: number; downtimeMinutes: number; occurredDates: number[] }
    >();
    for (const wo of closedBreakdowns) {
      if (!wo.breakdownDetail) continue;
      const entry = byAsset.get(wo.assetId) ?? { asset: wo.asset, count: 0, downtimeMinutes: 0, occurredDates: [] };
      entry.count += 1;
      entry.occurredDates.push(wo.breakdownDetail.occurredAt.getTime());
      if (wo.breakdownDetail.restoredAt) {
        entry.downtimeMinutes += (wo.breakdownDetail.restoredAt.getTime() - wo.breakdownDetail.occurredAt.getTime()) / MS_PER_MINUTE;
      }
      byAsset.set(wo.assetId, entry);
    }

    const assetsWithStats = [...byAsset.values()].map(({ asset, count, downtimeMinutes, occurredDates }) => {
      const sorted = [...occurredDates].sort((a, b) => a - b);
      const mtbfDays = count >= 2 ? (sorted[sorted.length - 1] - sorted[0]) / MS_PER_DAY / (count - 1) : null;
      const mttrMinutes = count > 0 ? downtimeMinutes / count : null;
      const worstStatus = count === 0 ? 'NORMAL' : count <= 2 ? 'WARNING' : 'CRITICAL';
      return { asset, breakdownCount: count, mttrMinutes, mtbfDays, worstStatus };
    });

    const byLocation = new Map<string, { locationId: string; locationName: string; assets: typeof assetsWithStats }>();
    for (const entry of assetsWithStats) {
      const locId = entry.asset.locationId;
      const group = byLocation.get(locId) ?? { locationId: locId, locationName: entry.asset.location.name, assets: [] };
      group.assets.push(entry);
      byLocation.set(locId, group);
    }

    return [...byLocation.values()];
  }

  async upsertMany(rows: Record<string, string>[], user: AuthenticatedUser) {
    const locations = await this.prisma.location.findMany();
    let defaultLocation = locations[0];
    if (!defaultLocation) {
      defaultLocation = await this.prisma.location.create({ data: { name: 'General Production' } });
    }

    const assets = await this.prisma.asset.findMany();
    const assetByTag = new Map(assets.map((a) => [a.tag.toLowerCase().trim(), a]));

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const rawTag = (row.tag || row.machineCode || row.machineTag || '').trim();
      if (!rawTag) {
        skipped += 1;
        continue;
      }

      let asset = assetByTag.get(rawTag.toLowerCase());
      if (!asset) {
        asset = await this.prisma.asset.create({
          data: {
            tag: rawTag,
            name: rawTag,
            locationId: defaultLocation.id,
            criticality: 'MEDIUM',
            status: AssetStatus.OPERATIONAL,
          },
        });
        assetByTag.set(rawTag.toLowerCase(), asset);
      }

      const rawOccurred = row.occurredAt || row.occurredDate || row.date || row.dateTime;
      const occurredAt = rawOccurred ? new Date(rawOccurred) : new Date();
      if (isNaN(occurredAt.getTime())) {
        skipped += 1;
        continue;
      }

      let restoredAt: Date | null = null;
      const rawRestored = row.restoredAt || row.restoredDate;
      if (rawRestored) {
        const parsed = new Date(rawRestored);
        if (!isNaN(parsed.getTime())) restoredAt = parsed;
      } else if (row.downtimeHours) {
        const hrs = parseFloat(row.downtimeHours);
        if (!isNaN(hrs) && hrs > 0) {
          restoredAt = new Date(occurredAt.getTime() + hrs * 60 * 60 * 1000);
        }
      } else if (row.downtimeMinutes) {
        const mins = parseFloat(row.downtimeMinutes);
        if (!isNaN(mins) && mins > 0) {
          restoredAt = new Date(occurredAt.getTime() + mins * 60 * 1000);
        }
      }

      const rawCat = (row.failureCategory || row.category || 'MECHANICAL').toUpperCase().trim();
      const failureCategory = ['MECHANICAL', 'ELECTRICAL', 'UTILITY', 'INSTRUMENTATION', 'OTHER'].includes(rawCat)
        ? (rawCat as any)
        : 'MECHANICAL';

      const symptom = (row.symptom || row.problem || row.description || 'Historical breakdown entry').trim();
      const actionTaken = (row.actionTaken || row.action || row.fix || '').trim() || null;
      const rawStatus = (row.status || '').toUpperCase().trim();
      const isClosed = !!restoredAt || rawStatus === 'CLOSED' || rawStatus === 'OK';
      const status = isClosed ? WorkOrderStatus.CLOSED : WorkOrderStatus.OPEN;

      await this.prisma.workOrder.create({
        data: {
          type: WorkOrderType.BREAKDOWN,
          status,
          assetId: asset.id,
          createdById: user.id,
          assignedToId: user.id,
          downtimeStart: occurredAt,
          downtimeEnd: restoredAt,
          completedAt: restoredAt,
          createdAt: occurredAt,
          breakdownDetail: {
            create: {
              occurredAt,
              attendedAt: occurredAt,
              restoredAt,
              failureCategory,
              symptom,
              actionTaken,
              reportedById: user.id,
              attendedById: user.id,
            },
          },
        },
      });

      created += 1;
    }

    return { created, updated: 0, skipped };
  }

  private async getBreakdownWorkOrder(id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, type: WorkOrderType.BREAKDOWN } });
    if (!workOrder) {
      throw new NotFoundException('Breakdown slip not found');
    }
    return workOrder;
  }
}
