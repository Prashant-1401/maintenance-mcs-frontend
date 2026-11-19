import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviationNoteStatus, WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const INCLUDE = {
  workOrder: { include: { asset: true } },
  raisedBy: { select: SAFE_USER_SELECT },
  approvedBy: { select: SAFE_USER_SELECT },
};

@Injectable()
export class DeviationNotesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: { type?: WorkOrderType; status?: DeviationNoteStatus }) {
    return this.prisma.deviationNote.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.type ? { workOrder: { type: filters.type } } : {}),
      },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, user: AuthenticatedUser) {
    const note = await this.assertPending(id);

    const [, updated] = await this.prisma.$transaction([
      this.prisma.workOrder.update({ where: { id: note.workOrderId }, data: { dueDate: note.proposedDate } }),
      this.prisma.deviationNote.update({
        where: { id },
        data: { status: DeviationNoteStatus.APPROVED, approvedById: user.id, approvedAt: new Date() },
        include: INCLUDE,
      }),
    ]);
    return updated;
  }

  async reject(id: string, user: AuthenticatedUser) {
    await this.assertPending(id);
    return this.prisma.deviationNote.update({
      where: { id },
      data: { status: DeviationNoteStatus.REJECTED, approvedById: user.id, approvedAt: new Date() },
      include: INCLUDE,
    });
  }

  private async assertPending(id: string) {
    const note = await this.prisma.deviationNote.findUnique({ where: { id } });
    if (!note) {
      throw new NotFoundException('Deviation note not found');
    }
    if (note.status !== DeviationNoteStatus.PENDING) {
      throw new BadRequestException(`This deviation note is already ${note.status}`);
    }
    return note;
  }
}
