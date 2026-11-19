import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PendingJobSheetStatus } from '@prisma/client';

export class UpdatePendingJobSheetItemDto {
  @IsOptional()
  @IsEnum(PendingJobSheetStatus)
  status?: PendingJobSheetStatus;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
