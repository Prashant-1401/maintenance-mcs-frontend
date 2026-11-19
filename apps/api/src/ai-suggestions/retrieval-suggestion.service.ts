import { Injectable } from '@nestjs/common';
import { WorkOrderStatus, WorkOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AiSuggestionService,
  BreakdownSuggestion,
  PmSuggestion,
  SimilarBreakdownCase,
} from './ai-suggestion.types';

const STOPWORDS = new Set(['the', 'and', 'was', 'were', 'this', 'that', 'with', 'from', 'have', 'has']);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let score = 0;
  for (const word of a) {
    if (b.has(word)) score += 1;
  }
  return score;
}

/**
 * Retrieval-only AI suggestion implementation: surfaces similar past cases via keyword
 * overlap and recent PM findings, without calling an external LLM. See the plan's
 * "AI Suggestions" trade-off table — this is the free, zero-dependency first cut;
 * an LLM-synthesis layer can be added later behind the same AiSuggestionService interface.
 */
@Injectable()
export class RetrievalSuggestionService implements AiSuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  async suggestForBreakdown(assetId: string, symptom: string): Promise<BreakdownSuggestion> {
    const pastBreakdowns = await this.prisma.workOrder.findMany({
      where: { assetId, type: WorkOrderType.BREAKDOWN, status: WorkOrderStatus.CLOSED },
      include: {
        breakdownDetail: true,
        rcaRecords: { include: { actionItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    const queryTokens = tokenize(symptom);

    const scored: SimilarBreakdownCase[] = pastBreakdowns
      .filter((wo) => wo.breakdownDetail)
      .map((wo) => {
        const detail = wo.breakdownDetail!;
        const rca = wo.rcaRecords[0];
        return {
          workOrderId: wo.id,
          occurredAt: detail.occurredAt,
          symptom: detail.symptom,
          actionTaken: detail.actionTaken,
          rootCause: rca?.rootCause ?? null,
          correctiveActions: rca?.actionItems.map((a) => a.description) ?? [],
          matchScore: overlapScore(queryTokens, tokenize(detail.symptom)),
        };
      });

    const hasMatches = scored.some((c) => c.matchScore > 0);
    const topCases = [...scored]
      .sort((a, b) => (hasMatches ? b.matchScore - a.matchScore : 0) || b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, 5);

    const summary = hasMatches
      ? `Found ${topCases.filter((c) => c.matchScore > 0).length} similar past breakdown(s) on this asset based on the symptom description.`
      : topCases.length > 0
        ? 'No keyword match with past symptoms — showing this asset’s most recent breakdown history instead.'
        : 'No breakdown history exists for this asset yet.';

    return { summary, similarCases: topCases };
  }

  async suggestForPm(assetId: string): Promise<PmSuggestion> {
    const pastPmOrders = await this.prisma.workOrder.findMany({
      where: { assetId, type: WorkOrderType.PM, status: WorkOrderStatus.CLOSED },
      include: { checklistResponses: { include: { checklistItem: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentFindings = pastPmOrders
      .flatMap((wo) =>
        wo.checklistResponses
          .filter((r) => r.passed === false)
          .map((r) => ({
            workOrderId: wo.id,
            completedAt: r.completedAt,
            instruction: r.checklistItem.instruction,
            value: r.value,
          })),
      )
      .slice(0, 10);

    const summary =
      recentFindings.length > 0
        ? `${recentFindings.length} failed checklist item(s) found in this asset's last ${pastPmOrders.length} completed PM(s) — worth double-checking.`
        : pastPmOrders.length > 0
          ? 'No failed checklist items in recent PM history for this asset.'
          : 'No completed PM history exists for this asset yet.';

    return { summary, recentFindings };
  }
}
