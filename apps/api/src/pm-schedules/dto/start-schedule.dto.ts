import { IsOptional, IsString } from 'class-validator';

export class StartScheduleDto {
  @IsString()
  assignedToId!: string;

  /** Required when starting off the schedule's due date (early or late). */
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  plannedNotes?: string;
}
