import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FailureCategory } from '@prisma/client';

export class RaiseBreakdownDto {
  @IsString()
  assetId!: string;

  @IsDateString()
  occurredAt!: string;

  @IsEnum(FailureCategory)
  failureCategory!: FailureCategory;

  @IsString()
  symptom!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
