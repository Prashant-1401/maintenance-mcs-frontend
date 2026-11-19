import { Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../common/safe-user.select';
import { CreateKnowledgeBankDocumentDto } from './dto/create-knowledge-bank-document.dto';
import { CreateOperationalBaselineDto } from './dto/create-operational-baseline.dto';
import { CreateTroubleshootingPlaybookDto } from './dto/create-playbook.dto';

@Injectable()
export class KnowledgeBankService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Documents & Manuals
  findAll(filters?: { search?: string; category?: string; assetId?: string }) {
    const { search, category, assetId } = filters || {};
    const where: any = {};

    if (category) {
      where.category = category;
    }
    if (assetId) {
      where.assetId = assetId;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
        { machineModel: { contains: search, mode: 'insensitive' } },
        { asset: { tag: { contains: search, mode: 'insensitive' } } },
        { asset: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.knowledgeBankDocument.findMany({
      where,
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
        uploadedBy: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.knowledgeBankDocument.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
        uploadedBy: { select: SAFE_USER_SELECT },
      },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }

  create(dto: CreateKnowledgeBankDocumentDto, file: Express.Multer.File, uploadedById: string) {
    return this.prisma.knowledgeBankDocument.create({
      data: {
        title: dto.title,
        category: dto.category,
        assetId: dto.assetId || null,
        tags: dto.tags || null,
        machineModel: dto.machineModel || null,
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedById,
      },
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
        uploadedBy: { select: SAFE_USER_SELECT },
      },
    });
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    await this.prisma.knowledgeBankDocument.delete({ where: { id } });
    await unlink(doc.filePath).catch(() => undefined);
    return { success: true };
  }

  // 2. Machine Operational Baselines
  findBaselines(filters?: { assetId?: string; search?: string }) {
    const { assetId, search } = filters || {};
    const where: any = {};
    if (assetId) where.assetId = assetId;
    if (search) {
      where.OR = [
        { parameterName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { asset: { tag: { contains: search, mode: 'insensitive' } } },
        { asset: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.machineOperationalBaseline.findMany({
      where,
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
      },
      orderBy: { parameterName: 'asc' },
    });
  }

  createBaseline(dto: CreateOperationalBaselineDto) {
    return this.prisma.machineOperationalBaseline.create({
      data: dto,
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
      },
    });
  }

  async updateBaseline(id: string, dto: Partial<CreateOperationalBaselineDto>) {
    const existing = await this.prisma.machineOperationalBaseline.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Operational baseline not found');
    return this.prisma.machineOperationalBaseline.update({
      where: { id },
      data: dto,
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
      },
    });
  }

  async removeBaseline(id: string) {
    await this.prisma.machineOperationalBaseline.delete({ where: { id } });
    return { success: true };
  }

  // 3. Troubleshooting Playbooks
  findPlaybooks(filters?: { search?: string; assetId?: string; assetCategory?: string }) {
    const { search, assetId, assetCategory } = filters || {};
    const where: any = {};
    if (assetId) where.assetId = assetId;
    if (assetCategory) where.assetCategory = assetCategory;
    if (search) {
      where.OR = [
        { symptom: { contains: search, mode: 'insensitive' } },
        { probableCause: { contains: search, mode: 'insensitive' } },
        { standardFix: { contains: search, mode: 'insensitive' } },
        { assetCategory: { contains: search, mode: 'insensitive' } },
        { asset: { tag: { contains: search, mode: 'insensitive' } } },
        { asset: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return this.prisma.troubleshootingPlaybook.findMany({
      where,
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createPlaybook(dto: CreateTroubleshootingPlaybookDto) {
    return this.prisma.troubleshootingPlaybook.create({
      data: dto,
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
      },
    });
  }

  async updatePlaybook(id: string, dto: Partial<CreateTroubleshootingPlaybookDto>) {
    const existing = await this.prisma.troubleshootingPlaybook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Playbook not found');
    return this.prisma.troubleshootingPlaybook.update({
      where: { id },
      data: dto,
      include: {
        asset: { select: { id: true, tag: true, name: true, category: true } },
      },
    });
  }

  async removePlaybook(id: string) {
    await this.prisma.troubleshootingPlaybook.delete({ where: { id } });
    return { success: true };
  }
}

