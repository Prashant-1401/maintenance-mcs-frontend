import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { RcaActionType, RcaMethod, RcaRecordStatus } from '@prisma/client';

export class ActionItemInput {
  @IsString()
  description!: string;

  @IsEnum(RcaActionType)
  type!: RcaActionType;

  @IsString()
  ownerId!: string;

  @IsString()
  dueDate!: string;
}

export class CreateRcaRecordDto {
  @IsString()
  workOrderId!: string;

  @IsEnum(RcaMethod)
  method!: RcaMethod;

  /** Ordered array of { why: string } steps for the FIVE_WHY method. */
  @IsOptional()
  @IsArray()
  whySteps?: Record<string, unknown>[];

  /** Map of Fishbone category -> causes, e.g. { Man: [...], Machine: [...] }, for the FISHBONE method. */
  @IsOptional()
  @IsObject()
  fishboneCauses?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsEnum(RcaRecordStatus)
  status?: RcaRecordStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ActionItemInput)
  actionItems?: ActionItemInput[];
}
