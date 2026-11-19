import { IsDateString, IsOptional, IsString } from 'class-validator';
import { CompletionCaptureDto } from '../../work-orders/dto/completion-capture.dto';

export class CloseBreakdownDto extends CompletionCaptureDto {
  @IsString()
  actionTaken!: string;

  @IsOptional()
  @IsDateString()
  restoredAt?: string;
}
