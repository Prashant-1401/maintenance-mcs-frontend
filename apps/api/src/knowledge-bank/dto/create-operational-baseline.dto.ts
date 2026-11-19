import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOperationalBaselineDto {
  @IsString()
  assetId!: string;

  @IsString()
  parameterName!: string;

  @IsNumber()
  nominalValue!: number;

  @IsOptional()
  @IsNumber()
  minThreshold?: number;

  @IsOptional()
  @IsNumber()
  maxThreshold?: number;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsString()
  operatingMode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
