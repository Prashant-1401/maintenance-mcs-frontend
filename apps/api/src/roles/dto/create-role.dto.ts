import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { MaintenanceType, PermissionTier } from '@prisma/client';

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsEnum(PermissionTier)
  tier!: PermissionTier;

  @IsOptional()
  @IsInt()
  rank?: number;

  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  hourlyRate?: number;

  @IsOptional()
  @IsEnum(MaintenanceType)
  maintenanceType?: MaintenanceType;
}
