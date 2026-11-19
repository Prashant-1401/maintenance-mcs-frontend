import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { PMTriggerType } from '@prisma/client';

export class CreatePredictiveScheduleDto {
  @IsString()
  assetId!: string;

  @IsString()
  name!: string;

  @IsEnum(PMTriggerType)
  triggerType!: PMTriggerType;

  /** For TIME: { intervalDays: number }. */
  @IsObject()
  triggerConfig!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsString()
  checklistTemplateId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
