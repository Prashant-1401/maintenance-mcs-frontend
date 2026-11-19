import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CriteriaType, MaintenanceType, ThresholdDirection } from '@prisma/client';

class CheckPointInput {
  @IsInt()
  orderIndex!: number;

  @IsString()
  equipmentGroup!: string;

  @IsString()
  checkPointName!: string;

  @IsBoolean()
  mandatory!: boolean;

  @IsEnum(CriteriaType)
  criteriaType!: CriteriaType;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsOptional()
  @IsNumber()
  criticalThreshold?: number;

  @IsOptional()
  @IsEnum(ThresholdDirection)
  direction?: ThresholdDirection;

  @IsOptional()
  @IsString()
  expectedValue?: string;
}

export class CreatePredictiveChecklistTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  assetCategory?: string;

  @IsOptional()
  @IsEnum(MaintenanceType)
  maintenanceType?: MaintenanceType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckPointInput)
  checkPoints!: CheckPointInput[];
}
