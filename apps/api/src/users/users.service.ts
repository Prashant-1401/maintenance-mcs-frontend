import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SAFE_USER_SELECT } from '../common/safe-user.select';

const SAFE_FIELDS = { ...SAFE_USER_SELECT, active: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { email: dto.email, name: dto.name, roleId: dto.roleId, passwordHash },
      select: SAFE_FIELDS,
    });
  }

  findAll() {
    return this.prisma.user.findMany({ select: SAFE_FIELDS, orderBy: { createdAt: 'desc' } });
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.user.update({ where: { id }, data: dto, select: SAFE_FIELDS });
  }

  /**
   * Upsert by email. Role is resolved by name (sheet's "Role" column). New users get a fixed
   * onboarding password they must be told to change — the sheet can't safely carry plaintext
   * passwords.
   */
  async upsertMany(rows: Record<string, string>[]) {
    const roles = await this.prisma.role.findMany();
    const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row.email || !row.name) {
        skipped += 1;
        continue;
      }
      const role = row.role ? roleByName.get(row.role.toLowerCase()) : undefined;
      if (!role) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.user.findUnique({ where: { email: row.email } });
      if (existing) {
        await this.prisma.user.update({ where: { id: existing.id }, data: { name: row.name, roleId: role.id } });
        updated += 1;
      } else {
        const passwordHash = await bcrypt.hash('Welcome123!', 10);
        await this.prisma.user.create({ data: { email: row.email, name: row.name, roleId: role.id, passwordHash } });
        created += 1;
      }
    }
    return { created, updated, skipped, note: created > 0 ? 'New users default to password "Welcome123!" — tell them to change it.' : undefined };
  }
}
