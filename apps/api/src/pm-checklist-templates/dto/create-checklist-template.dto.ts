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
import { ChecklistInputType, ChecklistItemTrade, MaintenanceType } from '@prisma/client';

class ChecklistItemInput {
  @IsInt()
  orderIndex!: number;

  @IsString()
  instruction!: string;

  @IsBoolean()
  mandatory!: boolean;

  @IsEnum(ChecklistInputType)
  inputType!: ChecklistInputType;

  @IsString()
  equipmentGroup!: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsEnum(ChecklistItemTrade)
  trade?: ChecklistItemTrade;

  @IsOptional()
  @IsString()
  criteria?: string;

  @IsOptional()
  @IsBoolean()
  priorToPm?: boolean;

  @IsOptional()
  @IsInt()
  manpowerRequirement?: number;

  @IsOptional()
  @IsNumber()
  timeRequirementHours?: number;
}

export class CreateChecklistTemplateDto {
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
  @Type(() => ChecklistItemInput)
  items!: ChecklistItemInput[];
}
