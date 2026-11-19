import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePendingJobSheetItemDto {
  @IsString()
  assetId!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
