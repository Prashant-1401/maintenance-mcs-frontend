import { Injectable } from '@nestjs/common';
import { PermissionTier, WorkOrderStatus, WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AssignWorkOrderDto } from './dto/assign-work-order.dto';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const OPEN_STATUSES = [WorkOrderStatus.OPEN, WorkOrderStatus.ATTENDED];

const DETAIL_INCLUDE = {
  asset: { include: { location: true } },
  createdBy: { select: SAFE_USER_SELECT },
  assignedTo: { select: SAFE_USER_SELECT },
  breakdownDetail: true,
};

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cross-type (breakdown + PM) open/attended work orders — the "new work came in" view. */
  findOpen() {
    return this.prisma.workOrder.findMany({
      where: { status: { in: OPEN_STATUSES } },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Per hands-on technician: how many open/attended work orders they're currently carrying,
   * plus how many open/attended work orders (by type) have nobody assigned yet — these are
   * otherwise invisible in the per-technician tiles even though they show up in `findOpen()`.
   */
  async workload() {
    const technicians = await this.prisma.user.findMany({
      where: { active: true, role: { tier: PermissionTier.TECHNICIAN } },
      select: { ...SAFE_USER_SELECT, role: { select: { id: true, name: true, tier: true, rank: true, maintenanceType: true, capacity: true, createdAt: true } } },
    });

    const counts = await this.prisma.workOrder.groupBy({
      by: ['assignedToId', 'status'],
      where: { status: { in: OPEN_STATUSES }, assignedToId: { not: null } },
      _count: true,
    });

    const unassignedCounts = await this.prisma.workOrder.groupBy({
      by: ['type'],
      where: { status: { in: OPEN_STATUSES }, assignedToId: null },
      _count: true,
    });

    const technicianEntries = technicians.map((tech) => {
      const open = counts.find((c) => c.assignedToId === tech.id && c.status === WorkOrderStatus.OPEN)?._count ?? 0;
      const attended =
        counts.find((c) => c.assignedToId === tech.id && c.status === WorkOrderStatus.ATTENDED)?._count ?? 0;
      const totalCount = open + attended;
      const capacity = tech.role.capacity;
      return {
        technician: tech,
        openCount: open,
        attendedCount: attended,
        totalCount,
        capacity,
        utilizationPct: capacity > 0 ? Math.round((totalCount / capacity) * 100) : 0,
      };
    });

    const unassignedByType = {
      PM: unassignedCounts.find((c) => c.type === WorkOrderType.PM)?._count ?? 0,
      PREDICTIVE: unassignedCounts.find((c) => c.type === WorkOrderType.PREDICTIVE)?._count ?? 0,
      BREAKDOWN: unassignedCounts.find((c) => c.type === WorkOrderType.BREAKDOWN)?._count ?? 0,
    };

    return { technicians: technicianEntries, unassignedByType };
  }

  async assign(id: string, dto: AssignWorkOrderDto, user: AuthenticatedUser) {
    const workOrder = await this.prisma.workOrder.findUniqueOrThrow({ where: { id } });

    await this.prisma.$transaction([
      this.prisma.workOrder.update({ where: { id }, data: { assignedToId: dto.assignedToId || null } }),
      this.prisma.workOrderStatusHistory.create({
        data: {
          workOrderId: id,
          fromStatus: workOrder.status,
          toStatus: workOrder.status,
          changedById: user.id,
          notes: `Reassigned to another team member`,
        },
      }),
    ]);

    return this.prisma.workOrder.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  }

  /**
   * Calendar feed for any due-dated work order type (PM, PREDICTIVE): GREY = future & open,
   * PURPLE = due today & open, GREEN = closed on/before due date, RED = overdue-and-open OR
   * closed late — both RED cases plot on the original due date, never the completion date.
   */
  async calendar(type: WorkOrderType, from: Date, to: Date) {
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        type,
        status: { not: WorkOrderStatus.CANCELLED },
        dueDate: { gte: from, lte: to },
      },
      include: { asset: true },
      orderBy: { dueDate: 'asc' },
    });

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const today = startOfDay(new Date());

    return workOrders.map((wo) => {
      const due = wo.dueDate!;
      let color: 'GREY' | 'PURPLE' | 'GREEN' | 'RED';

      if (wo.status === WorkOrderStatus.CLOSED) {
        color = wo.completedAt && wo.completedAt.getTime() <= endOfDay(due).getTime() ? 'GREEN' : 'RED';
      } else if (startOfDay(due).getTime() > today.getTime()) {
        color = 'GREY';
      } else if (startOfDay(due).getTime() === today.getTime()) {
        color = 'PURPLE';
      } else {
        color = 'RED';
      }

      return {
        id: wo.id,
        assetTag: wo.asset.tag,
        assetName: wo.asset.name,
        dueDate: due,
        status: wo.status,
        completedAt: wo.completedAt,
        color,
      };
    });
  }
}
