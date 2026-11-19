import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { RcaRecordStatus } from '@prisma/client';

export class UpdateRcaRecordDto {
  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  whySteps?: Record<string, unknown>[];

  @IsOptional()
  @IsObject()
  fishboneCauses?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(RcaRecordStatus)
  status?: RcaRecordStatus;
}
