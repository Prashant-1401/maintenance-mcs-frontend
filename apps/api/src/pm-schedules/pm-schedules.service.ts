import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeviationNoteStatus, PMTriggerType, WorkOrderStatus, WorkOrderType, type PMSchedule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { NotificationService } from '../notifications/notification.service';
import { SAFE_USER_SELECT } from '../common/safe-user.select';
import { CreatePmScheduleDto } from './dto/create-pm-schedule.dto';
import { StartScheduleDto } from './dto/start-schedule.dto';
import { DelayScheduleDto } from './dto/delay-schedule.dto';

const OPEN_OR_ATTENDED = [WorkOrderStatus.OPEN, WorkOrderStatus.ATTENDED];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SYSTEM_USER_EMAIL = 'system@maintenance.local';

@Injectable()
export class PmSchedulesService {
  private readonly logger = new Logger(PmSchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  create(dto: CreatePmScheduleDto) {
    return this.prisma.pMSchedule.create({
      data: {
        assetId: dto.assetId,
        name: dto.name,
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig as never,
        leadTimeDays: dto.leadTimeDays ?? 0,
        checklistTemplateId: dto.checklistTemplateId,
        active: dto.active ?? true,
      },
      include: { asset: true, checklistTemplate: true },
    });
  }

  findAll() {
    return this.prisma.pMSchedule.findMany({
      include: { asset: true, checklistTemplate: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.pMSchedule.findUnique({
      where: { id },
      include: { asset: true, checklistTemplate: { include: { items: true } } },
    });
    if (!schedule) {
      throw new NotFoundException('PM schedule not found');
    }
    return schedule;
  }

  /** Manual/forced generation, e.g. triggered by a Manager from the UI regardless of due date. */
  async generateNow(id: string, createdById: string) {
    const schedule = await this.findOne(id);
    return this.generateWorkOrder(schedule, createdById);
  }

  /** Past instances of this schedule (any status), newest first — replaces the old cross-schedule "PM Work Orders" list. */
  history(scheduleId: string) {
    return this.prisma.workOrder.findMany({
      where: { pmScheduleId: scheduleId },
      include: { assignedTo: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Preventive heatmap: one tile per asset, colored by the worst current-cycle status across that
   * asset's active PM schedules — DONE (latest instance CLOSED), PARTIAL (ATTENDED), or NOT_DONE
   * (OPEN or never generated). Grouped by line.
   */
  async heatmap(locationId?: string) {
    const schedules = await this.prisma.pMSchedule.findMany({
      where: { active: true },
      include: { asset: { include: { location: true } } },
    });

    const workOrders = await this.prisma.workOrder.findMany({
      where: { pmScheduleId: { in: schedules.map((s) => s.id) } },
      orderBy: { createdAt: 'desc' },
      select: { pmScheduleId: true, status: true },
    });
    const latestByScheduleId = new Map<string, (typeof workOrders)[number]>();
    for (const wo of workOrders) {
      if (!latestByScheduleId.has(wo.pmScheduleId!)) latestByScheduleId.set(wo.pmScheduleId!, wo);
    }

    const RANK: Record<string, number> = { DONE: 0, PARTIAL: 1, NOT_DONE: 2 };
    const byAsset = new Map<string, { asset: (typeof schedules)[number]['asset']; status: string }>();
    for (const schedule of schedules) {
      if (locationId && schedule.asset.locationId !== locationId) continue;
      const latest = latestByScheduleId.get(schedule.id);
      const status = !latest
        ? 'NOT_DONE'
        : latest.status === WorkOrderStatus.CLOSED
          ? 'DONE'
          : latest.status === WorkOrderStatus.ATTENDED
            ? 'PARTIAL'
            : 'NOT_DONE';
      const existing = byAsset.get(schedule.assetId);
      if (!existing || RANK[status] > RANK[existing.status]) {
        byAsset.set(schedule.assetId, { asset: schedule.asset, status });
      }
    }

    const byLocation = new Map<string, { locationId: string; locationName: string; assets: { asset: unknown; status: string }[] }>();
    for (const entry of byAsset.values()) {
      const locId = entry.asset.locationId;
      const group = byLocation.get(locId) ?? { locationId: locId, locationName: entry.asset.location.name, assets: [] };
      group.assets.push(entry);
      byLocation.set(locId, group);
    }

    return [...byLocation.values()];
  }

  /**
   * Start work on this schedule now: finds the current-cycle instance (or generates one if none
   * exists yet — idempotent, never double-generates), assigns the chosen technician, and
   * transitions OPEN -> ATTENDED. A reason is required only when starting off the schedule's own
   * due date (early or late) and only for TIME-triggered schedules (USAGE/METER have no due date).
   */
  async start(id: string, dto: StartScheduleDto, user: AuthenticatedUser) {
    const schedule = await this.findOne(id);
    let instance = await this.findCurrentInstance(id);
    if (!instance) {
      instance = await this.generateWorkOrder(schedule, user.id);
    }
    if (instance.status !== WorkOrderStatus.OPEN) {
      throw new BadRequestException(`This schedule's current work order is already ${instance.status}`);
    }

    if (this.isOffSchedule(schedule, instance) && !dto.reason?.trim()) {
      throw new BadRequestException('Starting off the due date — a reason is required');
    }

    const notes = [dto.reason ? `Off-schedule reason: ${dto.reason}` : null, dto.plannedNotes ? `Planned: ${dto.plannedNotes}` : null]
      .filter(Boolean)
      .join(' — ');

    const [updated] = await this.prisma.$transaction([
      this.prisma.workOrder.update({
        where: { id: instance.id },
        data: { assignedToId: dto.assignedToId, status: WorkOrderStatus.ATTENDED, plannedNotes: dto.plannedNotes },
      }),
      this.prisma.workOrderStatusHistory.create({
        data: {
          workOrderId: instance.id,
          fromStatus: WorkOrderStatus.OPEN,
          toStatus: WorkOrderStatus.ATTENDED,
          changedById: user.id,
          notes: notes || undefined,
        },
      }),
    ]);
    return updated;
  }

  private findCurrentInstance(scheduleId: string) {
    return this.prisma.workOrder.findFirst({
      where: { pmScheduleId: scheduleId, status: { in: OPEN_OR_ATTENDED } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isOffSchedule(schedule: PMSchedule, instance: { dueDate: Date | null }): boolean {
    if (schedule.triggerType !== PMTriggerType.TIME || !instance.dueDate) return false;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return startOfDay(new Date()) !== startOfDay(instance.dueDate);
  }

  /**
   * Raise a deviation note asking to push this schedule's due date out — does NOT reschedule
   * anything itself; an Admin/Management approval (via the Deviation Notes tab) does that.
   */
  async delay(id: string, dto: DelayScheduleDto, user: AuthenticatedUser) {
    const schedule = await this.findOne(id);
    let instance = await this.findCurrentInstance(id);
    if (!instance) {
      instance = await this.generateWorkOrder(schedule, user.id);
    }
    if (instance.status !== WorkOrderStatus.OPEN) {
      throw new BadRequestException(`This schedule's current work order is already ${instance.status} — cannot delay`);
    }
    if (!instance.dueDate) {
      throw new BadRequestException('This schedule has no due date to delay (usage/meter-triggered)');
    }

    const existingPending = await this.prisma.deviationNote.findFirst({
      where: { workOrderId: instance.id, status: DeviationNoteStatus.PENDING },
    });
    if (existingPending) {
      throw new BadRequestException('A deviation note is already pending approval for this work order');
    }

    const note = await this.prisma.deviationNote.create({
      data: {
        workOrderId: instance.id,
        raisedById: user.id,
        reason: dto.reason,
        originalDueDate: instance.dueDate,
        proposedDate: new Date(dto.proposedDate),
      },
      include: { workOrder: { include: { asset: true } }, raisedBy: { select: SAFE_USER_SELECT } },
    });

    await this.notifications.notifyDeviationRaised({
      asset: note.workOrder.asset,
      reason: note.reason,
      originalDueDate: note.originalDueDate,
      proposedDate: note.proposedDate,
      raisedByName: note.raisedBy.name,
    });

    return note;
  }

  /** The PM-due background job: evaluates every active schedule and generates a WorkOrder when due. */
  async evaluateDueSchedules() {
    const systemUserId = await this.getSystemUserId();
    const schedules = await this.prisma.pMSchedule.findMany({
      where: { active: true, triggerType: PMTriggerType.TIME },
      include: { asset: true, checklistTemplate: { include: { items: true } } },
    });

    const generated: string[] = [];
    for (const schedule of schedules) {
      if (this.isDue(schedule)) {
        await this.generateWorkOrder(schedule, systemUserId);
        generated.push(schedule.id);
      }
    }

    if (generated.length > 0) {
      this.logger.log(`Generated ${generated.length} PM work order(s) from due schedules`);
    }
    return generated;
  }

  private isDue(schedule: PMSchedule): boolean {
    const config = schedule.triggerConfig as { intervalDays?: number };
    const intervalDays = config?.intervalDays;
    if (schedule.triggerType !== PMTriggerType.TIME || !intervalDays) {
      return false;
    }
    const base = schedule.lastGeneratedAt ?? schedule.createdAt;
    const nextDue = base.getTime() + intervalDays * MS_PER_DAY;
    const leadMs = (schedule.leadTimeDays ?? 0) * MS_PER_DAY;
    return Date.now() >= nextDue - leadMs;
  }

  private computeDueDate(schedule: PMSchedule): Date | undefined {
    const config = schedule.triggerConfig as { intervalDays?: number };
    if (schedule.triggerType !== PMTriggerType.TIME || !config?.intervalDays) {
      return undefined;
    }
    const base = schedule.lastGeneratedAt ?? schedule.createdAt;
    return new Date(base.getTime() + config.intervalDays * MS_PER_DAY);
  }

  private async generateWorkOrder(
    schedule: PMSchedule & { checklistTemplate?: { items: { id: string }[] } | null },
    createdById: string,
  ) {
    const dueDate = this.computeDueDate(schedule);

    const workOrder = await this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          type: WorkOrderType.PM,
          status: WorkOrderStatus.OPEN,
          assetId: schedule.assetId,
          createdById,
          pmScheduleId: schedule.id,
          dueDate,
        },
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: wo.id,
          toStatus: WorkOrderStatus.OPEN,
          changedById: createdById,
          notes: `Generated from PM schedule "${schedule.name}"`,
        },
      });

      if (schedule.checklistTemplate?.items.length) {
        await tx.workOrderChecklistResponse.createMany({
          data: schedule.checklistTemplate.items.map((item) => ({
            workOrderId: wo.id,
            checklistItemId: item.id,
          })),
        });
      }

      await tx.pMSchedule.update({ where: { id: schedule.id }, data: { lastGeneratedAt: new Date() } });

      return wo;
    });

    return workOrder;
  }

  private async getSystemUserId(): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
    if (!user) {
      throw new NotFoundException(
        `System user (${SYSTEM_USER_EMAIL}) not found — run the seed script to create it`,
      );
    }
    return user.id;
  }
}
