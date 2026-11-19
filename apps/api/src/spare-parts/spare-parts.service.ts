import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSparePartDto } from './dto/create-spare-part.dto';
import { UpdateSparePartDto } from './dto/update-spare-part.dto';

export interface InventoryFilterDto {
  search?: string;
  type?: WorkOrderType;
  assetId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class SparePartsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.sparePart.findMany({ orderBy: { itemCode: 'asc' } });
  }

  async getInventory(filters?: InventoryFilterDto) {
    const { search, type, assetId, from, to } = filters || {};

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    // Fetch all master spare parts with usages
    const masterParts = await this.prisma.sparePart.findMany({
      include: {
        usages: {
          include: {
            workOrder: {
              include: {
                asset: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { itemCode: 'asc' },
    });

    // Also fetch ad-hoc spare parts (sparePartId is null)
    const adhocUsages = await this.prisma.workOrderSparePart.findMany({
      where: {
        sparePartId: null,
      },
      include: {
        workOrder: {
          include: {
            asset: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Helper to test if a usage fits filters
    const matchesUsage = (u: (typeof masterParts)[0]['usages'][0]) => {
      if (type && u.workOrder.type !== type) return false;
      if (assetId && u.workOrder.assetId !== assetId) return false;
      const date = u.createdAt;
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    };

    const items: Array<{
      id: string;
      itemCode: string;
      name: string;
      unit: string | null;
      unitCost: number | null;
      timesUsed: number;
      totalQuantityUsed: number;
      totalCost: number;
      lastUsedAt: string | null;
      breakdownCount: number;
      pmCount: number;
      predictiveCount: number;
      usages: Array<{
        id: string;
        workOrderId: string;
        workOrderType: string;
        workOrderStatus: string;
        assetId: string;
        assetTag: string;
        assetName: string;
        quantity: number;
        unit: string | null;
        unitCost: number | null;
        totalCost: number;
        usedAt: string;
      }>;
    }> = [];

    // Process master parts
    for (const part of masterParts) {
      const filteredUsages = part.usages.filter(matchesUsage);
      const timesUsed = filteredUsages.length;
      const totalQuantityUsed = filteredUsages.reduce((sum, u) => sum + (u.quantity || 0), 0);
      const totalCost = filteredUsages.reduce((sum, u) => {
        const cost = u.unitCost ?? part.unitCost ?? 0;
        return sum + (u.quantity || 0) * cost;
      }, 0);

      const lastUsedAt = filteredUsages.length > 0 ? filteredUsages[0].createdAt.toISOString() : null;

      let breakdownCount = 0;
      let pmCount = 0;
      let predictiveCount = 0;

      const formattedUsages = filteredUsages.map((u) => {
        if (u.workOrder.type === 'BREAKDOWN') breakdownCount++;
        else if (u.workOrder.type === 'PM') pmCount++;
        else if (u.workOrder.type === 'PREDICTIVE') predictiveCount++;

        const cost = u.unitCost ?? part.unitCost ?? 0;
        return {
          id: u.id,
          workOrderId: u.workOrderId,
          workOrderType: u.workOrder.type,
          workOrderStatus: u.workOrder.status,
          assetId: u.workOrder.assetId,
          assetTag: u.workOrder.asset?.tag ?? '—',
          assetName: u.workOrder.asset?.name ?? '—',
          quantity: u.quantity,
          unit: u.unit ?? part.unit,
          unitCost: u.unitCost ?? part.unitCost,
          totalCost: (u.quantity || 0) * cost,
          usedAt: u.createdAt.toISOString(),
        };
      });

      items.push({
        id: part.id,
        itemCode: part.itemCode,
        name: part.name,
        unit: part.unit,
        unitCost: part.unitCost,
        timesUsed,
        totalQuantityUsed: Math.round(totalQuantityUsed * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        lastUsedAt,
        breakdownCount,
        pmCount,
        predictiveCount,
        usages: formattedUsages,
      });
    }

    // Process ad-hoc items grouped by description
    const adhocGrouped = new Map<string, typeof adhocUsages>();
    for (const adhoc of adhocUsages) {
      if (!matchesUsage(adhoc as never)) continue;
      const key = adhoc.description?.trim().toLowerCase() || 'unnamed-spare';
      if (!adhocGrouped.has(key)) {
        adhocGrouped.set(key, []);
      }
      adhocGrouped.get(key)!.push(adhoc);
    }

    for (const [desc, usages] of adhocGrouped.entries()) {
      const timesUsed = usages.length;
      const totalQuantityUsed = usages.reduce((sum, u) => sum + (u.quantity || 0), 0);
      const totalCost = usages.reduce((sum, u) => sum + (u.quantity || 0) * (u.unitCost || 0), 0);
      const lastUsedAt = usages[0]?.createdAt.toISOString() ?? null;

      let breakdownCount = 0;
      let pmCount = 0;
      let predictiveCount = 0;

      const formattedUsages = usages.map((u) => {
        if (u.workOrder.type === 'BREAKDOWN') breakdownCount++;
        else if (u.workOrder.type === 'PM') pmCount++;
        else if (u.workOrder.type === 'PREDICTIVE') predictiveCount++;

        return {
          id: u.id,
          workOrderId: u.workOrderId,
          workOrderType: u.workOrder.type,
          workOrderStatus: u.workOrder.status,
          assetId: u.workOrder.assetId,
          assetTag: u.workOrder.asset?.tag ?? '—',
          assetName: u.workOrder.asset?.name ?? '—',
          quantity: u.quantity,
          unit: u.unit,
          unitCost: u.unitCost,
          totalCost: (u.quantity || 0) * (u.unitCost || 0),
          usedAt: u.createdAt.toISOString(),
        };
      });

      items.push({
        id: `adhoc-${desc}`,
        itemCode: 'ADHOC',
        name: usages[0]?.description || desc,
        unit: usages[0]?.unit ?? null,
        unitCost: usages[0]?.unitCost ?? null,
        timesUsed,
        totalQuantityUsed: Math.round(totalQuantityUsed * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        lastUsedAt,
        breakdownCount,
        pmCount,
        predictiveCount,
        usages: formattedUsages,
      });
    }

    // Filter by search term if provided
    let filteredItems = items;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredItems = items.filter((item) => item.name.toLowerCase().includes(q) || item.itemCode.toLowerCase().includes(q));
    }

    // Sort by timesUsed desc, then totalQuantityUsed desc
    filteredItems.sort((a, b) => {
      if (b.timesUsed !== a.timesUsed) return b.timesUsed - a.timesUsed;
      if (b.totalQuantityUsed !== a.totalQuantityUsed) return b.totalQuantityUsed - a.totalQuantityUsed;
      return a.name.localeCompare(b.name);
    });

    // Summary calculations
    const totalMasterParts = masterParts.length;
    const usedItems = items.filter((i) => i.timesUsed > 0);
    const totalUniqueUsed = usedItems.length;
    const totalQuantityConsumed = Math.round(usedItems.reduce((sum, i) => sum + i.totalQuantityUsed, 0) * 100) / 100;
    const totalCostSpent = Math.round(usedItems.reduce((sum, i) => sum + i.totalCost, 0) * 100) / 100;
    const totalBreakdownUsages = usedItems.reduce((sum, i) => sum + i.breakdownCount, 0);
    const totalPmUsages = usedItems.reduce((sum, i) => sum + i.pmCount, 0);
    const totalPredictiveUsages = usedItems.reduce((sum, i) => sum + i.predictiveCount, 0);

    const topUsedItems = [...items]
      .filter((i) => i.timesUsed > 0)
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, 5)
      .map((i) => ({ name: i.name, itemCode: i.itemCode, timesUsed: i.timesUsed, totalQuantityUsed: i.totalQuantityUsed }));

    const topCostItems = [...items]
      .filter((i) => i.totalCost > 0)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5)
      .map((i) => ({ name: i.name, itemCode: i.itemCode, totalCost: i.totalCost, totalQuantityUsed: i.totalQuantityUsed }));

    return {
      summary: {
        totalMasterParts,
        totalUniqueUsed,
        totalQuantityConsumed,
        totalCostSpent,
        totalBreakdownUsages,
        totalPmUsages,
        totalPredictiveUsages,
        topUsedItems,
        topCostItems,
      },
      items: filteredItems,
    };
  }

  async create(dto: CreateSparePartDto) {
    const existing = await this.prisma.sparePart.findUnique({ where: { itemCode: dto.itemCode } });
    if (existing) {
      throw new ConflictException('A spare part with this item code already exists');
    }
    return this.prisma.sparePart.create({ data: dto });
  }

  async update(id: string, dto: UpdateSparePartDto) {
    const existing = await this.prisma.sparePart.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Spare part not found');
    }
    return this.prisma.sparePart.update({ where: { id }, data: dto });
  }

  /** Upsert by itemCode — the sheet's natural unique key. */
  async upsertMany(rows: Record<string, string>[]) {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (!row.itemCode) continue;
      const data = {
        itemCode: row.itemCode,
        name: row.name || row.itemCode,
        unit: row.unit || undefined,
        unitCost: row.unitCost ? Number(row.unitCost) : undefined,
      };
      const existing = await this.prisma.sparePart.findUnique({ where: { itemCode: row.itemCode } });
      if (existing) {
        await this.prisma.sparePart.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await this.prisma.sparePart.create({ data });
        created += 1;
      }
    }
    return { created, updated };
  }
}
