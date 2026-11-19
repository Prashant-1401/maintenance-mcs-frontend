import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTroubleshootingPlaybookDto {
  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  assetCategory?: string;

  @IsString()
  symptom!: string;

  @IsString()
  probableCause!: string;

  @IsString()
  standardFix!: string;

  @IsOptional()
  @IsString()
  recommendedSpares?: string;

  @IsOptional()
  @IsString()
  safetyPrecautions?: string;

  @IsOptional()
  @IsInt()
  estimatedDowntimeMin?: number;
}
