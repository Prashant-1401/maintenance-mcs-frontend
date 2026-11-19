import { CriteriaType, ThresholdDirection } from '@prisma/client';

export interface ParsedCriteria {
  criteriaType: CriteriaType;
  unit?: string;
  criticalThreshold?: number;
  direction?: ThresholdDirection;
  expectedValue?: string;
  /** false when the parser had to guess (e.g. no explicit comparator, or blank criteria) — surface for admin review. */
  confident: boolean;
}

const COMPARATOR_PATTERN = /^\s*(<=|>=|<|>)\s*([\d.]+)\s*(.*)$/;
const BARE_NUMBER_PATTERN = /^\s*([\d.]+)\s*([a-zA-Z/%]*)\s*$/;

/** Classifies a free-text criteria cell as a numeric threshold or a qualitative expected value. */
export function classifyCriteria(raw: string | null | undefined): ParsedCriteria {
  const text = (raw ?? '').trim();
  if (!text) {
    return { criteriaType: CriteriaType.QUALITATIVE, confident: false };
  }

  const comparatorMatch = text.match(COMPARATOR_PATTERN);
  if (comparatorMatch) {
    const [, comparator, numberText, rest] = comparatorMatch;
    // The comparator describes the SAFE range (e.g. "< 80" = safe below 80), so the alert direction
    // is the opposite: safe-below-X alerts when the value rises to/above X (ABOVE), and safe-above-X
    // alerts when the value falls to/below X (BELOW) — matching computeCheckPointStatus's convention.
    return {
      criteriaType: CriteriaType.NUMERIC,
      criticalThreshold: Number(numberText),
      direction: comparator.startsWith('<') ? ThresholdDirection.ABOVE : ThresholdDirection.BELOW,
      unit: rest.trim() || undefined,
      confident: true,
    };
  }

  const bareNumberMatch = text.match(BARE_NUMBER_PATTERN);
  if (bareNumberMatch) {
    const [, numberText, unit] = bareNumberMatch;
    return {
      criteriaType: CriteriaType.NUMERIC,
      criticalThreshold: Number(numberText),
      direction: ThresholdDirection.ABOVE,
      unit: unit.trim() || undefined,
      confident: false, // no explicit comparator — direction guessed as ABOVE
    };
  }

  return { criteriaType: CriteriaType.QUALITATIVE, expectedValue: text, confident: true };
}
