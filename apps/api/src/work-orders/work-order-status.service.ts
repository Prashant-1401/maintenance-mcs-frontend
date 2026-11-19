import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  OPEN: [WorkOrderStatus.ATTENDED, WorkOrderStatus.CANCELLED],
  ATTENDED: [WorkOrderStatus.CLOSED, WorkOrderStatus.CANCELLED],
  CLOSED: [],
  CANCELLED: [],
};

@Injectable()
export class WorkOrderStatusService {
  constructor(private readonly prisma: PrismaService) {}

  /** Validates and applies a status transition, always recording it to WorkOrderStatusHistory. */
  async transition(
    workOrderId: string,
    toStatus: WorkOrderStatus,
    user: AuthenticatedUser,
    notes?: string,
  ) {
    const workOrder = await this.prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });

    if (!ALLOWED_TRANSITIONS[workOrder.status].includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition work order from ${workOrder.status} to ${toStatus}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: toStatus,
          completedAt: toStatus === WorkOrderStatus.CLOSED ? new Date() : undefined,
        },
      }),
      this.prisma.workOrderStatusHistory.create({
        data: {
          workOrderId,
          fromStatus: workOrder.status,
          toStatus,
          changedById: user.id,
          notes,
        },
      }),
    ]);

    return updated;
  }
}
