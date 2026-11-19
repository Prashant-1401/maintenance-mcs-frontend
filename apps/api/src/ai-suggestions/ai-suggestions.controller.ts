import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AI_SUGGESTION_SERVICE } from './ai-suggestions.tokens';
import type { AiSuggestionService } from './ai-suggestion.types';

@Controller('ai-suggestions')
@UseGuards(JwtAuthGuard)
export class AiSuggestionsController {
  constructor(@Inject(AI_SUGGESTION_SERVICE) private readonly aiSuggestionService: AiSuggestionService) {}

  @Get('breakdown')
  suggestForBreakdown(@Query('assetId') assetId: string, @Query('symptom') symptom: string) {
    return this.aiSuggestionService.suggestForBreakdown(assetId, symptom ?? '');
  }

  @Get('pm')
  suggestForPm(@Query('assetId') assetId: string) {
    return this.aiSuggestionService.suggestForPm(assetId);
  }
}
