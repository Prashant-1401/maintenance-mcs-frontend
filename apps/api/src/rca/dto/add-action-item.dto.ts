import { IsEnum, IsString } from 'class-validator';
import { RcaActionType } from '@prisma/client';

export class AddActionItemDto {
  @IsString()
  description!: string;

  @IsEnum(RcaActionType)
  type!: RcaActionType;

  @IsString()
  ownerId!: string;

  @IsString()
  dueDate!: string;
}
