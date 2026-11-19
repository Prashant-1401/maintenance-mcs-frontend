import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SparePartInput {
  /** Selected from the Spare Parts master. When set, description/unit/cost are resolved from it. */
  @IsOptional()
  @IsString()
  sparePartId?: string;

  /** Required for an ad-hoc item not in the master (sparePartId omitted). */
  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  /** Ad-hoc items only — master-linked items use the master's unitCost instead. */
  @IsOptional()
  @IsNumber()
  unitCost?: number;
}

export class ParticipantInput {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsNumber()
  hoursSpent?: number;
}

export class FutureActionInput {
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/** Shared "how the job was closed out" fields — captured on both breakdown close and PM complete. */
export class CompletionCaptureDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SparePartInput)
  spareParts?: SparePartInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantInput)
  participants?: ParticipantInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FutureActionInput)
  futureActions?: FutureActionInput[];
}
