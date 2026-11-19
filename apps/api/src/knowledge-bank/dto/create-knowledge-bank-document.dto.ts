import { IsOptional, IsString } from 'class-validator';

export class CreateKnowledgeBankDocumentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  machineModel?: string;
}

