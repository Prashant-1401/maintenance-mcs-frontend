import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkOrderStatus, WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkOrderStatusService } from '../work-orders/work-order-status.service';
import { WorkOrderCompletionService } from '../work-orders/work-order-completion.service';
import { PredictiveService } from '../predictive/predictive.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CompletePredictiveWorkOrderDto } from './dto/complete-predictive-work-order.dto';
import { SubmitPredictiveReadingsDto } from './dto/submit-predictive-readings.dto';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const DETAIL_INCLUDE = {
  asset: { include: { location: true } },
  createdBy: { select: SAFE_USER_SELECT },
  assignedTo: { select: SAFE_USER_SELECT },
  predictiveSchedule: { include: { checklistTemplate: true } },
  predictiveReadings: {
    include: { checkPoint: true, recordedBy: { select: SAFE_USER_SELECT } },
    orderBy: { checkPoint: { orderIndex: 'asc' as const } },
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
export class PredictiveWorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrderStatus: WorkOrderStatusService,
    private readonly predictive: PredictiveService,
    private readonly completion: WorkOrderCompletionService,
  ) {}

  findAll() {
    return this.prisma.workOrder.findMany({
      where: { type: WorkOrderType.PREDICTIVE },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, type: WorkOrderType.PREDICTIVE },
      include: DETAIL_INCLUDE,
    });
    if (!workOrder) {
      throw new NotFoundException('Predictive check work order not found');
    }
    return workOrder;
  }

  async start(id: string, user: AuthenticatedUser) {
    const workOrder = await this.getPredictiveWorkOrder(id);
    await this.workOrderStatus.transition(id, WorkOrderStatus.ATTENDED, user, 'Predictive check started');
    await this.prisma.workOrder.update({ where: { id }, data: { assignedToId: user.id } });
    return this.findOne(workOrder.id);
  }

  /** Saves progress on any number of checkpoints — callable any number of times while ATTENDED. */
  async submitReadings(id: string, dto: SubmitPredictiveReadingsDto, user: AuthenticatedUser) {
    await this.getPredictiveWorkOrder(id);

    const checkPointIds = dto.readings.map((r) => r.checkPointId);
    const checkPoints = await this.prisma.predictiveCheckPoint.findMany({ where: { id: { in: checkPointIds } } });
    const checkPointById = new Map(checkPoints.map((cp) => [cp.id, cp]));

    await Promise.all(
      dto.readings.map((reading) => {
        const checkPoint = checkPointById.get(reading.checkPointId);
        const status = checkPoint
          ? this.predictive.computeCheckPointStatus(checkPoint, {
              numericValue: reading.numericValue,
              passed: reading.passed,
            })
          : undefined;
        return this.prisma.workOrderPredictiveReading.update({
          where: { workOrderId_checkPointId: { workOrderId: id, checkPointId: reading.checkPointId } },
          data: {
            numericValue: reading.numericValue,
            passed: reading.passed,
            observedText: reading.observedText,
            remarks: reading.remarks,
            status,
            recordedById: user.id,
            recordedAt: new Date(),
          },
        });
      }),
    );

    return this.findOne(id);
  }

  async complete(id: string, dto: CompletePredictiveWorkOrderDto, user: AuthenticatedUser) {
    const workOrder = await this.getPredictiveWorkOrder(id);

    // Completion is allowed with a partially-filled set of readings — whatever's been recorded is
    // kept, and each reading stays null for anything skipped, so completeness can still be reported
    // on later without blocking the technician from closing the check now.
    await this.workOrderStatus.transition(id, WorkOrderStatus.CLOSED, user, 'Predictive check completed');

    const operations = await this.completion.buildOperations(id, workOrder.assetId, dto, user.id);
    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    return this.findOne(workOrder.id);
  }

  private async getPredictiveWorkOrder(id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, type: WorkOrderType.PREDICTIVE } });
    if (!workOrder) {
      throw new NotFoundException('Predictive check work order not found');
    }
    return workOrder;
  }
}
