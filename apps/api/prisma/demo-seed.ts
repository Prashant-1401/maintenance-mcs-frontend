/**
 * Demo data reset — turns the database into a tidy, realistic story for presenting the app.
 *
 *  - Clears transactional history (work orders, schedules, breakdowns, RCA, notes) but KEEPS users,
 *    roles, locations, assets, spare parts and the real RPVC PM / Predictive checklist templates.
 *  - Re-creates a believable extrusion-line scenario with backdated dates relative to "now".
 *  - Safe to re-run: every run starts from the same clean slate.
 *
 * Run (with the local DB up):  npx tsx prisma/demo-seed.ts
 * Take a backup first:         npx tsx scripts/backup-db.ts
 */
import {
  AssetCriticality,
  AssetStatus,
  CriteriaType,
  DeviationNoteStatus,
  FailureCategory,
  PendingJobSheetStatus,
  PMTriggerType,
  PrismaClient,
  RcaActionStatus,
  RcaActionType,
  RcaMethod,
  RcaRecordStatus,
  ReadingStatus,
  ThresholdDirection,
  WorkOrderStatus,
  WorkOrderType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------- time + randomness helpers ----------

const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

/** A moment `days` days from now (negative = past), pinned to a working hour so timelines look natural. */
const at = (days: number, hour = 9, minute = 0) => {
  const d = new Date(NOW.getTime() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261006);
const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------- reading status logic (mirrors PredictiveService.computeCheckPointStatus) ----------

type CP = {
  id: string;
  criteriaType: CriteriaType;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  direction: ThresholdDirection | null;
};

function statusFor(cp: CP, numericValue: number | null, passed: boolean | null): ReadingStatus {
  if (cp.criteriaType === CriteriaType.QUALITATIVE) return passed === false ? ReadingStatus.CRITICAL : ReadingStatus.NORMAL;
  if (numericValue == null) return ReadingStatus.NORMAL;
  const { warningThreshold: w, criticalThreshold: c, direction } = cp;
  if (direction === ThresholdDirection.BELOW) {
    if (c != null && numericValue <= c) return ReadingStatus.CRITICAL;
    if (w != null && numericValue <= w) return ReadingStatus.WARNING;
    return ReadingStatus.NORMAL;
  }
  if (c != null && numericValue >= c) return ReadingStatus.CRITICAL;
  if (w != null && numericValue >= w) return ReadingStatus.WARNING;
  return ReadingStatus.NORMAL;
}

/** Produce a plausible value/OK for a checkpoint targeting NORMAL, WARNING or CRITICAL. */
function makeReading(cp: CP, target: ReadingStatus) {
  if (cp.criteriaType === CriteriaType.QUALITATIVE) {
    return { numericValue: null as number | null, passed: target === ReadingStatus.NORMAL ? true : target === ReadingStatus.CRITICAL ? false : true };
  }
  const warn = cp.warningThreshold;
  const crit = cp.criticalThreshold ?? warn;
  const ref = warn ?? crit;
  if (ref == null) return { numericValue: round1(between(1, 5)), passed: null as boolean | null };
  const above = cp.direction !== ThresholdDirection.BELOW;
  // The real RPVC checkpoints only carry a single (critical) limit, so there is no amber tier:
  // a "warning" target falls back to a healthy reading unless both thresholds exist.
  const hasWarningTier = warn != null && crit != null && warn !== crit;
  if (target === ReadingStatus.WARNING && !hasWarningTier) target = ReadingStatus.NORMAL;
  let v: number;
  if (target === ReadingStatus.NORMAL) v = above ? ref * between(0.55, 0.85) : ref * between(1.15, 1.5);
  else if (target === ReadingStatus.WARNING) v = warn! + (crit! - warn!) * 0.4;
  else v = above ? (crit ?? ref) * between(1.05, 1.2) : (crit ?? ref) * between(0.85, 0.95);
  return { numericValue: round1(v), passed: null as boolean | null };
}

// ---------- main ----------

async function main() {
  console.log('▶ Clearing transactional data…');
  await prisma.rcaActionItem.deleteMany();
  await prisma.rcaRecord.deleteMany();
  await prisma.deviationNote.deleteMany();
  await prisma.pendingJobSheetItem.deleteMany();
  await prisma.workOrderPredictiveReading.deleteMany();
  await prisma.workOrderChecklistResponse.deleteMany();
  await prisma.workOrderSparePart.deleteMany();
  await prisma.workOrderParticipant.deleteMany();
  await prisma.workOrderStatusHistory.deleteMany();
  await prisma.breakdownDetail.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.pMSchedule.deleteMany();
  await prisma.predictiveSchedule.deleteMany();

  // ----- templates: keep only the newest version of each name -----
  console.log('▶ De-duplicating checklist templates…');
  for (const model of ['predictive', 'pm'] as const) {
    const templates: { id: string; name: string; version: number; createdAt: Date }[] =
      model === 'predictive'
        ? await prisma.predictiveChecklistTemplate.findMany()
        : await prisma.pMChecklistTemplate.findMany();
    const byName = new Map<string, typeof templates>();
    for (const t of templates) byName.set(t.name, [...(byName.get(t.name) ?? []), t]);
    for (const group of byName.values()) {
      group.sort((a, b) => b.version - a.version || b.createdAt.getTime() - a.createdAt.getTime());
      for (const stale of group.slice(1)) {
        if (model === 'predictive') {
          await prisma.predictiveCheckPoint.deleteMany({ where: { templateId: stale.id } });
          await prisma.predictiveChecklistTemplate.delete({ where: { id: stale.id } });
        } else {
          await prisma.pMChecklistItem.deleteMany({ where: { templateId: stale.id } });
          await prisma.pMChecklistTemplate.delete({ where: { id: stale.id } });
        }
      }
    }
  }

  const pmTemplate = await prisma.pMChecklistTemplate.findFirstOrThrow({
    where: { name: { startsWith: '1. RPVC' } },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
  });
  const extrusionTemplate = await prisma.predictiveChecklistTemplate.findFirstOrThrow({
    where: { name: 'Extrusion Data' },
    include: { checkPoints: { orderBy: { orderIndex: 'asc' } } },
  });
  const mixerTemplate = await prisma.predictiveChecklistTemplate.findFirstOrThrow({
    where: { name: 'Mixer Data' },
    include: { checkPoints: { orderBy: { orderIndex: 'asc' } } },
  });

  // ----- people -----
  const u = async (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });
  const admin = await u('admin@maintenance.local');
  const head = await u('head@maintenance.local');
  const supervisor = await u('supervisor@maintenance.local');
  const fitter = await u('fitter@maintenance.local');
  const electrician = await u('electrician@maintenance.local');
  const operator = await u('operator@maintenance.local');
  const system = await u('system@maintenance.local');
  const welder = await prisma.user.findFirst({ where: { name: 'Welder User' } });

  // labour rates so the cost charts have numbers
  await prisma.role.updateMany({ where: { name: 'Fitter', hourlyRate: null }, data: { hourlyRate: 25 } });
  await prisma.role.updateMany({ where: { name: 'Electrician', hourlyRate: null }, data: { hourlyRate: 30 } });
  await prisma.role.updateMany({ where: { name: 'Senior Welder', hourlyRate: null }, data: { hourlyRate: 35 } });

  // ----- plant, lines, machines -----
  console.log('▶ Setting up plant, lines, machines and spares…');
  const plant = await prisma.location.upsert({ where: { id: 'seed-plant-1' }, update: { name: 'Plant 1 – RPVC Pipes' }, create: { id: 'seed-plant-1', name: 'Plant 1 – RPVC Pipes' } });
  const line1 = await prisma.location.upsert({ where: { id: 'seed-line-1' }, update: { name: 'Line 1 – Extrusion' }, create: { id: 'seed-line-1', name: 'Line 1 – Extrusion', parentId: plant.id } });
  const line2 = await prisma.location.upsert({ where: { id: 'seed-line-2' }, update: { name: 'Line 2 – Mixing & Feeding', parentId: plant.id }, create: { id: 'seed-line-2', name: 'Line 2 – Mixing & Feeding', parentId: plant.id } });

  const assetDefs: { tag: string; name: string; category: string; criticality: AssetCriticality; locationId: string }[] = [
    { tag: 'EXT-001', name: 'Main Extruder', category: 'Extruder', criticality: AssetCriticality.CRITICAL, locationId: line1.id },
    { tag: 'HLF-001', name: 'Haul-off Unit', category: 'Haul-off', criticality: AssetCriticality.HIGH, locationId: line1.id },
    { tag: 'CUT-001', name: 'Pipe Cutter', category: 'Cutter', criticality: AssetCriticality.MEDIUM, locationId: line1.id },
    { tag: 'VAC-001', name: 'Barrel Vacuum Pump', category: 'Vacuum Pump', criticality: AssetCriticality.HIGH, locationId: line1.id },
    { tag: 'PUMP-001', name: 'Cooling Water Pump 1', category: 'Pump', criticality: AssetCriticality.HIGH, locationId: line1.id },
    { tag: 'MIX-001', name: 'High-Speed Mixer', category: 'Mixer', criticality: AssetCriticality.CRITICAL, locationId: line2.id },
    { tag: 'HLV-001', name: 'Loader / HLVC', category: 'Loader', criticality: AssetCriticality.MEDIUM, locationId: line2.id },
  ];
  const A: Record<string, { id: string }> = {};
  for (const d of assetDefs) {
    A[d.tag] = await prisma.asset.upsert({
      where: { tag: d.tag },
      update: { name: d.name, category: d.category, criticality: d.criticality, locationId: d.locationId, status: AssetStatus.OPERATIONAL },
      create: { ...d, status: AssetStatus.OPERATIONAL },
    });
  }

  const partDefs = [
    { itemCode: 'BRG-6309', name: 'Bearing 6309 (gearbox)', unit: 'pcs', unitCost: 850 },
    { itemCode: 'OIL-GB68', name: 'Gear oil ISO VG 68', unit: 'litre', unitCost: 310 },
    { itemCode: 'HTR-BND15', name: 'Band heater 1.5 kW', unit: 'pcs', unitCost: 1250 },
    { itemCode: 'CPL-RI', name: 'Coupling rubber insert', unit: 'pcs', unitCost: 560 },
    { itemCode: 'BLT-B68', name: 'V-belt B68', unit: 'pcs', unitCost: 420 },
    { itemCode: 'CUT-BLD', name: 'Cutter blade', unit: 'pcs', unitCost: 2400 },
    { itemCode: 'SEAL-MS35', name: 'Mechanical seal 35 mm', unit: 'pcs', unitCost: 1600 },
    { itemCode: 'CNT-25A', name: 'Contactor 25 A', unit: 'pcs', unitCost: 980 },
  ];
  const P: Record<string, { id: string; name: string; unit: string | null; unitCost: number | null }> = {};
  for (const d of partDefs) {
    P[d.itemCode] = await prisma.sparePart.upsert({ where: { itemCode: d.itemCode }, update: d, create: d });
  }

  // ----- small builders -----

  const history = (workOrderId: string, steps: { from?: WorkOrderStatus; to: WorkOrderStatus; by: string; when: Date; notes?: string }[]) =>
    prisma.workOrderStatusHistory.createMany({
      data: steps.map((s) => ({ workOrderId, fromStatus: s.from, toStatus: s.to, changedById: s.by, changedAt: s.when, notes: s.notes })),
    });

  const addSpares = (workOrderId: string, spares: { code: string; qty: number }[]) =>
    spares.length
      ? prisma.workOrderSparePart.createMany({
          data: spares.map((s) => ({
            workOrderId,
            sparePartId: P[s.code].id,
            description: P[s.code].name,
            quantity: s.qty,
            unit: P[s.code].unit,
            unitCost: P[s.code].unitCost,
            createdAt: undefined,
          })),
        })
      : Promise.resolve();

  const addParticipants = (workOrderId: string, people: { userId: string; hours: number }[]) =>
    people.length
      ? prisma.workOrderParticipant.createMany({ data: people.map((p) => ({ workOrderId, userId: p.userId, hoursSpent: p.hours })) })
      : Promise.resolve();

  const FAIL_REMARKS = [
    'Found loose — tightened and re-checked',
    'Worn — replaced during PM',
    'Dirty — cleaned',
    'Marginal — monitor at next PM',
    'Low level — topped up',
  ];

  type PmState = 'OPEN' | 'ATTENDED' | 'CLOSED';

  async function pmWorkOrder(o: {
    scheduleId: string;
    assetId: string;
    createdAt: Date;
    dueDate: Date;
    state: PmState;
    tech?: string;
    startedAt?: Date;
    completedAt?: Date;
    items?: typeof pmTemplate.items;
    answered?: number;
    fails?: number;
    plannedNotes?: string;
    startNote?: string;
    closeNote?: string;
    spares?: { code: string; qty: number }[];
    people?: { userId: string; hours: number }[];
  }) {
    const status = o.state === 'OPEN' ? WorkOrderStatus.OPEN : o.state === 'ATTENDED' ? WorkOrderStatus.ATTENDED : WorkOrderStatus.CLOSED;
    const wo = await prisma.workOrder.create({
      data: {
        type: WorkOrderType.PM,
        status,
        assetId: o.assetId,
        createdById: system.id,
        assignedToId: o.state === 'OPEN' ? null : o.tech,
        dueDate: o.dueDate,
        completedAt: o.completedAt,
        plannedNotes: o.plannedNotes,
        pmScheduleId: o.scheduleId,
        createdAt: o.createdAt,
      },
    });

    const steps: Parameters<typeof history>[1] = [{ to: WorkOrderStatus.OPEN, by: system.id, when: o.createdAt, notes: 'Generated from PM schedule' }];
    if (o.state !== 'OPEN') steps.push({ from: WorkOrderStatus.OPEN, to: WorkOrderStatus.ATTENDED, by: supervisor.id, when: o.startedAt!, notes: o.startNote });
    if (o.state === 'CLOSED') steps.push({ from: WorkOrderStatus.ATTENDED, to: WorkOrderStatus.CLOSED, by: o.tech!, when: o.completedAt!, notes: o.closeNote });
    await history(wo.id, steps);

    if (o.items?.length) {
      const answered = o.state === 'OPEN' ? 0 : (o.answered ?? o.items.length);
      const failIdx = new Set<number>();
      while (failIdx.size < Math.min(o.fails ?? 0, answered)) failIdx.add(Math.floor(rand() * answered));
      const base = (o.startedAt ?? o.createdAt).getTime();
      await prisma.workOrderChecklistResponse.createMany({
        data: o.items.map((item, i) => {
          if (i >= answered) return { workOrderId: wo.id, checklistItemId: item.id };
          const failed = failIdx.has(i);
          return {
            workOrderId: wo.id,
            checklistItemId: item.id,
            passed: !failed,
            remarks: failed ? FAIL_REMARKS[Math.floor(rand() * FAIL_REMARKS.length)] : null,
            completedById: o.tech,
            completedAt: new Date(base + (i + 1) * 90 * 1000),
          };
        }),
      });
    }

    if (o.state === 'CLOSED') {
      await addSpares(wo.id, o.spares ?? []);
      await addParticipants(wo.id, o.people ?? []);
    }
    return wo;
  }

  async function pmSchedule(o: { assetId: string; name: string; intervalDays: number; leadTimeDays: number; templateId?: string; createdAt: Date; lastGeneratedAt: Date }) {
    return prisma.pMSchedule.create({
      data: {
        assetId: o.assetId,
        name: o.name,
        triggerType: PMTriggerType.TIME,
        triggerConfig: { intervalDays: o.intervalDays },
        leadTimeDays: o.leadTimeDays,
        checklistTemplateId: o.templateId,
        createdAt: o.createdAt,
        lastGeneratedAt: o.lastGeneratedAt,
      },
    });
  }

  async function predSchedule(o: { assetId: string; name: string; intervalDays: number; leadTimeDays: number; templateId: string; createdAt: Date; lastGeneratedAt: Date }) {
    return prisma.predictiveSchedule.create({
      data: {
        assetId: o.assetId,
        name: o.name,
        triggerType: PMTriggerType.TIME,
        triggerConfig: { intervalDays: o.intervalDays },
        leadTimeDays: o.leadTimeDays,
        checklistTemplateId: o.templateId,
        createdAt: o.createdAt,
        lastGeneratedAt: o.lastGeneratedAt,
      },
    });
  }

  type Scenario = 'normal' | 'degraded' | 'watch';

  async function predWorkOrder(o: {
    scheduleId: string;
    assetId: string;
    createdAt: Date;
    dueDate: Date;
    state: PmState;
    tech?: string;
    startedAt?: Date;
    completedAt?: Date;
    checkPoints: (CP & { id: string })[];
    answered?: number;
    scenario?: Scenario;
    startNote?: string;
    closeNote?: string;
    people?: { userId: string; hours: number }[];
  }) {
    const status = o.state === 'OPEN' ? WorkOrderStatus.OPEN : o.state === 'ATTENDED' ? WorkOrderStatus.ATTENDED : WorkOrderStatus.CLOSED;
    const wo = await prisma.workOrder.create({
      data: {
        type: WorkOrderType.PREDICTIVE,
        status,
        assetId: o.assetId,
        createdById: system.id,
        assignedToId: o.state === 'OPEN' ? null : o.tech,
        dueDate: o.dueDate,
        completedAt: o.completedAt,
        predictiveScheduleId: o.scheduleId,
        createdAt: o.createdAt,
      },
    });

    const steps: Parameters<typeof history>[1] = [{ to: WorkOrderStatus.OPEN, by: system.id, when: o.createdAt, notes: 'Generated from predictive schedule' }];
    if (o.state !== 'OPEN') steps.push({ from: WorkOrderStatus.OPEN, to: WorkOrderStatus.ATTENDED, by: supervisor.id, when: o.startedAt!, notes: o.startNote });
    if (o.state === 'CLOSED') steps.push({ from: WorkOrderStatus.ATTENDED, to: WorkOrderStatus.CLOSED, by: o.tech!, when: o.completedAt!, notes: o.closeNote });
    await history(wo.id, steps);

    const answered = o.state === 'OPEN' ? 0 : (o.answered ?? o.checkPoints.length);
    const scenario = o.scenario ?? 'normal';
    const warnRate = scenario === 'degraded' ? 0.07 : scenario === 'watch' ? 0.03 : 0;
    const critRate = scenario === 'degraded' ? 0.035 : 0;
    const base = (o.startedAt ?? o.createdAt).getTime();

    await prisma.workOrderPredictiveReading.createMany({
      data: o.checkPoints.map((cp, i) => {
        if (i >= answered) return { workOrderId: wo.id, checkPointId: cp.id };
        const roll = rand();
        const target = roll < critRate ? ReadingStatus.CRITICAL : roll < critRate + warnRate ? ReadingStatus.WARNING : ReadingStatus.NORMAL;
        const r = makeReading(cp, target);
        return {
          workOrderId: wo.id,
          checkPointId: cp.id,
          numericValue: r.numericValue,
          passed: r.passed,
          status: statusFor(cp, r.numericValue, r.passed),
          observedText: cp.criteriaType === CriteriaType.QUALITATIVE && r.passed === false ? 'Abnormal — flagged for follow-up' : null,
          recordedById: o.tech,
          recordedAt: new Date(base + (i + 1) * 60 * 1000),
        };
      }),
    });

    if (o.state === 'CLOSED') await addParticipants(wo.id, o.people ?? []);
    return wo;
  }

  // =====================================================================
  // PREVENTIVE MAINTENANCE
  // =====================================================================
  console.log('▶ Creating PM schedules and work orders…');
  const items = pmTemplate.items;
  const tid = pmTemplate.id;

  // Extruder — monthly. Two closed cycles + one in progress (due today).
  const sExt = await pmSchedule({ assetId: A['EXT-001'].id, name: 'Extruder – Monthly PM', intervalDays: 30, leadTimeDays: 3, templateId: tid, createdAt: at(-95), lastGeneratedAt: at(-3, 8) });
  await pmWorkOrder({
    scheduleId: sExt.id, assetId: A['EXT-001'].id, createdAt: at(-63, 8), dueDate: at(-60), state: 'CLOSED', tech: fitter.id,
    startedAt: at(-60, 8, 30), completedAt: at(-60, 15, 40), items, answered: items.length, fails: 4,
    startNote: 'Planned shutdown window', closeNote: 'PM completed — 4 minor findings corrected',
    spares: [{ code: 'OIL-GB68', qty: 6 }, { code: 'BLT-B68', qty: 1 }],
    people: [{ userId: fitter.id, hours: 6 }, { userId: electrician.id, hours: 3 }],
  });
  await pmWorkOrder({
    scheduleId: sExt.id, assetId: A['EXT-001'].id, createdAt: at(-33, 8), dueDate: at(-30), state: 'CLOSED', tech: fitter.id,
    startedAt: at(-29, 8, 30), completedAt: at(-29, 16, 10), items, answered: items.length, fails: 6,
    startNote: 'Started a day late — line was running a priority order', closeNote: 'PM completed',
    spares: [{ code: 'CPL-RI', qty: 1 }, { code: 'CNT-25A', qty: 1 }],
    people: [{ userId: fitter.id, hours: 6.5 }, { userId: electrician.id, hours: 3.5 }],
  });
  const extNow = await pmWorkOrder({
    scheduleId: sExt.id, assetId: A['EXT-001'].id, createdAt: at(-3, 8), dueDate: at(0), state: 'ATTENDED', tech: fitter.id,
    startedAt: at(0, 7, 45), items, answered: 124, fails: 3, plannedNotes: 'Panel + motor drive first, then gearbox oil change',
    startNote: 'Started on due date',
  });

  // Haul-off — monthly. One PARTIALLY completed (closed with what was done) + one OPEN, due soon.
  const sHlf = await pmSchedule({ assetId: A['HLF-001'].id, name: 'Haul-off – Monthly PM', intervalDays: 30, leadTimeDays: 3, templateId: tid, createdAt: at(-70), lastGeneratedAt: at(-1, 8) });
  const hlfPartial = await pmWorkOrder({
    scheduleId: sHlf.id, assetId: A['HLF-001'].id, createdAt: at(-33, 8), dueDate: at(-30), state: 'CLOSED', tech: fitter.id,
    startedAt: at(-30, 9), completedAt: at(-30, 14), items, answered: 96, fails: 5,
    startNote: 'Only a 5-hour window available', closeNote: 'Closed with remaining checks deferred to next shutdown',
    spares: [{ code: 'BLT-B68', qty: 2 }], people: [{ userId: fitter.id, hours: 5 }],
  });
  const hlfOpen = await pmWorkOrder({
    scheduleId: sHlf.id, assetId: A['HLF-001'].id, createdAt: at(-1, 8), dueDate: at(2), state: 'OPEN', items,
  });

  // Cutter — fortnightly. One closed on time, one overdue.
  const sCut = await pmSchedule({ assetId: A['CUT-001'].id, name: 'Cutter – Fortnightly PM', intervalDays: 15, leadTimeDays: 2, templateId: tid, createdAt: at(-45), lastGeneratedAt: at(-4, 8) });
  await pmWorkOrder({
    scheduleId: sCut.id, assetId: A['CUT-001'].id, createdAt: at(-20, 8), dueDate: at(-18), state: 'CLOSED', tech: fitter.id,
    startedAt: at(-18, 9), completedAt: at(-18, 13, 30), items, answered: items.length, fails: 2,
    closeNote: 'PM completed on schedule', spares: [{ code: 'CUT-BLD', qty: 1 }], people: [{ userId: fitter.id, hours: 4.5 }],
  });
  await pmWorkOrder({ scheduleId: sCut.id, assetId: A['CUT-001'].id, createdAt: at(-4, 8), dueDate: at(-2), state: 'OPEN', items });

  // Vacuum pump — monthly, closed on time (due date had been pushed via an approved deviation note).
  const sVac = await pmSchedule({ assetId: A['VAC-001'].id, name: 'Vacuum Pump – Monthly PM', intervalDays: 30, leadTimeDays: 3, templateId: tid, createdAt: at(-60), lastGeneratedAt: at(-12, 8) });
  const vacClosed = await pmWorkOrder({
    scheduleId: sVac.id, assetId: A['VAC-001'].id, createdAt: at(-12, 8), dueDate: at(-9), state: 'CLOSED', tech: electrician.id,
    startedAt: at(-9, 9), completedAt: at(-9, 14), items, answered: items.length, fails: 3,
    closeNote: 'PM completed', spares: [{ code: 'SEAL-MS35', qty: 1 }, { code: 'OIL-GB68', qty: 3 }],
    people: [{ userId: electrician.id, hours: 3 }, { userId: fitter.id, hours: 2.5 }],
  });

  // Cooling pump — quarterly, NO checklist template attached (still completable with spares + manpower).
  const sPump = await pmSchedule({ assetId: A['PUMP-001'].id, name: 'Cooling Pump – Quarterly PM', intervalDays: 90, leadTimeDays: 7, createdAt: at(-140), lastGeneratedAt: at(-50, 8) });
  await pmWorkOrder({
    scheduleId: sPump.id, assetId: A['PUMP-001'].id, createdAt: at(-50, 8), dueDate: at(-43), state: 'CLOSED', tech: fitter.id,
    startedAt: at(-43, 10), completedAt: at(-43, 12, 30), closeNote: 'Greased bearings, checked alignment and gland packing',
    spares: [{ code: 'BRG-6309', qty: 1 }], people: [{ userId: fitter.id, hours: 2.5 }, ...(welder ? [{ userId: welder.id, hours: 1 }] : [])],
  });

  // =====================================================================
  // PREDICTIVE MAINTENANCE
  // =====================================================================
  console.log('▶ Creating predictive schedules and checks…');
  const ex = extrusionTemplate.checkPoints as (CP & { id: string })[];
  const mx = mixerTemplate.checkPoints as (CP & { id: string })[];

  const pExt = await predSchedule({ assetId: A['EXT-001'].id, name: 'Extruder – Monthly Condition Check', intervalDays: 30, leadTimeDays: 3, templateId: extrusionTemplate.id, createdAt: at(-80), lastGeneratedAt: at(-7, 8) });
  await predWorkOrder({
    scheduleId: pExt.id, assetId: A['EXT-001'].id, createdAt: at(-37, 8), dueDate: at(-34), state: 'CLOSED', tech: electrician.id,
    startedAt: at(-34, 9), completedAt: at(-34, 12), checkPoints: ex, scenario: 'normal', closeNote: 'All readings within limits',
    people: [{ userId: electrician.id, hours: 3 }],
  });
  await predWorkOrder({
    scheduleId: pExt.id, assetId: A['EXT-001'].id, createdAt: at(-7, 8), dueDate: at(-4), state: 'CLOSED', tech: electrician.id,
    startedAt: at(-4, 9), completedAt: at(-4, 13), checkPoints: ex, scenario: 'degraded', closeNote: 'Several readings above limits — follow-ups raised',
    people: [{ userId: electrician.id, hours: 3.5 }],
  });

  const pMix = await predSchedule({ assetId: A['MIX-001'].id, name: 'Mixer – Monthly Condition Check', intervalDays: 30, leadTimeDays: 3, templateId: mixerTemplate.id, createdAt: at(-75), lastGeneratedAt: at(-2, 8) });
  await predWorkOrder({
    scheduleId: pMix.id, assetId: A['MIX-001'].id, createdAt: at(-14, 8), dueDate: at(-11), state: 'CLOSED', tech: electrician.id,
    startedAt: at(-11, 9), completedAt: at(-11, 12, 15), checkPoints: mx, scenario: 'watch', closeNote: 'Two readings on watch',
    people: [{ userId: electrician.id, hours: 3 }],
  });
  await predWorkOrder({
    scheduleId: pMix.id, assetId: A['MIX-001'].id, createdAt: at(-2, 8), dueDate: at(1), state: 'ATTENDED', tech: electrician.id,
    startedAt: at(0, 8), checkPoints: mx, answered: 44, scenario: 'degraded', startNote: 'Brought forward after motor trip',
  });

  const pVac = await predSchedule({ assetId: A['VAC-001'].id, name: 'Vacuum Pump – Fortnightly Condition Check', intervalDays: 14, leadTimeDays: 2, templateId: extrusionTemplate.id, createdAt: at(-50), lastGeneratedAt: at(-1, 8) });
  await predWorkOrder({
    scheduleId: pVac.id, assetId: A['VAC-001'].id, createdAt: at(-16, 8), dueDate: at(-14), state: 'CLOSED', tech: fitter.id,
    startedAt: at(-14, 10), completedAt: at(-14, 12, 30), checkPoints: ex.slice(0, 80), scenario: 'watch', closeNote: 'Vacuum pump section only',
    people: [{ userId: fitter.id, hours: 2 }],
  });
  await predWorkOrder({ scheduleId: pVac.id, assetId: A['VAC-001'].id, createdAt: at(-1, 8), dueDate: at(1), state: 'OPEN', checkPoints: ex.slice(0, 80) });

  // =====================================================================
  // BREAKDOWNS
  // =====================================================================
  console.log('▶ Creating breakdowns, RCA and follow-ups…');

  async function breakdown(o: {
    assetTag: string;
    occurred: Date;
    downMinutes?: number; // omit = still open
    attended?: boolean;
    category: FailureCategory;
    symptom: string;
    action?: string;
    tech?: string;
    reporter?: string;
    spares?: { code: string; qty: number }[];
    people?: { userId: string; hours: number }[];
  }) {
    const reported = plus(o.occurred, 8 * MIN);
    const attendedAt = o.downMinutes !== undefined || o.attended ? plus(o.occurred, 22 * MIN) : null;
    const restoredAt = o.downMinutes !== undefined ? plus(o.occurred, o.downMinutes * MIN) : null;
    const closed = restoredAt !== null;
    const wo = await prisma.workOrder.create({
      data: {
        type: WorkOrderType.BREAKDOWN,
        status: closed ? WorkOrderStatus.CLOSED : attendedAt ? WorkOrderStatus.ATTENDED : WorkOrderStatus.OPEN,
        assetId: A[o.assetTag].id,
        createdById: o.reporter ?? operator.id,
        assignedToId: attendedAt ? o.tech : null,
        downtimeStart: o.occurred,
        downtimeEnd: restoredAt,
        completedAt: restoredAt,
        createdAt: reported,
        breakdownDetail: {
          create: {
            occurredAt: o.occurred,
            reportedAt: reported,
            attendedAt,
            restoredAt,
            failureCategory: o.category,
            symptom: o.symptom,
            actionTaken: o.action,
            reportedById: o.reporter ?? operator.id,
            attendedById: attendedAt ? o.tech : null,
          },
        },
      },
    });
    const steps: Parameters<typeof history>[1] = [{ to: WorkOrderStatus.OPEN, by: o.reporter ?? operator.id, when: reported, notes: 'Breakdown slip raised' }];
    if (attendedAt) steps.push({ from: WorkOrderStatus.OPEN, to: WorkOrderStatus.ATTENDED, by: o.tech!, when: attendedAt, notes: 'Breakdown attended' });
    if (closed) steps.push({ from: WorkOrderStatus.ATTENDED, to: WorkOrderStatus.CLOSED, by: o.tech!, when: restoredAt!, notes: 'Breakdown closed' });
    await history(wo.id, steps);
    await addSpares(wo.id, o.spares ?? []);
    await addParticipants(wo.id, o.people ?? []);
    return wo;
  }

  const b1 = await breakdown({
    assetTag: 'EXT-001', occurred: at(-71, 6, 40), downMinutes: 340, category: FailureCategory.MECHANICAL, tech: fitter.id,
    symptom: 'Extruder gearbox making grinding noise; oil temperature rising above 85°C',
    action: 'Replaced gearbox input-shaft bearing 6309, flushed and refilled gear oil',
    spares: [{ code: 'BRG-6309', qty: 2 }, { code: 'OIL-GB68', qty: 4 }], people: [{ userId: fitter.id, hours: 5.5 }, { userId: electrician.id, hours: 0.5 }],
  });
  const b2 = await breakdown({
    assetTag: 'EXT-001', occurred: at(-38, 14, 10), downMinutes: 125, category: FailureCategory.ELECTRICAL, tech: electrician.id,
    symptom: 'Barrel zone 3 not heating; temperature alarm on HMI',
    action: 'Replaced failed 1.5 kW band heater and tightened terminal block',
    spares: [{ code: 'HTR-BND15', qty: 1 }], people: [{ userId: electrician.id, hours: 2 }],
  });
  const b3 = await breakdown({
    assetTag: 'EXT-001', occurred: at(-9, 22, 30), downMinutes: 210, category: FailureCategory.MECHANICAL, tech: fitter.id,
    symptom: 'Heavy vibration at motor-gearbox coupling; extruder tripped on overload',
    action: 'Replaced coupling rubber insert and re-aligned motor with gearbox',
    spares: [{ code: 'CPL-RI', qty: 1 }], people: [{ userId: fitter.id, hours: 3.5 }],
  });
  await breakdown({
    assetTag: 'HLF-001', occurred: at(-50, 11, 5), downMinutes: 95, category: FailureCategory.MECHANICAL, tech: fitter.id,
    symptom: 'Haul-off drive belt snapped, pipe stopped pulling', action: 'Replaced V-belt and re-tensioned',
    spares: [{ code: 'BLT-B68', qty: 2 }], people: [{ userId: fitter.id, hours: 1.5 }],
  });
  await breakdown({
    assetTag: 'HLF-001', occurred: at(-20, 9, 15), downMinutes: 60, category: FailureCategory.UTILITY, tech: fitter.id,
    symptom: 'Compressed-air leak at haul-off clamp cylinder; clamp not holding pipe',
    action: 'Replaced pneumatic tubing and push-in fittings', people: [{ userId: fitter.id, hours: 1 }],
  });
  await breakdown({
    assetTag: 'CUT-001', occurred: at(-15, 16, 20), downMinutes: 45, category: FailureCategory.MECHANICAL, tech: fitter.id,
    symptom: 'Cutter blade jammed at pipe end', action: 'Cleared jam, replaced blade, checked guide alignment',
    spares: [{ code: 'CUT-BLD', qty: 1 }], people: [{ userId: fitter.id, hours: 0.75 }],
  });
  await breakdown({
    assetTag: 'VAC-001', occurred: at(-25, 8, 0), downMinutes: 150, category: FailureCategory.MECHANICAL, tech: fitter.id,
    symptom: 'Barrel vacuum pump leaking water at mechanical seal; vacuum level dropping',
    action: 'Replaced mechanical seal and re-primed pump', spares: [{ code: 'SEAL-MS35', qty: 1 }], people: [{ userId: fitter.id, hours: 2.5 }],
  });

  // currently open breakdown — mixer is down, electrician on it
  const mixOccurred = new Date(NOW.getTime() - 3 * HOUR);
  const bOpen = await breakdown({
    assetTag: 'MIX-001', occurred: mixOccurred, attended: true, category: FailureCategory.ELECTRICAL, tech: electrician.id,
    symptom: 'High-speed mixer main motor tripping on overload during heating cycle',
  });
  await prisma.asset.update({ where: { id: A['MIX-001'].id }, data: { status: AssetStatus.DOWN } });

  // ----- RCA -----
  const rca1 = await prisma.rcaRecord.create({
    data: {
      workOrderId: b3.id, method: RcaMethod.FIVE_WHY, status: RcaRecordStatus.FINAL, createdById: supervisor.id, createdAt: at(-8, 11),
      whySteps: [
        { why: 'Why did the extruder trip on overload?', because: 'Motor current spiked due to heavy vibration at the coupling.' },
        { why: 'Why was there heavy vibration at the coupling?', because: 'The rubber insert had worn out and the coupling gap was out of tolerance.' },
        { why: 'Why had the insert worn out unnoticed?', because: 'Coupling gap and insert condition were only checked every 5 months.' },
        { why: 'Why was the check interval so long?', because: 'The PM plan grouped it with the heavy periodic tasks.' },
        { why: 'Why was it not caught by operators?', because: 'There was no daily vibration/noise check at shift start.' },
      ],
      rootCause: 'Coupling insert wear went undetected because gap/alignment checks were only on the 5-month PM cycle.',
      remarks: 'Add a 15-day coupling check and a shift-start vibration/noise check.',
    },
  });
  await prisma.rcaActionItem.createMany({
    data: [
      { rcaRecordId: rca1.id, description: 'Replace coupling rubber insert and re-align motor–gearbox coupling', type: RcaActionType.CORRECTIVE, ownerId: fitter.id, dueDate: at(-8), status: RcaActionStatus.VERIFIED, completedAt: at(-9, 3), verifiedById: head.id },
      { rcaRecordId: rca1.id, description: 'Train operators to log abnormal vibration/noise at shift start', type: RcaActionType.CORRECTIVE, ownerId: supervisor.id, dueDate: at(-2), status: RcaActionStatus.DONE, completedAt: at(-2, 10) },
      { rcaRecordId: rca1.id, description: 'Add coupling gap & insert check to the 15-day PM list', type: RcaActionType.PREVENTIVE, ownerId: supervisor.id, dueDate: at(10), status: RcaActionStatus.IN_PROGRESS },
      { rcaRecordId: rca1.id, description: 'Fit vibration sensor on extruder main motor for trending', type: RcaActionType.PREVENTIVE, ownerId: electrician.id, dueDate: at(-3), status: RcaActionStatus.OPEN },
    ],
  });
  const rca2 = await prisma.rcaRecord.create({
    data: {
      workOrderId: b2.id, method: RcaMethod.FISHBONE, status: RcaRecordStatus.DRAFT, createdById: supervisor.id, createdAt: at(-36, 10),
      fishboneCauses: {
        Man: ['Terminal torque not checked at last PM'],
        Machine: ['Heater band at end of life'],
        Method: ['No periodic heater current measurement'],
        Material: ['Band heater batch quality unknown'],
        Environment: ['Dust build-up on terminal block'],
      },
      remarks: 'Draft — awaiting heater current trend data.',
    },
  });
  await prisma.rcaActionItem.create({
    data: { rcaRecordId: rca2.id, description: 'Record heater current per zone at every monthly PM', type: RcaActionType.PREVENTIVE, ownerId: electrician.id, dueDate: at(14), status: RcaActionStatus.OPEN },
  });

  // ----- deviation notes -----
  await prisma.deviationNote.create({
    data: {
      workOrderId: hlfOpen.id, raisedById: fitter.id, reason: 'Waiting for drive-belt and oil-seal kit from vendor; line is on a priority order this week',
      originalDueDate: hlfOpen.dueDate!, proposedDate: at(9), status: DeviationNoteStatus.PENDING, createdAt: at(0, 8, 30),
    },
  });
  await prisma.deviationNote.create({
    data: {
      workOrderId: vacClosed.id, raisedById: electrician.id, reason: 'Pump needed for urgent production run; PM moved to the next planned stop',
      originalDueDate: at(-15), proposedDate: at(-9), status: DeviationNoteStatus.APPROVED, approvedById: head.id, approvedAt: at(-14, 11), createdAt: at(-16, 9),
    },
  });

  // ----- pending job sheet (follow-ups raised at completion) -----
  await prisma.pendingJobSheetItem.createMany({
    data: [
      { workOrderId: hlfPartial.id, assetId: A['HLF-001'].id, description: 'Complete deferred haul-off PM checks (chain drive, clamping system, printer)', raisedById: fitter.id, assignedToId: fitter.id, dueDate: at(4), status: PendingJobSheetStatus.OPEN, createdAt: at(-30, 14) },
      { workOrderId: bOpen.id, assetId: A['MIX-001'].id, description: 'Check mixer motor winding insulation (megger) before restart', raisedById: electrician.id, assignedToId: electrician.id, dueDate: at(1), status: PendingJobSheetStatus.IN_PROGRESS, createdAt: at(0, 9) },
      { workOrderId: b3.id, assetId: A['EXT-001'].id, description: 'Tighten loose cable tray near extruder panel', raisedById: fitter.id, assignedToId: electrician.id, dueDate: at(-5), status: PendingJobSheetStatus.DONE, completedAt: at(-6, 15), createdAt: at(-9, 3) },
    ],
  });

  // keep the live PM sheet relevant: extruder PM currently in progress
  void extNow;

  console.log('\n✔ Demo data ready.');
  const counts = {
    assets: await prisma.asset.count(),
    pmSchedules: await prisma.pMSchedule.count(),
    predictiveSchedules: await prisma.predictiveSchedule.count(),
    workOrders: await prisma.workOrder.count(),
    breakdowns: await prisma.breakdownDetail.count(),
    rca: await prisma.rcaRecord.count(),
  };
  console.table(counts);
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
