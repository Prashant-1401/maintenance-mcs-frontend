import { PrismaClient, PermissionTier, MaintenanceType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function upsertRole(
  name: string,
  tier: PermissionTier,
  rank: number,
  maintenanceType?: MaintenanceType,
) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name, tier, rank, maintenanceType },
  });
}

async function upsertUser(email: string, name: string, roleId: string, password: string, active = true) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, roleId, passwordHash, active },
  });
}

async function main() {
  const adminRole = await upsertRole('Admin', PermissionTier.ADMIN, 1);
  const headRole = await upsertRole('Head', PermissionTier.MANAGEMENT, 2);
  const supervisorRole = await upsertRole('Supervisor', PermissionTier.MANAGEMENT, 3);
  const fitterRole = await upsertRole('Fitter', PermissionTier.TECHNICIAN, 4, MaintenanceType.MECHANICAL);
  const electricianRole = await upsertRole('Electrician', PermissionTier.TECHNICIAN, 4, MaintenanceType.ELECTRICAL);
  const operatorRole = await upsertRole('Operator', PermissionTier.REQUESTER, 5);

  // Non-interactive account used as `createdBy` for work orders the system auto-generates
  // (e.g. PM schedules firing on a timer). `active: false` means it can never log in.
  const systemPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  await prisma.user.upsert({
    where: { email: 'system@maintenance.local' },
    update: {},
    create: {
      email: 'system@maintenance.local',
      name: 'System',
      roleId: adminRole.id,
      active: false,
      passwordHash: systemPasswordHash,
    },
  });

  const admin = await upsertUser('admin@maintenance.local', 'Admin User', adminRole.id, 'password123');
  await upsertUser('head@maintenance.local', 'Head User', headRole.id, 'password123');
  await upsertUser('supervisor@maintenance.local', 'Supervisor User', supervisorRole.id, 'password123');
  const fitter = await upsertUser('fitter@maintenance.local', 'Fitter User', fitterRole.id, 'password123');
  await upsertUser('electrician@maintenance.local', 'Electrician User', electricianRole.id, 'password123');
  await upsertUser('operator@maintenance.local', 'Operator User', operatorRole.id, 'password123');

  const plant = await prisma.location.upsert({
    where: { id: 'seed-plant-1' },
    update: {},
    create: { id: 'seed-plant-1', name: 'Plant 1' },
  });

  const line = await prisma.location.upsert({
    where: { id: 'seed-line-1' },
    update: {},
    create: { id: 'seed-line-1', name: 'Line 1', parentId: plant.id },
  });

  const pump = await prisma.asset.upsert({
    where: { tag: 'PUMP-001' },
    update: {},
    create: {
      tag: 'PUMP-001',
      name: 'Cooling Water Pump 1',
      category: 'Pump',
      criticality: 'HIGH',
      locationId: line.id,
    },
  });

  const motor = await prisma.asset.upsert({
    where: { tag: 'MTR-102' },
    update: {},
    create: {
      tag: 'MTR-102',
      name: 'Extruder Main Drive Motor',
      category: 'Motor',
      criticality: 'CRITICAL',
      locationId: line.id,
    },
  });

  // Seed Spare Parts Master Catalog
  const spares = [
    { itemCode: 'BRG-6205', name: 'Deep Groove Ball Bearing 6205-2RS', unit: 'pcs', unitCost: 45.0 },
    { itemCode: 'BRG-6308', name: 'Deep Groove Ball Bearing 6308', unit: 'pcs', unitCost: 82.5 },
    { itemCode: 'SEAL-MS35', name: 'Mechanical Shaft Seal 35mm', unit: 'pcs', unitCost: 120.0 },
    { itemCode: 'OIL-VG46', name: 'Hydraulic Oil ISO VG 46', unit: 'ltr', unitCost: 18.5 },
    { itemCode: 'BELT-V-B52', name: 'V-Belt Classical B52', unit: 'pcs', unitCost: 28.0 },
    { itemCode: 'CNT-25A', name: 'Contactor 25A 3-Pole 24VDC', unit: 'pcs', unitCost: 65.0 },
    { itemCode: 'FUSE-10A', name: 'Fast-Acting Ceramic Fuse 10A', unit: 'pcs', unitCost: 8.5 },
  ];

  const partMap: Record<string, any> = {};
  for (const s of spares) {
    partMap[s.itemCode] = await prisma.sparePart.upsert({
      where: { itemCode: s.itemCode },
      update: s,
      create: s,
    });
  }

  // Create sample Breakdown Work Order with spares consumed
  const bd1 = await prisma.workOrder.create({
    data: {
      type: 'BREAKDOWN',
      status: 'CLOSED',
      assetId: pump.id,
      createdById: admin.id,
      assignedToId: fitter.id,
      downtimeStart: new Date(Date.now() - 48 * 3600 * 1000),
      downtimeEnd: new Date(Date.now() - 44 * 3600 * 1000),
      completedAt: new Date(Date.now() - 44 * 3600 * 1000),
      breakdownDetail: {
        create: {
          occurredAt: new Date(Date.now() - 48 * 3600 * 1000),
          reportedAt: new Date(Date.now() - 48 * 3600 * 1000),
          attendedAt: new Date(Date.now() - 47 * 3600 * 1000),
          restoredAt: new Date(Date.now() - 44 * 3600 * 1000),
          failureCategory: 'MECHANICAL',
          symptom: 'Excessive pump vibration and seal leak',
          actionTaken: 'Replaced worn bearing 6205 and mechanical shaft seal 35mm',
          reportedById: admin.id,
          attendedById: fitter.id,
        },
      },
      spareParts: {
        create: [
          {
            sparePartId: partMap['BRG-6205'].id,
            description: partMap['BRG-6205'].name,
            quantity: 2,
            unit: 'pcs',
            unitCost: 45.0,
          },
          {
            sparePartId: partMap['SEAL-MS35'].id,
            description: partMap['SEAL-MS35'].name,
            quantity: 1,
            unit: 'pcs',
            unitCost: 120.0,
          },
        ],
      },
    },
  });

  // Create sample PM Work Order with spares consumed
  const pm1 = await prisma.workOrder.create({
    data: {
      type: 'PM',
      status: 'CLOSED',
      assetId: motor.id,
      createdById: admin.id,
      assignedToId: fitter.id,
      completedAt: new Date(Date.now() - 24 * 3600 * 1000),
      spareParts: {
        create: [
          {
            sparePartId: partMap['BRG-6205'].id,
            description: partMap['BRG-6205'].name,
            quantity: 1,
            unit: 'pcs',
            unitCost: 45.0,
          },
          {
            sparePartId: partMap['OIL-VG46'].id,
            description: partMap['OIL-VG46'].name,
            quantity: 5,
            unit: 'ltr',
            unitCost: 18.5,
          },
          {
            sparePartId: partMap['BELT-V-B52'].id,
            description: partMap['BELT-V-B52'].name,
            quantity: 2,
            unit: 'pcs',
            unitCost: 28.0,
          },
        ],
      },
    },
  });

  // Seed Machine Operational Baselines
  await prisma.machineOperationalBaseline.createMany({
    data: [
      {
        assetId: pump.id,
        parameterName: 'Pump Drive-End Bearing Temperature',
        nominalValue: 55.0,
        minThreshold: 40.0,
        maxThreshold: 75.0,
        unit: '°C',
        operatingMode: 'Continuous 100% Flow',
        notes: 'Alarm if exceeding 75°C for > 5 mins',
      },
      {
        assetId: pump.id,
        parameterName: 'Discharge Line Pressure',
        nominalValue: 4.8,
        minThreshold: 3.5,
        maxThreshold: 6.2,
        unit: 'bar',
        operatingMode: 'Normal Loop Circulation',
        notes: 'Check suction strainer if pressure drops below 3.5 bar',
      },
      {
        assetId: motor.id,
        parameterName: 'Motor Full Load Current',
        nominalValue: 42.5,
        minThreshold: 20.0,
        maxThreshold: 48.0,
        unit: 'A',
        operatingMode: 'High Extrusion Load',
        notes: 'Trip limit set at 52A at VFD',
      },
      {
        assetId: motor.id,
        parameterName: 'Main Drive Shaft RPM',
        nominalValue: 1450.0,
        minThreshold: 1420.0,
        maxThreshold: 1480.0,
        unit: 'rpm',
        operatingMode: '50Hz Grid Direct',
        notes: 'Vibration monitoring baseline 2.2 mm/s RMS',
      },
    ],
  });

  // Seed Troubleshooting Playbooks
  await prisma.troubleshootingPlaybook.createMany({
    data: [
      {
        assetId: pump.id,
        assetCategory: 'Pump',
        symptom: 'Excessive pump casing vibration (> 4.5 mm/s) & seal fluid dripping',
        probableCause: 'Shaft misalignment with drive motor and mechanical seal face wear',
        standardFix: '1. Isolate and lock out pump power.\n2. Disassemble coupling and inspect 6205 bearing.\n3. Replace 35mm mechanical shaft seal.\n4. Perform dial-gauge laser alignment (angular < 0.05mm).',
        recommendedSpares: 'BRG-6205, SEAL-MS35',
        safetyPrecautions: 'Mandatory LOTO on 415V breaker & depressurize inlet valve',
        estimatedDowntimeMin: 90,
      },
      {
        assetId: motor.id,
        assetCategory: 'Motor',
        symptom: 'Motor tripping on VFD Over-Current alarm (Fault F0001)',
        probableCause: 'V-Belt slippage causing drive bind or phase unbalance',
        standardFix: '1. Check V-Belt tension and replace worn B52 belts.\n2. Measure motor winding resistance across U-V-W.\n3. Verify ventilation fan clearance and blow out dust.',
        recommendedSpares: 'BELT-V-B52, FUSE-10A',
        safetyPrecautions: 'Wait 5 minutes after power cutoff for VFD DC bus capacitor discharge',
        estimatedDowntimeMin: 45,
      },
    ],
  });

  console.log('Seed complete with inventory, work orders, operational baselines, and playbooks.');
  console.log({ admin: admin.email, fitter: fitter.email, pump: pump.tag, motor: motor.tag, bd1: bd1.id, pm1: pm1.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
