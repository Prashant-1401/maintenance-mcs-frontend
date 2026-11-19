import { IsOptional, IsString } from 'class-validator';

export class AssignWorkOrderDto {
  /** Omit or set null to unassign. */
  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
