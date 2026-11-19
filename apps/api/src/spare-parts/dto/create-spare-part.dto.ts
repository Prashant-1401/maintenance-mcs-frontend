import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSparePartDto {
  @IsString()
  itemCode!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  unitCost?: number;
}
