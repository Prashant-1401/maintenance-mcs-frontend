import ExcelJS from 'exceljs';
import { classifyCriteria } from './criteria-parser';

export interface ParsedCheckPoint {
  orderIndex: number;
  equipmentGroup: string;
  checkPointName: string;
  mandatory: boolean;
  criteriaType: 'NUMERIC' | 'QUALITATIVE';
  unit?: string;
  criticalThreshold?: number;
  direction?: 'ABOVE' | 'BELOW';
  expectedValue?: string;
}

export interface ParsedPredictiveEquipmentGroup {
  name: string;
  checkPoints: ParsedCheckPoint[];
}

export interface ParsedPredictiveTemplate {
  templateName: string;
  equipmentGroups: ParsedPredictiveEquipmentGroup[];
  totalCheckPoints: number;
}

export interface ParsedPredictiveWorkbook {
  templates: ParsedPredictiveTemplate[];
  warnings: string[];
}

function cellText(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (value == null) return '';
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return (value as { richText: { text: string }[] }).richText.map((t) => t.text).join('');
  }
  if (typeof value === 'object' && 'result' in (value as object)) {
    return String((value as { result: unknown }).result ?? '');
  }
  return String(value).trim();
}

function parseSheet(sheet: ExcelJS.Worksheet, warnings: string[]): ParsedPredictiveTemplate | null {
  let headerRowNumber = 0;
  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber) return;
    const values = row.values as (string | undefined)[];
    const text = values.map((v) => String(v ?? '').toLowerCase()).join('|');
    if (text.includes('equipment') && text.includes('check')) headerRowNumber = rowNumber;
  });
  if (!headerRowNumber) return null;

  const groupsByName = new Map<string, ParsedPredictiveEquipmentGroup>();
  const order: string[] = [];
  let orderIndex = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const equipment = cellText(row, 1);
    const checkPointName = cellText(row, 2);
    const criteriaText = cellText(row, 3);
    if (!equipment || !checkPointName) return; // sentinel/blank rows (e.g. "Sign of maintenance person")

    if (!groupsByName.has(equipment)) {
      groupsByName.set(equipment, { name: equipment, checkPoints: [] });
      order.push(equipment);
    }

    const parsed = classifyCriteria(criteriaText);
    if (!parsed.confident) {
      warnings.push(
        `Sheet "${sheet.name}", row ${rowNumber}: "${equipment} — ${checkPointName}" criteria "${criteriaText || '(blank)'}" — classified as ${parsed.criteriaType}, please review.`,
      );
    }

    orderIndex += 1;
    groupsByName.get(equipment)!.checkPoints.push({
      orderIndex,
      equipmentGroup: equipment,
      checkPointName,
      mandatory: true,
      criteriaType: parsed.criteriaType,
      unit: parsed.unit,
      criticalThreshold: parsed.criticalThreshold,
      direction: parsed.direction,
      expectedValue: parsed.expectedValue,
    });
  });

  const equipmentGroups = order.map((name) => groupsByName.get(name)!);
  const totalCheckPoints = equipmentGroups.reduce((sum, g) => sum + g.checkPoints.length, 0);
  if (totalCheckPoints === 0) return null;

  return { templateName: sheet.name, equipmentGroups, totalCheckPoints };
}

function parseCatalogSheet(sheet: ExcelJS.Worksheet, warnings: string[]): ParsedPredictiveTemplate[] {
  let headerRowNumber = 0;
  let nameCol = 1;
  let categoryCol = 2;
  let checkpointsCol = 5;

  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber) return;
    row.eachCell((cell, colNumber) => {
      const text = String(cell.value ?? '').toLowerCase();
      if (text.includes('name')) nameCol = colNumber;
      if (text.includes('category')) categoryCol = colNumber;
      if (text.includes('check point') || text.includes('checkpoint') || text.includes('check points')) {
        checkpointsCol = colNumber;
        headerRowNumber = rowNumber;
      }
    });
  });

  if (!headerRowNumber) return [];

  const templates: ParsedPredictiveTemplate[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const name = cellText(row, nameCol);
    const category = cellText(row, categoryCol);
    const rawCheckPoints = cellText(row, checkpointsCol);
    if (!name || !rawCheckPoints) return;

    // Split check points by newline or numbered prefixes e.g. "1.", "2."
    const lines = rawCheckPoints
      .split(/(?:\r?\n|\s*(?=\d+\.\s+))/)
      .map((l) => l.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);

    const checkPoints: ParsedCheckPoint[] = lines.map((line, idx) => {
      const parsed = classifyCriteria(line);
      return {
        orderIndex: idx + 1,
        equipmentGroup: category || 'General',
        checkPointName: line,
        mandatory: true,
        criteriaType: parsed.criteriaType,
        unit: parsed.unit,
        criticalThreshold: parsed.criticalThreshold,
        direction: parsed.direction,
        expectedValue: parsed.expectedValue,
      };
    });

    if (checkPoints.length > 0) {
      templates.push({
        templateName: name,
        equipmentGroups: [{ name: category || 'General', checkPoints }],
        totalCheckPoints: checkPoints.length,
      });
    }
  });

  return templates;
}

/** Parses every sheet in the workbook that looks like a predictive checklist,
 *  supporting both raw multi-equipment inspection sheets and catalog export sheets. */
export async function parsePredictiveChecklistWorkbook(buffer: Buffer): Promise<ParsedPredictiveWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  const warnings: string[] = [];
  const templates: ParsedPredictiveTemplate[] = [];

  for (const sheet of workbook.worksheets) {
    const parsed = parseSheet(sheet, warnings);
    if (parsed) {
      templates.push(parsed);
    } else {
      const catalogTemplates = parseCatalogSheet(sheet, warnings);
      if (catalogTemplates.length > 0) {
        templates.push(...catalogTemplates);
      }
    }
  }

  if (templates.length === 0) {
    warnings.push('No valid checklist format (equipment sheet or template catalog) found.');
  }

  return { templates, warnings };
}
