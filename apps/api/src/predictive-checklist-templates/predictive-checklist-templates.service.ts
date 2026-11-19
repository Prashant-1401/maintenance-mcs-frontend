import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictiveChecklistTemplateDto } from './dto/create-predictive-checklist-template.dto';

@Injectable()
export class PredictiveChecklistTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePredictiveChecklistTemplateDto) {
    const existing = await this.prisma.predictiveChecklistTemplate.findMany({
      where: { name: dto.name },
      orderBy: { version: 'desc' },
      take: 1,
    });
    const version = (existing[0]?.version ?? 0) + 1;

    return this.prisma.predictiveChecklistTemplate.create({
      data: {
        name: dto.name,
        assetCategory: dto.assetCategory,
        maintenanceType: dto.maintenanceType,
        version,
        checkPoints: { create: dto.checkPoints },
      },
      include: { checkPoints: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  findAll() {
    return this.prisma.predictiveChecklistTemplate.findMany({
      include: { checkPoints: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.predictiveChecklistTemplate.findUnique({
      where: { id },
      include: { checkPoints: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Predictive checklist template not found');
    }
    return template;
  }
}
