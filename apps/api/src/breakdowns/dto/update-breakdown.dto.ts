import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FailureCategory } from '@prisma/client';
import { CompletionCaptureDto } from '../../work-orders/dto/completion-capture.dto';

/** Admin correction on a breakdown at any status — always requires a reason for the audit trail. */
export class UpdateBreakdownDto extends CompletionCaptureDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsEnum(FailureCategory)
  failureCategory?: FailureCategory;

  @IsOptional()
  @IsString()
  symptom?: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  @IsDateString()
  restoredAt?: string;
}
