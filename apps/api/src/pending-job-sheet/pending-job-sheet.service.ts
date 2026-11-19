import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PendingJobSheetStatus, PermissionTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { UpdatePendingJobSheetItemDto } from './dto/update-pending-job-sheet-item.dto';
import { CreatePendingJobSheetItemDto } from './dto/create-pending-job-sheet-item.dto';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const DETAIL_INCLUDE = {
  asset: { include: { location: true } },
  workOrder: true,
  raisedBy: { select: SAFE_USER_SELECT },
  assignedTo: { select: SAFE_USER_SELECT },
};

@Injectable()
export class PendingJobSheetService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: { status?: PendingJobSheetStatus; assignedToId?: string; assetId?: string }) {
    return this.prisma.pendingJobSheetItem.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(filters.assetId ? { assetId: filters.assetId } : {}),
      },
      include: DETAIL_INCLUDE,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  /** Manually raised action with no source work order — e.g. a walkdown finding. */
  create(dto: CreatePendingJobSheetItemDto, user: AuthenticatedUser) {
    return this.prisma.pendingJobSheetItem.create({
      data: {
        assetId: dto.assetId,
        description: dto.description,
        raisedById: user.id,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: DETAIL_INCLUDE,
    });
  }

  async update(id: string, dto: UpdatePendingJobSheetItemDto, user: AuthenticatedUser) {
    const existing = await this.prisma.pendingJobSheetItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Pending job sheet item not found');
    }

    const canTriage = user.tier === PermissionTier.ADMIN || user.tier === PermissionTier.MANAGEMENT;
    const isOwnItem = existing.assignedToId === user.id;

    if (!canTriage) {
      if (!isOwnItem) {
        throw new ForbiddenException('You can only update items assigned to you');
      }
      if (dto.assignedToId !== undefined || dto.dueDate !== undefined) {
        throw new ForbiddenException('You can only update the status of your own items');
      }
    }

    return this.prisma.pendingJobSheetItem.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt: dto.status === PendingJobSheetStatus.DONE ? new Date() : existing.completedAt,
      },
      include: DETAIL_INCLUDE,
    });
  }
}
