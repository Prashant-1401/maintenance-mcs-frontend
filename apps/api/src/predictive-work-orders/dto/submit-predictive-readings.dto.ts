import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class PredictiveReadingInput {
  @IsString()
  checkPointId!: string;

  @IsOptional()
  @IsNumber()
  numericValue?: number;

  @IsOptional()
  @IsBoolean()
  passed?: boolean;

  @IsOptional()
  @IsString()
  observedText?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SubmitPredictiveReadingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PredictiveReadingInput)
  readings!: PredictiveReadingInput[];
}
