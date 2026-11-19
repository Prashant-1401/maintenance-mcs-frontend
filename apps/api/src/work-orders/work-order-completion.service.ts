import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompletionCaptureDto } from './dto/completion-capture.dto';

@Injectable()
export class WorkOrderCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the extra writes for spares consumed / participants / follow-up pending job sheet
   * items, to be included alongside the status-transition writes in a single `$transaction`.
   */
  async buildOperations(
    workOrderId: string,
    assetId: string,
    dto: CompletionCaptureDto,
    userId: string,
  ): Promise<Prisma.PrismaPromise<unknown>[]> {
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (dto.spareParts?.length) {
      const masterIds = dto.spareParts.map((p) => p.sparePartId).filter((id): id is string => !!id);
      const masterParts = masterIds.length
        ? await this.prisma.sparePart.findMany({ where: { id: { in: masterIds } } })
        : [];

      const sparePartRows = dto.spareParts.map((part) => {
        if (part.sparePartId) {
          const master = masterParts.find((m) => m.id === part.sparePartId);
          if (!master) {
            throw new BadRequestException(`Unknown spare part: ${part.sparePartId}`);
          }
          return {
            workOrderId,
            sparePartId: master.id,
            description: `${master.itemCode} — ${master.name}`,
            quantity: part.quantity,
            unit: part.unit ?? master.unit,
            unitCost: master.unitCost,
          };
        }
        if (!part.description) {
          throw new BadRequestException('Spare part entry needs either sparePartId or description');
        }
        return {
          workOrderId,
          description: part.description,
          quantity: part.quantity,
          unit: part.unit,
          unitCost: part.unitCost,
        };
      });

      operations.push(this.prisma.workOrderSparePart.createMany({ data: sparePartRows }));
    }

    if (dto.participants?.length) {
      operations.push(
        this.prisma.workOrderParticipant.createMany({
          data: dto.participants.map((p) => ({ workOrderId, userId: p.userId, hoursSpent: p.hoursSpent })),
          skipDuplicates: true,
        }),
      );
    }

    if (dto.futureActions?.length) {
      operations.push(
        this.prisma.pendingJobSheetItem.createMany({
          data: dto.futureActions.map((action) => ({
            workOrderId,
            assetId,
            description: action.description,
            raisedById: userId,
            assignedToId: action.assignedToId,
            dueDate: action.dueDate ? new Date(action.dueDate) : undefined,
          })),
        }),
      );
    }

    return operations;
  }
}
