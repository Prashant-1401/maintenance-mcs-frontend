import {
  PrismaClient,
  PermissionTier,
  MaintenanceType,
  AssetCriticality,
  AssetStatus,
  WorkOrderType,
  WorkOrderStatus,
  FailureCategory,
  RcaRecordStatus,
  RcaActionStatus,
  RcaActionType,
  RcaMethod,
  ReadingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres.edxhryewudcjljkcusaq:8Lp3cjvSgovsn9gQ@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
  }),
});

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

async function main() {
  console.log('🚀 Seeding Rich Factory Data for Executive Dashboard…');

  // 1. Ensure Roles & Labor Rates
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: { hourlyRate: 40 },
    create: { name: 'Admin', tier: PermissionTier.ADMIN, rank: 1, hourlyRate: 40 },
  });
  const headRole = await prisma.role.upsert({
    where: { name: 'Head' },
    update: { hourlyRate: 50 },
    create: { name: 'Head', tier: PermissionTier.MANAGEMENT, rank: 2, hourlyRate: 50 },
  });
  const supervisorRole = await prisma.role.upsert({
    where: { name: 'Supervisor' },
    update: { hourlyRate: 35 },
    create: { name: 'Supervisor', tier: PermissionTier.MANAGEMENT, rank: 3, hourlyRate: 35 },
  });
  const fitterRole = await prisma.role.upsert({
    where: { name: 'Fitter' },
    update: { hourlyRate: 25 },
    create: { name: 'Fitter', tier: PermissionTier.TECHNICIAN, rank: 4, maintenanceType: MaintenanceType.MECHANICAL, hourlyRate: 25 },
  });
  const electricianRole = await prisma.role.upsert({
    where: { name: 'Electrician' },
    update: { hourlyRate: 30 },
    create: { name: 'Electrician', tier: PermissionTier.TECHNICIAN, rank: 4, maintenanceType: MaintenanceType.ELECTRICAL, hourlyRate: 30 },
  });
  const operatorRole = await prisma.role.upsert({
    where: { name: 'Operator' },
    update: { hourlyRate: 18 },
    create: { name: 'Operator', tier: PermissionTier.REQUESTER, rank: 5, hourlyRate: 18 },
  });

  // 2. Ensure Users
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@maintenance.local' },
    update: {},
    create: { email: 'admin@maintenance.local', name: 'Admin User', roleId: adminRole.id, passwordHash, active: true },
  });
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@maintenance.local' },
    update: {},
    create: { email: 'supervisor@maintenance.local', name: 'Supervisor User', roleId: supervisorRole.id, passwordHash, active: true },
  });
  const fitter = await prisma.user.upsert({
    where: { email: 'fitter@maintenance.local' },
    update: {},
    create: { email: 'fitter@maintenance.local', name: 'Fitter User', roleId: fitterRole.id, passwordHash, active: true },
  });
  const electrician = await prisma.user.upsert({
    where: { email: 'electrician@maintenance.local' },
    update: {},
    create: { email: 'electrician@maintenance.local', name: 'Electrician User', roleId: electricianRole.id, passwordHash, active: true },
  });

  // 3. Locations & Lines
  const plant = await prisma.location.upsert({
    where: { id: 'loc_plant_1' },
    update: { name: 'Plant 1 — Manufacturing Facility' },
    create: { id: 'loc_plant_1', name: 'Plant 1 — Manufacturing Facility' },
  });
  const line1 = await prisma.location.upsert({
    where: { id: 'loc_line_1' },
    update: { name: 'Line 1 – High-Speed Extrusion' },
    create: { id: 'loc_line_1', name: 'Line 1 – High-Speed Extrusion', parentId: plant.id },
  });
  const line2 = await prisma.location.upsert({
    where: { id: 'loc_line_2' },
    update: { name: 'Line 2 – Automated Mixing & Compounding' },
    create: { id: 'loc_line_2', name: 'Line 2 – Automated Mixing & Compounding', parentId: plant.id },
  });
  const line3 = await prisma.location.upsert({
    where: { id: 'loc_line_3' },
    update: { name: 'Line 3 – Utility, Water & Air Systems' },
    create: { id: 'loc_line_3', name: 'Line 3 – Utility, Water & Air Systems', parentId: plant.id },
  });

  // 4. Plant Machines
  const machineData = [
    { id: 'asset_ext_001', tag: 'EXT-001', name: 'Main Extruder Twin-Screw', category: 'Extruder', criticality: AssetCriticality.CRITICAL, locationId: line1.id },
    { id: 'asset_hlf_001', tag: 'HLF-001', name: 'Caterpillar Haul-Off Unit', category: 'Haul-Off', criticality: AssetCriticality.HIGH, locationId: line1.id },
    { id: 'asset_cut_001', tag: 'CUT-001', name: 'Planetary Pipe Cutter', category: 'Cutter', criticality: AssetCriticality.MEDIUM, locationId: line1.id },
    { id: 'asset_pump_001', tag: 'PUMP-001', name: 'Cooling Water Circulation Pump 1', category: 'Pump', criticality: AssetCriticality.HIGH, locationId: line3.id },
    { id: 'asset_mtr_102', tag: 'MTR-102', name: 'Extruder 75kW Main Drive Motor', category: 'Motor', criticality: AssetCriticality.CRITICAL, locationId: line1.id },
    { id: 'asset_mix_001', tag: 'MIX-001', name: 'High-Speed Turbomixer 500L', category: 'Mixer', criticality: AssetCriticality.CRITICAL, locationId: line2.id },
    { id: 'asset_cmp_004', tag: 'CMP-004', name: 'Rotary Screw Air Compressor 4', category: 'Compressor', criticality: AssetCriticality.HIGH, locationId: line3.id },
  ];

  const machines: Record<string, any> = {};
  for (const m of machineData) {
    machines[m.tag] = await prisma.asset.upsert({
      where: { tag: m.tag },
      update: { name: m.name, category: m.category, criticality: m.criticality, locationId: m.locationId },
      create: { ...m, status: AssetStatus.OPERATIONAL },
    });
  }

  // 5. Spare Parts Catalog
  const sparePartsData = [
    { itemCode: 'BRG-6205', name: 'Deep Groove Ball Bearing 6205-2RS', unit: 'pcs', unitCost: 45.0 },
    { itemCode: 'BRG-6309', name: 'Heavy Duty Gearbox Bearing 6309-C3', unit: 'pcs', unitCost: 110.0 },
    { itemCode: 'SEAL-MS35', name: 'Mechanical Shaft Seal 35mm Silicon-Carbide', unit: 'pcs', unitCost: 135.0 },
    { itemCode: 'OIL-VG46', name: 'Hydraulic Oil ISO VG 46', unit: 'ltr', unitCost: 18.5 },
    { itemCode: 'OIL-GB220', name: 'Synthetic Gear Oil ISO VG 220', unit: 'ltr', unitCost: 28.0 },
    { itemCode: 'BELT-V-B68', name: 'Reinforced Classical V-Belt B68', unit: 'pcs', unitCost: 32.0 },
    { itemCode: 'HTR-BND15', name: 'Ceramic Band Heater 1.5kW 230V', unit: 'pcs', unitCost: 85.0 },
    { itemCode: 'CNT-25A', name: 'Siemens 3-Pole Power Contactor 25A 24VDC', unit: 'pcs', unitCost: 65.0 },
    { itemCode: 'FUSE-10A', name: 'Fast-Acting Ceramic Control Fuse 10A', unit: 'pcs', unitCost: 6.5 },
  ];

  const spares: Record<string, any> = {};
  for (const s of sparePartsData) {
    spares[s.itemCode] = await prisma.sparePart.upsert({
      where: { itemCode: s.itemCode },
      update: s,
      create: s,
    });
  }

  // 6. Realistic 6-Month Breakdown Dataset
  console.log('▶ Generating historical breakdown records across 6 months…');
  const now = Date.now();
  const breakdownScenarios = [
    // Month 1 (5 months ago)
    { tag: 'PUMP-001', daysAgo: 145, durationHrs: 2.5, cat: FailureCategory.MECHANICAL, symptom: 'Suction pressure drop and mechanical seal drip', action: 'Replaced mechanical shaft seal 35mm and topped up lubricant', parts: [{ code: 'SEAL-MS35', qty: 1 }] },
    { tag: 'EXT-001', daysAgo: 130, durationHrs: 4.0, cat: FailureCategory.ELECTRICAL, symptom: 'Extruder barrel zone 3 temperature control tripped', action: 'Replaced blown ceramic band heater 1.5kW and terminal wiring', parts: [{ code: 'HTR-BND15', qty: 2 }] },
    
    // Month 2 (4 months ago)
    { tag: 'MIX-001', daysAgo: 110, durationHrs: 3.2, cat: FailureCategory.MECHANICAL, symptom: 'Excessive drive vibration and V-belt slip', action: 'Tensioned drive, replaced damaged V-belts and adjusted motor pulley', parts: [{ code: 'BELT-V-B68', qty: 3 }] },
    { tag: 'CMP-004', daysAgo: 98, durationHrs: 1.8, cat: FailureCategory.UTILITY, symptom: 'Compressor discharge air pressure low, oil filter delta P alert', action: 'Replaced air/oil separator filter and topped 15L oil', parts: [{ code: 'OIL-VG46', qty: 15 }] },

    // Month 3 (3 months ago)
    { tag: 'MTR-102', daysAgo: 85, durationHrs: 5.5, cat: FailureCategory.ELECTRICAL, symptom: 'Main motor drive tripped on overcurrent, high bearing temp 92°C', action: 'Disassembled motor end shield, replaced worn drive-end bearing 6309', parts: [{ code: 'BRG-6309', qty: 1 }, { code: 'OIL-GB220', qty: 5 }] },
    { tag: 'PUMP-001', daysAgo: 70, durationHrs: 2.0, cat: FailureCategory.MECHANICAL, symptom: 'Motor bearing rumbling sound during shift handover', action: 'Replaced 6205-2RS ball bearing and aligned pump coupling', parts: [{ code: 'BRG-6205', qty: 2 }] },
    { tag: 'HLF-001', daysAgo: 62, durationHrs: 1.5, cat: FailureCategory.MECHANICAL, symptom: 'Haul-off caterpillar track slipping under pipe tension', action: 'Cleaned track pads and tensioned pneumatic clamp cylinder', parts: [] },

    // Month 4 (2 months ago)
    { tag: 'CUT-001', daysAgo: 50, durationHrs: 1.2, cat: FailureCategory.MECHANICAL, symptom: 'Cutter blade clamp bolt loose, uneven pipe cut edge', action: 'Re-torqued clamp bolts and sharpened blade edge', parts: [] },
    { tag: 'EXT-001', daysAgo: 42, durationHrs: 3.8, cat: FailureCategory.MECHANICAL, symptom: 'Gearbox oil temperature elevated with metallic whining', action: 'Drained gearbox, flushed metal particles, replaced gear oil and inspected gears', parts: [{ code: 'OIL-GB220', qty: 25 }] },
    { tag: 'MIX-001', daysAgo: 35, durationHrs: 2.2, cat: FailureCategory.ELECTRICAL, symptom: 'Mixer high-speed contactor chatter and coil burn', action: 'Replaced 25A 24VDC power contactor and auxiliary contacts', parts: [{ code: 'CNT-25A', qty: 1 }] },

    // Month 5 (Last month)
    { tag: 'CMP-004', daysAgo: 22, durationHrs: 1.4, cat: FailureCategory.ELECTRICAL, symptom: 'Compressor emergency stop control circuit open', action: 'Replaced blown 10A control circuit fuse and reset E-stop switch', parts: [{ code: 'FUSE-10A', qty: 2 }] },
    { tag: 'PUMP-001', daysAgo: 15, durationHrs: 2.1, cat: FailureCategory.MECHANICAL, symptom: 'Water leakage from gland packing area', action: 'Replaced mechanical seal and checked impeller clearance', parts: [{ code: 'SEAL-MS35', qty: 1 }] },
    { tag: 'MTR-102', daysAgo: 8, durationHrs: 1.6, cat: FailureCategory.ELECTRICAL, symptom: 'Main drive cooling fan stopped working', action: 'Replaced auxiliary fan motor and cleared ventilation cowl', parts: [] },

    // Current Month (Recent)
    { tag: 'EXT-001', daysAgo: 3, durationHrs: 2.8, cat: FailureCategory.ELECTRICAL, symptom: 'Zone 4 temperature thermocouple open circuit error', action: 'Replaced type-J thermocouple sensor and re-calibrated PID loop', parts: [{ code: 'FUSE-10A', qty: 1 }] },
    { tag: 'MIX-001', daysAgo: 1, durationHrs: 1.5, cat: FailureCategory.MECHANICAL, symptom: 'Lid pneumatic interlock cylinder slow response', action: 'Lubricated cylinder seal and replaced quick-exhaust valve', parts: [{ code: 'OIL-VG46', qty: 2 }] },
  ];

  for (const s of breakdownScenarios) {
    const asset = machines[s.tag];
    const occurredAt = new Date(now - s.daysAgo * DAY);
    const attendedAt = new Date(occurredAt.getTime() + 15 * MIN);
    const restoredAt = new Date(occurredAt.getTime() + s.durationHrs * HOUR);

    await prisma.workOrder.create({
      data: {
        type: WorkOrderType.BREAKDOWN,
        status: WorkOrderStatus.CLOSED,
        assetId: asset.id,
        createdById: admin.id,
        assignedToId: fitter.id,
        downtimeStart: occurredAt,
        downtimeEnd: restoredAt,
        completedAt: restoredAt,
        createdAt: occurredAt,
        updatedAt: restoredAt,
        breakdownDetail: {
          create: {
            occurredAt,
            reportedAt: occurredAt,
            attendedAt,
            restoredAt,
            failureCategory: s.cat,
            symptom: s.symptom,
            actionTaken: s.action,
            reportedById: admin.id,
            attendedById: fitter.id,
          },
        },
        spareParts: {
          create: s.parts.map((p) => ({
            sparePartId: spares[p.code]?.id,
            description: spares[p.code]?.name,
            quantity: p.qty,
            unit: spares[p.code]?.unit || 'pcs',
            unitCost: spares[p.code]?.unitCost || 0,
          })),
        },
        participants: {
          create: [
            { userId: fitter.id, hoursSpent: s.durationHrs },
            { userId: electrician.id, hoursSpent: s.durationHrs * 0.5 },
          ],
        },
      },
    });
  }

  // 7. PM Work Orders with 100% Completed Checklists
  console.log('▶ Generating completed PM work orders & compliance scores…');
  for (let i = 1; i <= 6; i++) {
    const completedAt = new Date(now - i * 15 * DAY);
    await prisma.workOrder.create({
      data: {
        type: WorkOrderType.PM,
        status: WorkOrderStatus.CLOSED,
        assetId: machines['EXT-001'].id,
        createdById: supervisor.id,
        assignedToId: fitter.id,
        completedAt,
        createdAt: new Date(completedAt.getTime() - 2 * DAY),
        spareParts: {
          create: [
            { sparePartId: spares['OIL-GB220'].id, description: 'Gearbox top up oil', quantity: 5, unit: 'ltr', unitCost: 28.0 },
          ],
        },
      },
    });
  }

  // 8. 5-Why RCA Record with Action Items
  console.log('▶ Creating 5-Why Root Cause Analysis records…');
  const rcaWo = await prisma.workOrder.findFirst({
    where: { assetId: machines['MTR-102'].id, type: WorkOrderType.BREAKDOWN },
  });

  if (rcaWo) {
    await prisma.rcaRecord.create({
      data: {
        workOrderId: rcaWo.id,
        method: RcaMethod.FIVE_WHY,
        status: RcaRecordStatus.FINAL,
        rootCause: 'Lack of scheduled relubrication caused bearing cage fatigue and catastrophic motor overheating.',
        whySteps: [
          'Why did the motor trip on overcurrent? Bearing seized on drive-end.',
          'Why did the bearing seize? Excessive frictional heat and dry ball tracks.',
          'Why were the ball tracks dry? High-temperature synthetic grease was depleted.',
          'Why was grease depleted? Relubrication interval was exceeded by 60 days.',
          'Why was interval exceeded? PM schedule for motor bearing greasing was not digitally scheduled.',
        ],
        remarks: 'Digital recurring PM schedule assigned in Maintenance MCS with 15-day alert.',
        createdById: supervisor.id,
        actionItems: {
          create: [
            { description: 'Create 15-day recurring lubrication schedule in PM engine', type: RcaActionType.PREVENTIVE, status: RcaActionStatus.DONE, ownerId: supervisor.id, dueDate: new Date(now + 7 * DAY), completedAt: new Date() },
            { description: 'Install automatic single-point grease lubricator on motor DE housing', type: RcaActionType.CORRECTIVE, status: RcaActionStatus.VERIFIED, ownerId: fitter.id, dueDate: new Date(now + 14 * DAY), completedAt: new Date(), verifiedById: supervisor.id },
          ],
        },
      },
    });
  }

  // 9. Machine Operational Baselines
  console.log('▶ Setting Machine Operational Baselines for Condition Monitoring…');
  const baselines = [
    { assetId: machines['PUMP-001'].id, parameterName: 'Vibration DE (RMS)', unit: 'mm/s', nominalValue: 2.2, minThreshold: 0.5, maxThreshold: 4.5, notes: 'Overall vibration severity ISO 10816-3' },
    { assetId: machines['PUMP-001'].id, parameterName: 'Discharge Pressure', unit: 'bar', nominalValue: 4.2, minThreshold: 3.2, maxThreshold: 5.5, notes: 'Cooling tower header delivery pressure' },
    { assetId: machines['MTR-102'].id, parameterName: 'Bearing DE Temperature', unit: '°C', nominalValue: 62.0, minThreshold: 25.0, maxThreshold: 80.0, notes: 'Motor drive-end bearing surface temperature' },
    { assetId: machines['CMP-004'].id, parameterName: 'Discharge Air Temperature', unit: '°C', nominalValue: 88.0, minThreshold: 70.0, maxThreshold: 105.0, notes: 'Screw element outlet temperature' },
  ];

  for (const b of baselines) {
    await prisma.machineOperationalBaseline.create({ data: b });
  }

  console.log('✅ Rich factory data seeded successfully! Executive dashboard is fully populated.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed Error:', err);
  process.exit(1);
});
