import { Module } from '@nestjs/common';
import { AiSuggestionsController } from './ai-suggestions.controller';
import { RetrievalSuggestionService } from './retrieval-suggestion.service';
import { AI_SUGGESTION_SERVICE } from './ai-suggestions.tokens';

@Module({
  controllers: [AiSuggestionsController],
  providers: [
    RetrievalSuggestionService,
    { provide: AI_SUGGESTION_SERVICE, useClass: RetrievalSuggestionService },
  ],
  exports: [AI_SUGGESTION_SERVICE],
})
export class AiSuggestionsModule {}
