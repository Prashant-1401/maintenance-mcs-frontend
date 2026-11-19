-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PermissionTier" AS ENUM ('ADMIN', 'MANAGEMENT', 'TECHNICIAN', 'REQUESTER');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('OPERATIONAL', 'DOWN', 'UNDER_MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('BREAKDOWN', 'PM', 'PREDICTIVE');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'ATTENDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PendingJobSheetStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "DeviationNoteStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FailureCategory" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'UTILITY', 'INSTRUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PMTriggerType" AS ENUM ('TIME', 'USAGE', 'METER');

-- CreateEnum
CREATE TYPE "ChecklistInputType" AS ENUM ('CHECKBOX', 'NUMERIC', 'TEXT', 'PASS_FAIL');

-- CreateEnum
CREATE TYPE "ChecklistItemTrade" AS ENUM ('OPERATOR', 'ELECTRICAL', 'MECHANICAL');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('NORMAL', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ThresholdDirection" AS ENUM ('ABOVE', 'BELOW');

-- CreateEnum
CREATE TYPE "CriteriaType" AS ENUM ('NUMERIC', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "RcaMethod" AS ENUM ('FIVE_WHY', 'FISHBONE');

-- CreateEnum
CREATE TYPE "RcaRecordStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "RcaActionType" AS ENUM ('CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "RcaActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "PermissionTier" NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 100,
    "maintenanceType" "MaintenanceType",
    "capacity" INTEGER NOT NULL DEFAULT 5,
    "hourlyRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "criticality" "AssetCriticality" NOT NULL DEFAULT 'MEDIUM',
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "type" "WorkOrderType" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "assetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "downtimeStart" TIMESTAMP(3),
    "downtimeEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "plannedNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pmScheduleId" TEXT,
    "predictiveScheduleId" TEXT,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spare_parts" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "unitCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spare_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_spare_parts" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "sparePartId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "unitCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_spare_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_participants" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hoursSpent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_job_sheet_items" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT,
    "assetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "PendingJobSheetStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_job_sheet_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_status_history" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "notes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deviation_notes" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "originalDueDate" TIMESTAMP(3) NOT NULL,
    "proposedDate" TIMESTAMP(3) NOT NULL,
    "status" "DeviationNoteStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deviation_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breakdown_details" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendedAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "failureCategory" "FailureCategory" NOT NULL DEFAULT 'OTHER',
    "symptom" TEXT NOT NULL,
    "actionTaken" TEXT,
    "reportedById" TEXT NOT NULL,
    "attendedById" TEXT,

    CONSTRAINT "breakdown_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_schedules" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "PMTriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "checklistTemplateId" TEXT,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pm_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_checklist_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetCategory" TEXT,
    "maintenanceType" "MaintenanceType" NOT NULL DEFAULT 'OTHER',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pm_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_checklist_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "inputType" "ChecklistInputType" NOT NULL DEFAULT 'CHECKBOX',
    "equipmentGroup" TEXT NOT NULL,
    "frequency" TEXT,
    "trade" "ChecklistItemTrade",
    "criteria" TEXT,
    "priorToPm" BOOLEAN NOT NULL DEFAULT false,
    "manpowerRequirement" INTEGER,
    "timeRequirementHours" DOUBLE PRECISION,

    CONSTRAINT "pm_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_checklist_responses" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "value" TEXT,
    "passed" BOOLEAN,
    "remarks" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "work_order_checklist_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictive_checklist_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetCategory" TEXT,
    "maintenanceType" "MaintenanceType" NOT NULL DEFAULT 'OTHER',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictive_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictive_check_points" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "equipmentGroup" TEXT NOT NULL,
    "checkPointName" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "criteriaType" "CriteriaType" NOT NULL,
    "unit" TEXT,
    "warningThreshold" DOUBLE PRECISION,
    "criticalThreshold" DOUBLE PRECISION,
    "direction" "ThresholdDirection",
    "expectedValue" TEXT,

    CONSTRAINT "predictive_check_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_predictive_readings" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "checkPointId" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "observedText" TEXT,
    "status" "ReadingStatus" NOT NULL DEFAULT 'NORMAL',
    "remarks" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3),

    CONSTRAINT "work_order_predictive_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictive_schedules" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "PMTriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "checklistTemplateId" TEXT,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predictive_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rca_records" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "method" "RcaMethod" NOT NULL,
    "whySteps" JSONB,
    "fishboneCauses" JSONB,
    "rootCause" TEXT,
    "remarks" TEXT,
    "status" "RcaRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rca_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rca_action_items" (
    "id" TEXT NOT NULL,
    "rcaRecordId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RcaActionType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RcaActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rca_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bank_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "assetId" TEXT,
    "tags" TEXT,
    "machineModel" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_bank_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_operational_baselines" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "nominalValue" DOUBLE PRECISION NOT NULL,
    "minThreshold" DOUBLE PRECISION,
    "maxThreshold" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "operatingMode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_operational_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "troubleshooting_playbooks" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "assetCategory" TEXT,
    "symptom" TEXT NOT NULL,
    "probableCause" TEXT NOT NULL,
    "standardFix" TEXT NOT NULL,
    "recommendedSpares" TEXT,
    "safetyPrecautions" TEXT,
    "estimatedDowntimeMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "troubleshooting_playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tag_key" ON "assets"("tag");

-- CreateIndex
CREATE INDEX "work_orders_assetId_type_idx" ON "work_orders"("assetId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "spare_parts_itemCode_key" ON "spare_parts"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_participants_workOrderId_userId_key" ON "work_order_participants"("workOrderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "breakdown_details_workOrderId_key" ON "breakdown_details"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_checklist_responses_workOrderId_checklistItemId_key" ON "work_order_checklist_responses"("workOrderId", "checklistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_predictive_readings_workOrderId_checkPointId_key" ON "work_order_predictive_readings"("workOrderId", "checkPointId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_pmScheduleId_fkey" FOREIGN KEY ("pmScheduleId") REFERENCES "pm_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_predictiveScheduleId_fkey" FOREIGN KEY ("predictiveScheduleId") REFERENCES "predictive_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_spare_parts" ADD CONSTRAINT "work_order_spare_parts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_spare_parts" ADD CONSTRAINT "work_order_spare_parts_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_participants" ADD CONSTRAINT "work_order_participants_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_participants" ADD CONSTRAINT "work_order_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_job_sheet_items" ADD CONSTRAINT "pending_job_sheet_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_job_sheet_items" ADD CONSTRAINT "pending_job_sheet_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_job_sheet_items" ADD CONSTRAINT "pending_job_sheet_items_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_job_sheet_items" ADD CONSTRAINT "pending_job_sheet_items_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_notes" ADD CONSTRAINT "deviation_notes_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_notes" ADD CONSTRAINT "deviation_notes_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviation_notes" ADD CONSTRAINT "deviation_notes_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_details" ADD CONSTRAINT "breakdown_details_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_details" ADD CONSTRAINT "breakdown_details_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_details" ADD CONSTRAINT "breakdown_details_attendedById_fkey" FOREIGN KEY ("attendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "pm_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_checklist_items" ADD CONSTRAINT "pm_checklist_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "pm_checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklist_responses" ADD CONSTRAINT "work_order_checklist_responses_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklist_responses" ADD CONSTRAINT "work_order_checklist_responses_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "pm_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklist_responses" ADD CONSTRAINT "work_order_checklist_responses_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictive_check_points" ADD CONSTRAINT "predictive_check_points_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "predictive_checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_predictive_readings" ADD CONSTRAINT "work_order_predictive_readings_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_predictive_readings" ADD CONSTRAINT "work_order_predictive_readings_checkPointId_fkey" FOREIGN KEY ("checkPointId") REFERENCES "predictive_check_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_predictive_readings" ADD CONSTRAINT "work_order_predictive_readings_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictive_schedules" ADD CONSTRAINT "predictive_schedules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictive_schedules" ADD CONSTRAINT "predictive_schedules_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "predictive_checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_records" ADD CONSTRAINT "rca_records_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_records" ADD CONSTRAINT "rca_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_action_items" ADD CONSTRAINT "rca_action_items_rcaRecordId_fkey" FOREIGN KEY ("rcaRecordId") REFERENCES "rca_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_action_items" ADD CONSTRAINT "rca_action_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rca_action_items" ADD CONSTRAINT "rca_action_items_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bank_documents" ADD CONSTRAINT "knowledge_bank_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bank_documents" ADD CONSTRAINT "knowledge_bank_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_operational_baselines" ADD CONSTRAINT "machine_operational_baselines_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "troubleshooting_playbooks" ADD CONSTRAINT "troubleshooting_playbooks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

