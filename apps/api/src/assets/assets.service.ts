import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAssetDto) {
    return this.prisma.asset.create({ data: dto, include: { location: true } });
  }

  findAll() {
    return this.prisma.asset.findMany({
      include: { location: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { location: true },
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
  }

  async update(id: string, dto: UpdateAssetDto) {
    await this.findOne(id);
    return this.prisma.asset.update({ where: { id }, data: dto, include: { location: true } });
  }

  /** Upsert by tag (Machine Code). Location is resolved by name (sheet's "Line" column) or auto-created. */
  async upsertMany(rows: Record<string, string>[]) {
    const locations = await this.prisma.location.findMany();
    const locationByName = new Map(locations.map((l) => [l.name.toLowerCase().trim(), l]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const tag = row.tag?.trim();
      const name = row.name?.trim();
      if (!tag || !name) {
        skipped += 1;
        continue;
      }

      const lineName = (row.line?.trim() || 'General Production');
      let location = locationByName.get(lineName.toLowerCase());
      if (!location) {
        location = await this.prisma.location.create({
          data: { name: lineName },
        });
        locationByName.set(lineName.toLowerCase(), location);
      }

      const rawCrit = (row.criticality || 'MEDIUM').toUpperCase().trim();
      const criticality = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rawCrit)
        ? rawCrit
        : 'MEDIUM';

      const data = {
        tag,
        name,
        category: (row.category?.trim() || undefined),
        criticality: criticality as never,
        locationId: location.id,
      };

      const existing = await this.prisma.asset.findUnique({ where: { tag } });
      if (existing) {
        await this.prisma.asset.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await this.prisma.asset.create({ data });
        created += 1;
      }
    }
    return { created, updated, skipped };
  }
}
