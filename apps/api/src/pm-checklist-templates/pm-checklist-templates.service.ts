import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';

@Injectable()
export class PmChecklistTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateChecklistTemplateDto) {
    const existing = await this.prisma.pMChecklistTemplate.findMany({
      where: { name: dto.name },
      orderBy: { version: 'desc' },
      take: 1,
    });
    const version = (existing[0]?.version ?? 0) + 1;

    return this.prisma.pMChecklistTemplate.create({
      data: {
        name: dto.name,
        assetCategory: dto.assetCategory,
        maintenanceType: dto.maintenanceType,
        version,
        items: { create: dto.items },
      },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  findAll() {
    return this.prisma.pMChecklistTemplate.findMany({
      include: { items: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.pMChecklistTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Checklist template not found');
    }
    return template;
  }
}
