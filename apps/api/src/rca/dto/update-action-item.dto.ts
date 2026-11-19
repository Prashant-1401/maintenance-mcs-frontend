import { IsEnum } from 'class-validator';
import { RcaActionStatus } from '@prisma/client';

export class UpdateActionItemDto {
  @IsEnum(RcaActionStatus)
  status!: RcaActionStatus;
}
