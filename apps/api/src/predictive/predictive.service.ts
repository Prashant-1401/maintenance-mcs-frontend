import { Injectable } from '@nestjs/common';
import { CriteriaType, ReadingStatus, ThresholdDirection, WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STATUS_RANK: Record<ReadingStatus, number> = {
  [ReadingStatus.NORMAL]: 0,
  [ReadingStatus.WARNING]: 1,
  [ReadingStatus.CRITICAL]: 2,
};
const HEATMAP_LOOKBACK_DAYS = 180;

interface CheckPointCriteria {
  criteriaType: CriteriaType;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  direction: ThresholdDirection | null;
}

@Injectable()
export class PredictiveService {
  constructor(private readonly prisma: PrismaService) {}

  /** Shared by WorkOrderPredictiveReading writes — derives NORMAL/WARNING/CRITICAL from a checkpoint's criteria. */
  computeCheckPointStatus(
    checkPoint: CheckPointCriteria,
    input: { numericValue?: number | null; passed?: boolean | null },
  ): ReadingStatus {
    if (checkPoint.criteriaType === CriteriaType.QUALITATIVE) {
      if (input.passed === false) return ReadingStatus.CRITICAL;
      return ReadingStatus.NORMAL;
    }

    const value = input.numericValue;
    if (value == null) return ReadingStatus.NORMAL;
    const { warningThreshold, criticalThreshold, direction } = checkPoint;

    if (direction === ThresholdDirection.BELOW) {
      if (criticalThreshold != null && value <= criticalThreshold) return ReadingStatus.CRITICAL;
      if (warningThreshold != null && value <= warningThreshold) return ReadingStatus.WARNING;
      return ReadingStatus.NORMAL;
    }
    if (criticalThreshold != null && value >= criticalThreshold) return ReadingStatus.CRITICAL;
    if (warningThreshold != null && value >= warningThreshold) return ReadingStatus.WARNING;
    return ReadingStatus.NORMAL;
  }

  /**
   * Heatmap feed. `mode=status` (default): latest reading per (asset, checkpoint) in the lookback
   * window, worst status per asset. `mode=deviations`: count of deviation notes raised against this
   * asset's predictive checks in the same window, bucketed into NORMAL/WARNING/CRITICAL like a
   * reading status so the existing tile-color legend applies. Both grouped by line.
   */
  async heatmap(locationId?: string, mode: 'status' | 'deviations' = 'status') {
    if (mode === 'deviations') {
      return this.heatmapDeviations(locationId);
    }

    const since = new Date(Date.now() - HEATMAP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const readings = await this.prisma.workOrderPredictiveReading.findMany({
      where: { recordedAt: { gte: since } },
      include: {
        checkPoint: true,
        workOrder: { include: { asset: { include: { location: true } } } },
      },
      orderBy: { recordedAt: 'desc' },
    });

    const latestByAssetCheckPoint = new Map<string, (typeof readings)[number]>();
    for (const r of readings) {
      const key = `${r.workOrder.assetId}::${r.checkPointId}`;
      if (!latestByAssetCheckPoint.has(key)) latestByAssetCheckPoint.set(key, r);
    }

    const byAsset = new Map<
      string,
      {
        asset: (typeof readings)[number]['workOrder']['asset'];
        checkPoints: { label: string; value: string; status: ReadingStatus; recordedAt: Date }[];
      }
    >();
    for (const r of latestByAssetCheckPoint.values()) {
      const asset = r.workOrder.asset;
      if (locationId && asset.locationId !== locationId) continue;
      const entry = byAsset.get(asset.id) ?? { asset, checkPoints: [] };
      const value =
        r.checkPoint.criteriaType === CriteriaType.QUALITATIVE
          ? r.passed === false
            ? 'Not OK'
            : r.passed === true
              ? 'OK'
              : '—'
          : `${r.numericValue ?? '—'}${r.checkPoint.unit ? ` ${r.checkPoint.unit}` : ''}`;
      entry.checkPoints.push({
        label: `${r.checkPoint.equipmentGroup} — ${r.checkPoint.checkPointName}`,
        value,
        status: r.status,
        recordedAt: r.recordedAt!,
      });
      byAsset.set(asset.id, entry);
    }

    const assetsWithWorst = [...byAsset.values()].map(({ asset, checkPoints }) => ({
      asset,
      worstStatus: checkPoints.reduce<ReadingStatus>(
        (worst, p) => (STATUS_RANK[p.status] > STATUS_RANK[worst] ? p.status : worst),
        ReadingStatus.NORMAL,
      ),
      checkPoints,
    }));

    const byLocation = new Map<string, { locationId: string; locationName: string; assets: typeof assetsWithWorst }>();
    for (const entry of assetsWithWorst) {
      const locId = entry.asset.locationId;
      const group = byLocation.get(locId) ?? { locationId: locId, locationName: entry.asset.location.name, assets: [] };
      group.assets.push(entry);
      byLocation.set(locId, group);
    }

    return [...byLocation.values()];
  }

  private async heatmapDeviations(locationId?: string) {
    const since = new Date(Date.now() - HEATMAP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const notes = await this.prisma.deviationNote.findMany({
      where: { createdAt: { gte: since }, workOrder: { type: WorkOrderType.PREDICTIVE } },
      include: { workOrder: { include: { asset: { include: { location: true } } } } },
    });

    const byAsset = new Map<string, { asset: (typeof notes)[number]['workOrder']['asset']; count: number }>();
    for (const note of notes) {
      const asset = note.workOrder.asset;
      if (locationId && asset.locationId !== locationId) continue;
      const entry = byAsset.get(asset.id) ?? { asset, count: 0 };
      entry.count += 1;
      byAsset.set(asset.id, entry);
    }

    const assetsWithStatus = [...byAsset.values()].map(({ asset, count }) => ({
      asset,
      worstStatus: count === 0 ? ReadingStatus.NORMAL : count <= 2 ? ReadingStatus.WARNING : ReadingStatus.CRITICAL,
      deviationCount: count,
      checkPoints: [] as { label: string; value: string; status: ReadingStatus; recordedAt: Date }[],
    }));

    const byLocation = new Map<string, { locationId: string; locationName: string; assets: typeof assetsWithStatus }>();
    for (const entry of assetsWithStatus) {
      const locId = entry.asset.locationId;
      const group = byLocation.get(locId) ?? { locationId: locId, locationName: entry.asset.location.name, assets: [] };
      group.assets.push(entry);
      byLocation.set(locId, group);
    }

    return [...byLocation.values()];
  }
}
