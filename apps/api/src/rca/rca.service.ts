import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionTier, RcaActionStatus, RcaRecordStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateRcaRecordDto } from './dto/create-rca-record.dto';
import { UpdateRcaRecordDto } from './dto/update-rca-record.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';
import { UpdateFullActionItemDto } from './dto/update-full-action-item.dto';
import { AddActionItemDto } from './dto/add-action-item.dto';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const RCA_INCLUDE = {
  workOrder: { include: { asset: true } },
  createdBy: { select: SAFE_USER_SELECT },
  actionItems: {
    include: {
      owner: { select: SAFE_USER_SELECT },
      verifiedBy: { select: SAFE_USER_SELECT },
    },
  },
};

const ACTION_ITEM_INCLUDE = {
  owner: { select: SAFE_USER_SELECT },
  verifiedBy: { select: SAFE_USER_SELECT },
};

@Injectable()
export class RcaService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateRcaRecordDto, user: AuthenticatedUser) {
    const status = dto.status ?? RcaRecordStatus.DRAFT;
    if (status === RcaRecordStatus.FINAL) {
      this.assertFinalizable(dto.rootCause);
    }

    return this.prisma.rcaRecord.create({
      data: {
        workOrderId: dto.workOrderId,
        method: dto.method,
        whySteps: dto.whySteps as never,
        fishboneCauses: dto.fishboneCauses as never,
        rootCause: dto.rootCause,
        remarks: dto.remarks,
        status,
        createdById: user.id,
        actionItems: {
          create: (dto.actionItems ?? []).map((item) => ({
            description: item.description,
            type: item.type,
            ownerId: item.ownerId,
            dueDate: new Date(item.dueDate),
          })),
        },
      },
      include: RCA_INCLUDE,
    });
  }

  findAll() {
    return this.prisma.rcaRecord.findMany({ include: RCA_INCLUDE, orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const record = await this.prisma.rcaRecord.findUnique({ where: { id }, include: RCA_INCLUDE });
    if (!record) {
      throw new NotFoundException('RCA record not found');
    }
    return record;
  }

  findForWorkOrder(workOrderId: string) {
    return this.prisma.rcaRecord.findMany({ where: { workOrderId }, include: RCA_INCLUDE });
  }

  async update(id: string, dto: UpdateRcaRecordDto, user: AuthenticatedUser) {
    const record = await this.prisma.rcaRecord.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('RCA record not found');
    }
    this.assertCanEdit(record.createdById, user);

    const status = dto.status ?? record.status;
    if (status === RcaRecordStatus.FINAL) {
      this.assertFinalizable(dto.rootCause ?? record.rootCause ?? undefined);
    }

    return this.prisma.rcaRecord.update({
      where: { id },
      data: {
        rootCause: dto.rootCause,
        remarks: dto.remarks,
        whySteps: dto.whySteps as never,
        fishboneCauses: dto.fishboneCauses as never,
        status,
      },
      include: RCA_INCLUDE,
    });
  }

  /** Full validation is only enforced when an RCA transitions to FINAL. */
  private assertFinalizable(rootCause: string | undefined) {
    if (!rootCause || !rootCause.trim()) {
      throw new BadRequestException('Root cause is required to finalize an RCA');
    }
  }

  async addActionItem(rcaRecordId: string, dto: AddActionItemDto, user: AuthenticatedUser) {
    const record = await this.prisma.rcaRecord.findUnique({ where: { id: rcaRecordId } });
    if (!record) {
      throw new NotFoundException('RCA record not found');
    }
    this.assertCanEdit(record.createdById, user);

    await this.prisma.rcaActionItem.create({
      data: {
        rcaRecordId,
        description: dto.description,
        type: dto.type,
        ownerId: dto.ownerId,
        dueDate: new Date(dto.dueDate),
      },
    });
    return this.findOne(rcaRecordId);
  }

  /** The RCA tracker — action items grouped by their parent RCA, with an overdue flag. */
  async actionItems(filters: { status?: RcaActionStatus; ownerId?: string }) {
    const items = await this.prisma.rcaActionItem.findMany({
      where: {
        rcaRecord: { status: RcaRecordStatus.FINAL },
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      },
      include: {
        ...ACTION_ITEM_INCLUDE,
        rcaRecord: { include: { workOrder: { include: { asset: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = Date.now();
    const withOverdue = items.map((item) => ({
      ...item,
      overdue: item.dueDate.getTime() < now && item.status !== RcaActionStatus.DONE && item.status !== RcaActionStatus.VERIFIED,
    }));

    const groups = new Map<string, { rcaRecordId: string; asset: unknown; method: unknown; createdAt: Date; actionItems: typeof withOverdue }>();
    for (const item of withOverdue) {
      const key = item.rcaRecordId;
      if (!groups.has(key)) {
        groups.set(key, {
          rcaRecordId: key,
          asset: item.rcaRecord.workOrder.asset,
          method: item.rcaRecord.method,
          createdAt: item.rcaRecord.createdAt,
          actionItems: [],
        });
      }
      groups.get(key)!.actionItems.push(item);
    }

    return [...groups.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateActionItemStatus(id: string, dto: UpdateActionItemDto, user: AuthenticatedUser) {
    const existing = await this.prisma.rcaActionItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('RCA action item not found');
    }

    return this.prisma.rcaActionItem.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === RcaActionStatus.DONE ? new Date() : existing.completedAt,
        verifiedById: dto.status === RcaActionStatus.VERIFIED ? user.id : existing.verifiedById,
      },
      include: ACTION_ITEM_INCLUDE,
    });
  }

  async updateActionItem(id: string, dto: UpdateFullActionItemDto, user: AuthenticatedUser) {
    const existing = await this.prisma.rcaActionItem.findUnique({ where: { id }, include: { rcaRecord: true } });
    if (!existing) {
      throw new NotFoundException('RCA action item not found');
    }
    this.assertCanEdit(existing.rcaRecord.createdById, user);

    return this.prisma.rcaActionItem.update({
      where: { id },
      data: {
        description: dto.description,
        type: dto.type,
        ownerId: dto.ownerId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: ACTION_ITEM_INCLUDE,
    });
  }

  async removeActionItem(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.rcaActionItem.findUnique({ where: { id }, include: { rcaRecord: true } });
    if (!existing) {
      throw new NotFoundException('RCA action item not found');
    }
    this.assertCanEdit(existing.rcaRecord.createdById, user);

    await this.prisma.rcaActionItem.delete({ where: { id } });
    return { success: true };
  }

  /** Creator can edit their own RCA; Admin/Management can edit any. */
  private assertCanEdit(rcaCreatedById: string, user: AuthenticatedUser) {
    const isPrivileged = user.tier === PermissionTier.ADMIN || user.tier === PermissionTier.MANAGEMENT;
    if (!isPrivileged && rcaCreatedById !== user.id) {
      throw new ForbiddenException('You can only edit RCAs you created');
    }
  }
}
