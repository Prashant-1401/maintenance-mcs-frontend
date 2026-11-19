import { PrismaClient, PermissionTier, MaintenanceType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres.edxhryewudcjljkcusaq:8Lp3cjvSgovsn9gQ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  }),
});

async function upsertRole(name: string, tier: PermissionTier, rank: number, hourlyRate: number, maintenanceType?: MaintenanceType) {
  return prisma.role.upsert({
    where: { name },
    update: { tier, rank, hourlyRate, maintenanceType },
    create: { name, tier, rank, hourlyRate, maintenanceType },
  });
}

async function upsertUser(email: string, name: string, roleId: string, password: string, active = true) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, roleId, passwordHash, active },
    create: { email, name, roleId, passwordHash, active },
  });
}

async function main() {
  console.log('⚠️  STARTING CLEAN RESET OF SUPABASE DATABASE…');

  // 1. Truncate all application data tables with cascade
  console.log('▶ Truncating all operational, work order, telemetry, spares, assets, and location tables…');
  const tables = [
    'work_order_predictive_readings',
    'work_order_checklist_responses',
    'work_order_spare_parts',
    'work_order_participants',
    'work_order_status_history',
    'deviation_notes',
    'breakdown_details',
    'rca_action_items',
    'rca_records',
    'pending_job_sheet_items',
    'work_orders',
    'predictive_schedules',
    'pm_schedules',
    'predictive_check_points',
    'predictive_checklist_templates',
    'pm_checklist_items',
    'pm_checklist_templates',
    'machine_operational_baselines',
    'troubleshooting_playbooks',
    'knowledge_bank_documents',
    'spare_parts',
    'assets',
    'locations',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }

  // 2. Provision Fresh Clean Core Roles & Test Accounts
  console.log('▶ Re-initializing standard roles & clean authentication accounts…');
  const adminRole = await upsertRole('Admin', PermissionTier.ADMIN, 1, 45.0);
  const headRole = await upsertRole('Head', PermissionTier.MANAGEMENT, 2, 40.0);
  const supervisorRole = await upsertRole('Supervisor', PermissionTier.MANAGEMENT, 3, 35.0);
  const fitterRole = await upsertRole('Fitter', PermissionTier.TECHNICIAN, 4, 25.0, MaintenanceType.MECHANICAL);
  const electricianRole = await upsertRole('Electrician', PermissionTier.TECHNICIAN, 4, 28.0, MaintenanceType.ELECTRICAL);
  const operatorRole = await upsertRole('Operator', PermissionTier.REQUESTER, 5, 20.0);

  // System account for background automated jobs
  const systemPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  await prisma.user.upsert({
    where: { email: 'system@maintenance.local' },
    update: { active: false },
    create: {
      email: 'system@maintenance.local',
      name: 'System Automation',
      roleId: adminRole.id,
      active: false,
      passwordHash: systemPasswordHash,
    },
  });

  await upsertUser('admin@maintenance.local', 'Plant Admin', adminRole.id, 'password123');
  await upsertUser('supervisor@maintenance.local', 'Shift Supervisor', supervisorRole.id, 'password123');
  await upsertUser('fitter@maintenance.local', 'Mechanical Fitter', fitterRole.id, 'password123');
  await upsertUser('electrician@maintenance.local', 'Plant Electrician', electricianRole.id, 'password123');
  await upsertUser('operator@maintenance.local', 'Machine Operator', operatorRole.id, 'password123');

  // Create default plant location
  await prisma.location.create({
    data: {
      name: 'General Production',
    },
  });

  console.log('✅ DATABASE RESET COMPLETE: All dummy data wiped. Clean accounts initialized.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Reset Error:', err);
  process.exit(1);
});
