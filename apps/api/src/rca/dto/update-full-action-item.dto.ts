import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { RcaActionType } from '@prisma/client';

export class UpdateFullActionItemDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(RcaActionType)
  type?: RcaActionType;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
