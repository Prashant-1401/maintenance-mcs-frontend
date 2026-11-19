export interface SimilarBreakdownCase {
  workOrderId: string;
  occurredAt: Date;
  symptom: string;
  actionTaken: string | null;
  rootCause: string | null;
  correctiveActions: string[];
  matchScore: number;
}

export interface BreakdownSuggestion {
  summary: string;
  similarCases: SimilarBreakdownCase[];
}

export interface PmFinding {
  workOrderId: string;
  completedAt: Date | null;
  instruction: string;
  value: string | null;
}

export interface PmSuggestion {
  summary: string;
  recentFindings: PmFinding[];
}

/**
 * Behind an interface so a future LLM-synthesis implementation (see plan's
 * "AI Suggestions" trade-off section) can be swapped in without touching callers.
 */
export interface AiSuggestionService {
  suggestForBreakdown(assetId: string, symptom: string): Promise<BreakdownSuggestion>;
  suggestForPm(assetId: string): Promise<PmSuggestion>;
}
