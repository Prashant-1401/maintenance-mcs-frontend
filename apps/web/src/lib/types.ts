export type PermissionTier = 'ADMIN' | 'MANAGEMENT' | 'TECHNICIAN' | 'REQUESTER';
export type MaintenanceType = 'MECHANICAL' | 'ELECTRICAL' | 'OTHER';

export interface Role {
  id: string;
  name: string;
  tier: PermissionTier;
  rank: number;
  maintenanceType: MaintenanceType | null;
  capacity: number;
  hourlyRate: number | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  tier: PermissionTier;
}

export interface SparePartMaster {
  id: string;
  itemCode: string;
  name: string;
  unit: string | null;
  unitCost: number | null;
}

export interface SparePartUsageEvent {
  id: string;
  workOrderId: string;
  workOrderType: 'BREAKDOWN' | 'PM' | 'PREDICTIVE';
  workOrderStatus: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  quantity: number;
  unit: string | null;
  unitCost: number | null;
  totalCost: number;
  usedAt: string;
}

export interface SparePartInventoryItem {
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
  usages: SparePartUsageEvent[];
}

export interface SparePartInventorySummary {
  totalMasterParts: number;
  totalUniqueUsed: number;
  totalQuantityConsumed: number;
  totalCostSpent: number;
  totalBreakdownUsages: number;
  totalPmUsages: number;
  totalPredictiveUsages: number;
  topUsedItems: Array<{ name: string; itemCode: string; timesUsed: number; totalQuantityUsed: number }>;
  topCostItems: Array<{ name: string; itemCode: string; totalCost: number; totalQuantityUsed: number }>;
}

export interface SparePartInventoryResponse {
  summary: SparePartInventorySummary;
  items: SparePartInventoryItem[];
}


export interface Location {
  id: string;
  name: string;
  parentId: string | null;
  children?: Location[];
  _count?: { assets: number };
}

export type AssetCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssetStatus = 'OPERATIONAL' | 'DOWN' | 'UNDER_MAINTENANCE' | 'RETIRED';

export interface Asset {
  id: string;
  tag: string;
  name: string;
  category: string | null;
  criticality: AssetCriticality;
  status: AssetStatus;
  locationId: string;
  location: Location;
}

export type WorkOrderType = 'BREAKDOWN' | 'PM' | 'PREDICTIVE';
export type WorkOrderStatus = 'OPEN' | 'ATTENDED' | 'CLOSED' | 'CANCELLED';
export type FailureCategory = 'MECHANICAL' | 'ELECTRICAL' | 'UTILITY' | 'INSTRUMENTATION' | 'OTHER';

export interface UserRef {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  notes: string | null;
  changedAt: string;
  changedBy: UserRef;
}

export interface BreakdownDetail {
  occurredAt: string;
  reportedAt: string;
  attendedAt: string | null;
  restoredAt: string | null;
  failureCategory: FailureCategory;
  symptom: string;
  actionTaken: string | null;
  reportedBy: UserRef;
  attendedBy: UserRef | null;
}

export interface WorkOrderSparePart {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unitCost: number | null;
}

export interface WorkOrderParticipant {
  id: string;
  user: UserRef;
  hoursSpent: number | null;
}

export type PendingJobSheetStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface PendingJobSheetItem {
  id: string;
  workOrderId: string | null;
  workOrder?: WorkOrder | null;
  assetId: string;
  asset: Asset;
  description: string;
  raisedBy: UserRef;
  assignedTo: UserRef | null;
  dueDate: string | null;
  status: PendingJobSheetStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  assetId: string;
  asset: Asset;
  createdBy: UserRef;
  assignedTo: UserRef | null;
  createdAt: string;
  dueDate?: string | null;
  completedAt?: string | null;
  plannedNotes?: string | null;
  breakdownDetail?: BreakdownDetail | null;
  statusHistory: StatusHistoryEntry[];
  checklistResponses?: ChecklistResponse[];
  pmSchedule?: PmSchedule | null;
  predictiveSchedule?: PredictiveSchedule | null;
  predictiveReadings?: WorkOrderPredictiveReading[];
  spareParts?: WorkOrderSparePart[];
  participants?: WorkOrderParticipant[];
  pendingJobSheetItems?: PendingJobSheetItem[];
}

export interface WorkloadEntry {
  technician: UserRef;
  openCount: number;
  attendedCount: number;
  totalCount: number;
  capacity: number;
  utilizationPct: number;
}

export interface WorkloadResponse {
  technicians: WorkloadEntry[];
  unassignedByType: { PM: number; PREDICTIVE: number; BREAKDOWN: number };
}

export interface BreakdownHistory {
  asset: Asset;
  breakdownCount: number;
  cumulativeDowntimeMinutes: number;
  averageDowntimeMinutes: number;
  daysSinceLastBreakdown: number | null;
  breakdowns: WorkOrder[];
}

export type PmCalendarColor = 'GREY' | 'PURPLE' | 'GREEN' | 'RED';

export interface PmCalendarEntry {
  id: string;
  assetTag: string;
  assetName: string;
  dueDate: string;
  status: WorkOrderStatus;
  completedAt: string | null;
  color: PmCalendarColor;
}

export interface AdminBreakdownHistory {
  groups: {
    location: Location;
    machines: { asset: Asset; breakdownCount: number; breakdowns: WorkOrder[] }[];
  }[];
  breakdowns: WorkOrder[];
}

export type ChecklistInputType = 'CHECKBOX' | 'NUMERIC' | 'TEXT' | 'PASS_FAIL';
export type ChecklistItemTrade = 'OPERATOR' | 'ELECTRICAL' | 'MECHANICAL';

export interface ChecklistItem {
  id: string;
  orderIndex: number;
  instruction: string;
  mandatory: boolean;
  inputType: ChecklistInputType;
  equipmentGroup: string;
  frequency: string | null;
  trade: ChecklistItemTrade | null;
  criteria: string | null;
  priorToPm: boolean;
  manpowerRequirement: number | null;
  timeRequirementHours: number | null;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  assetCategory: string | null;
  maintenanceType: MaintenanceType;
  version: number;
  items: ChecklistItem[];
}

export interface ChecklistResponse {
  id: string;
  checklistItemId: string;
  checklistItem: ChecklistItem;
  value: string | null;
  passed: boolean | null;
  remarks: string | null;
  completedBy: UserRef | null;
  completedAt: string | null;
}

export type PMTriggerType = 'TIME' | 'USAGE' | 'METER';

export interface PmSchedule {
  id: string;
  assetId: string;
  asset?: Asset;
  name: string;
  triggerType: PMTriggerType;
  triggerConfig: Record<string, unknown>;
  leadTimeDays: number;
  active: boolean;
  checklistTemplateId: string | null;
  checklistTemplate?: ChecklistTemplate | null;
  lastGeneratedAt: string | null;
}

export type ThresholdDirection = 'ABOVE' | 'BELOW';
export type ReadingStatus = 'NORMAL' | 'WARNING' | 'CRITICAL';
export type CriteriaType = 'NUMERIC' | 'QUALITATIVE';

export interface PredictiveCheckPoint {
  id: string;
  orderIndex: number;
  equipmentGroup: string;
  checkPointName: string;
  mandatory: boolean;
  criteriaType: CriteriaType;
  unit: string | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  direction: ThresholdDirection | null;
  expectedValue: string | null;
}

export interface PredictiveChecklistTemplate {
  id: string;
  name: string;
  assetCategory: string | null;
  maintenanceType: MaintenanceType;
  version: number;
  checkPoints: PredictiveCheckPoint[];
}

// ---- Excel import preview shapes (not persisted — round-tripped through the preview/commit flow) ----

export interface ParsedPmItem {
  orderIndex: number;
  instruction: string;
  mandatory: boolean;
  inputType: 'PASS_FAIL';
  equipmentGroup: string;
  frequency?: string;
  trade?: ChecklistItemTrade;
  criteria?: string;
  priorToPm: boolean;
  manpowerRequirement?: number;
  timeRequirementHours?: number;
}

export interface ParsedPmEquipmentGroup {
  name: string;
  items: ParsedPmItem[];
}

export interface ParsedPmTemplate {
  templateName: string;
  equipmentGroups: ParsedPmEquipmentGroup[];
  totalItems: number;
  warnings: string[];
}

export interface ParsedCheckPoint {
  orderIndex: number;
  equipmentGroup: string;
  checkPointName: string;
  mandatory: boolean;
  criteriaType: CriteriaType;
  unit?: string;
  criticalThreshold?: number;
  direction?: ThresholdDirection;
  expectedValue?: string;
}

export interface ParsedPredictiveEquipmentGroup {
  name: string;
  checkPoints: ParsedCheckPoint[];
}

export interface ParsedPredictiveTemplate {
  templateName: string;
  equipmentGroups: ParsedPredictiveEquipmentGroup[];
  totalCheckPoints: number;
}

export interface ParsedPredictiveWorkbook {
  templates: ParsedPredictiveTemplate[];
  warnings: string[];
}

export interface LineKpi {
  location: { id: string; name: string };
  breakdownCount: number;
  downtimeMinutes: number;
  mttrMinutes: number | null;
}

export interface AssetKpi {
  asset: Asset;
  breakdownCount: number;
  mttrMinutes: number | null;
  mtbfDays: number | null;
  pm: { totalPm: number; closedPm: number; pmComplianceRate: number | null };
  rca: { totalActionItems: number; doneOrVerified: number; rcaClosureRate: number | null };
}

export interface KpiTrendPoint {
  period: string;
  breakdownCount: number;
  downtimeMinutes: number;
}

export interface MaintenanceCosts {
  manpowerCost: number;
  sparesCost: number;
  totalCost: number;
}

export interface CostTrendPoint {
  period: string;
  manpowerCost: number;
  sparesCost: number;
}

export interface EquipmentPerformanceEntry {
  assetId: string;
  assetTag: string;
  assetName: string;
  breakdownCount: number;
  mttrMinutes: number | null;
  mtbfDays: number | null;
  availability: number;
}

export interface PredictiveHeatmapAssetEntry {
  asset: Asset;
  worstStatus: ReadingStatus;
  checkPoints: { label: string; value: string; status: ReadingStatus; recordedAt: string }[];
  deviationCount?: number;
}

export interface PredictiveHeatmapGroup {
  locationId: string;
  locationName: string;
  assets: PredictiveHeatmapAssetEntry[];
}

export interface PreventiveHeatmapAssetEntry {
  asset: Asset;
  status: 'DONE' | 'PARTIAL' | 'NOT_DONE';
}

export interface PreventiveHeatmapGroup {
  locationId: string;
  locationName: string;
  assets: PreventiveHeatmapAssetEntry[];
}

export interface BreakdownHeatmapAssetEntry {
  asset: Asset;
  breakdownCount: number;
  mttrMinutes: number | null;
  mtbfDays: number | null;
  worstStatus: ReadingStatus;
}

export interface BreakdownHeatmapGroup {
  locationId: string;
  locationName: string;
  assets: BreakdownHeatmapAssetEntry[];
}

export interface WorkOrderPredictiveReading {
  id: string;
  checkPointId: string;
  checkPoint: PredictiveCheckPoint;
  numericValue: number | null;
  passed: boolean | null;
  observedText: string | null;
  status: ReadingStatus;
  remarks: string | null;
  recordedBy: UserRef | null;
  recordedAt: string | null;
}

export type DeviationNoteStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DeviationNote {
  id: string;
  workOrderId: string;
  workOrder: WorkOrder;
  raisedBy: UserRef;
  reason: string;
  originalDueDate: string;
  proposedDate: string;
  status: DeviationNoteStatus;
  approvedBy: UserRef | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface KnowledgeBankDocument {
  id: string;
  title: string;
  category: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  assetId?: string | null;
  asset?: { id: string; tag: string; name: string; category?: string | null } | null;
  tags?: string | null;
  machineModel?: string | null;
  uploadedBy: UserRef;
  createdAt: string;
}

export interface MachineOperationalBaseline {
  id: string;
  assetId: string;
  asset?: { id: string; tag: string; name: string; category?: string | null };
  parameterName: string;
  nominalValue: number;
  minThreshold?: number | null;
  maxThreshold?: number | null;
  unit: string;
  operatingMode?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TroubleshootingPlaybook {
  id: string;
  assetId?: string | null;
  asset?: { id: string; tag: string; name: string; category?: string | null } | null;
  assetCategory?: string | null;
  symptom: string;
  probableCause: string;
  standardFix: string;
  recommendedSpares?: string | null;
  safetyPrecautions?: string | null;
  estimatedDowntimeMin?: number | null;
  createdAt: string;
  updatedAt: string;
}


export interface PredictiveSchedule {
  id: string;
  assetId: string;
  asset?: Asset;
  name: string;
  triggerType: PMTriggerType;
  triggerConfig: Record<string, unknown>;
  leadTimeDays: number;
  checklistTemplateId: string | null;
  checklistTemplate?: PredictiveChecklistTemplate | null;
  active: boolean;
  lastGeneratedAt: string | null;
}

export type RcaMethod = 'FIVE_WHY' | 'FISHBONE';
export type RcaActionType = 'CORRECTIVE' | 'PREVENTIVE';
export type RcaActionStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'VERIFIED';

export interface RcaActionItem {
  id: string;
  description: string;
  type: RcaActionType;
  owner: UserRef;
  dueDate: string;
  status: RcaActionStatus;
  completedAt: string | null;
  verifiedBy: UserRef | null;
  overdue?: boolean;
  rcaRecord?: { workOrder: { asset: Asset } };
}

export type RcaRecordStatus = 'DRAFT' | 'FINAL';

export interface RcaRecord {
  id: string;
  workOrderId: string;
  workOrder?: WorkOrder;
  method: RcaMethod;
  whySteps: { why: string; because: string }[] | null;
  fishboneCauses: Record<string, string[]> | null;
  rootCause: string | null;
  remarks: string | null;
  status: RcaRecordStatus;
  createdBy: UserRef;
  createdAt: string;
  actionItems: RcaActionItem[];
}

export interface RcaActionGroup {
  rcaRecordId: string;
  asset: Asset;
  method: RcaMethod;
  createdAt: string;
  actionItems: RcaActionItem[];
}

export interface KpiDashboard {
  mttrMinutes: number | null;
  mtbfDaysOverall: number | null;
  mtbfByAsset: { assetId: string; assetTag: string; mtbfDays: number }[];
  topFailingAssets: { assetId: string; assetTag: string; assetName: string; count: number; downtimeMinutes: number }[];
  breakdownCount: number;
  pm: { totalPm: number; closedPm: number; pmComplianceRate: number | null };
  predictive: { totalPredictive: number; closedPredictive: number; predictiveComplianceRate: number | null };
  rca: { totalActionItems: number; doneOrVerified: number; rcaClosureRate: number | null; overdueActionItems: number };
  predictiveTrend: { normal: number; warning: number; critical: number };
}

export type KpiMetric = 'breakdownCount' | 'mttr' | 'mtbf' | 'pmCompliance' | 'rcaClosureRate' | 'predictiveCompliance';

export interface KpiTrendValuePoint {
  period: string;
  value: number | null;
}

export interface BreakdownSuggestion {
  summary: string;
  similarCases: {
    workOrderId: string;
    occurredAt: string;
    symptom: string;
    actionTaken: string | null;
    rootCause: string | null;
    correctiveActions: string[];
    matchScore: number;
  }[];
}

export interface PmSuggestion {
  summary: string;
  recentFindings: { workOrderId: string; completedAt: string | null; instruction: string; value: string | null }[];
}
