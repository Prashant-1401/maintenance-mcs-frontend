import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetCriticality } from '@prisma/client';

export class CreateAssetDto {
  @IsString()
  tag!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(AssetCriticality)
  criticality?: AssetCriticality;

  @IsString()
  locationId!: string;
}
