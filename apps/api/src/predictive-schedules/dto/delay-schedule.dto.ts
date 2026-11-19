import { IsDateString, IsString } from 'class-validator';

export class DelayScheduleDto {
  @IsString()
  reason!: string;

  @IsDateString()
  proposedDate!: string;
}
