import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({ orderBy: { rank: 'asc' } });
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }
    return this.prisma.role.create({ data: dto });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  /** Upsert by name — the sheet's natural unique key. */
  async upsertMany(rows: Record<string, string>[]) {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (!row.name || !row.tier) continue;
      const data = {
        name: row.name,
        tier: row.tier as never,
        rank: row.rank ? Number(row.rank) : 100,
        capacity: row.capacity ? Number(row.capacity) : 5,
        hourlyRate: row.hourlyRate ? Number(row.hourlyRate) : undefined,
        maintenanceType: row.maintenanceType ? (row.maintenanceType as never) : undefined,
      };
      const existing = await this.prisma.role.findUnique({ where: { name: row.name } });
      if (existing) {
        await this.prisma.role.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await this.prisma.role.create({ data });
        created += 1;
      }
    }
    return { created, updated };
  }
}
