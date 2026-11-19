import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkOrderStatus, WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkOrderStatusService } from '../work-orders/work-order-status.service';
import { WorkOrderCompletionService } from '../work-orders/work-order-completion.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SubmitChecklistResponsesDto } from './dto/submit-checklist-responses.dto';
import { CompletePmWorkOrderDto } from './dto/complete-pm-work-order.dto';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const DETAIL_INCLUDE = {
  asset: { include: { location: true } },
  createdBy: { select: SAFE_USER_SELECT },
  assignedTo: { select: SAFE_USER_SELECT },
  pmSchedule: true,
  checklistResponses: {
    include: { checklistItem: true, completedBy: { select: SAFE_USER_SELECT } },
  },
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
export class PmWorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrderStatus: WorkOrderStatusService,
    private readonly completion: WorkOrderCompletionService,
  ) {}

  findAll() {
    return this.prisma.workOrder.findMany({
      where: { type: WorkOrderType.PM },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, type: WorkOrderType.PM },
      include: DETAIL_INCLUDE,
    });
    if (!workOrder) {
      throw new NotFoundException('PM work order not found');
    }
    return workOrder;
  }

  async start(id: string, user: AuthenticatedUser) {
    await this.getPmWorkOrder(id);
    await this.workOrderStatus.transition(id, WorkOrderStatus.ATTENDED, user, 'PM started');
    await this.prisma.workOrder.update({ where: { id }, data: { assignedToId: user.id } });
    return this.findOne(id);
  }

  async submitResponses(id: string, dto: SubmitChecklistResponsesDto, user: AuthenticatedUser) {
    await this.getPmWorkOrder(id);

    await Promise.all(
      dto.responses.map((response) =>
        this.prisma.workOrderChecklistResponse.update({
          where: { workOrderId_checklistItemId: { workOrderId: id, checklistItemId: response.checklistItemId } },
          data: {
            value: response.value,
            passed: response.passed,
            remarks: response.remarks,
            completedById: user.id,
            completedAt: new Date(),
          },
        }),
      ),
    );

    return this.findOne(id);
  }

  async complete(id: string, dto: CompletePmWorkOrderDto, user: AuthenticatedUser) {
    const workOrder = await this.getPmWorkOrder(id);

    // Completion is allowed with a partially-filled checklist — whatever's been answered is kept,
    // and each response's value/passed stays null for anything skipped, so completeness can still
    // be reported on later without blocking the technician from closing the job now.
    await this.workOrderStatus.transition(id, WorkOrderStatus.CLOSED, user, 'PM completed');

    const operations = await this.completion.buildOperations(id, workOrder.assetId, dto, user.id);
    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    return this.findOne(workOrder.id);
  }

  private async getPmWorkOrder(id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, type: WorkOrderType.PM } });
    if (!workOrder) {
      throw new NotFoundException('PM work order not found');
    }
    return workOrder;
  }
}
