import ExcelJS from 'exceljs';
import { ChecklistItemTrade } from '@prisma/client';

export interface ParsedPmItem {
  orderIndex: number;
  instruction: string;
  mandatory: boolean;
  inputType: 'PASS_FAIL';
  equipmentGroup: string;
  frequency?: string;
  trade?: ChecklistItemTrade;
  criteria?: string;
  priorToPm: boolean;
  manpowerRequirement?: number;
  timeRequirementHours?: number;
}

export interface ParsedPmEquipmentGroup {
  name: string;
  items: ParsedPmItem[];
}

export interface ParsedPmTemplate {
  templateName: string;
  equipmentGroups: ParsedPmEquipmentGroup[];
  totalItems: number;
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

function mapTrade(text: string): ChecklistItemTrade | undefined {
  const normalized = text.trim().toLowerCase();
  if (normalized === 'operator') return ChecklistItemTrade.OPERATOR;
  if (normalized === 'electrical') return ChecklistItemTrade.ELECTRICAL;
  if (normalized === 'mechanical') return ChecklistItemTrade.MECHANICAL;
  return undefined;
}

/**
 * Parses the "PM Check list" sheet layout: equipment group header rows (Sr No column filled, group
 * name in the Description column, everything else blank) followed by item rows (Sr No blank) with
 * Description/Frequency/Section/Criteria/"prior to PM?"/manpower/time columns.
 * Column layout (1-indexed): B=Sr No, C=Description, D=Frequency, E=Section, F=Criteria,
 * G="To be carried out prior to PM?", H=Man-power Requirement, I=Time Requirement.
 */
export async function parsePmChecklistWorkbook(buffer: Buffer, templateName: string): Promise<ParsedPmTemplate> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets.find((ws) => /pm check ?list/i.test(ws.name)) ?? workbook.worksheets[0];

  const warnings: string[] = [];
  const equipmentGroups: ParsedPmEquipmentGroup[] = [];
  let orderIndex = 0;

  if (!sheet) {
    return { templateName, equipmentGroups, totalItems: 0, warnings: ['No worksheet found in the uploaded file.'] };
  }

  // Locate the header row by searching for "Frequency" + "Criteria" or "Checklist Items"
  let headerRowNumber = 0;
  let isCatalogFormat = false;
  let catNameCol = 1;
  let catGroupCol = 2;
  let catItemsCol = 5;

  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber) return;
    const values = row.values as (string | undefined)[];
    const text = values.map((v) => String(v ?? '').toLowerCase()).join('|');
    if (text.includes('frequency') && text.includes('criteria')) {
      headerRowNumber = rowNumber;
      isCatalogFormat = false;
    } else if (text.includes('checklist items') || text.includes('checklist item')) {
      headerRowNumber = rowNumber;
      isCatalogFormat = true;
      row.eachCell((cell, col) => {
        const cText = String(cell.value ?? '').toLowerCase();
        if (cText.includes('name')) catNameCol = col;
        if (cText.includes('category')) catGroupCol = col;
        if (cText.includes('checklist')) catItemsCol = col;
      });
    }
  });

  if (!headerRowNumber) {
    return {
      templateName,
      equipmentGroups,
      totalItems: 0,
      warnings: ['Could not locate the header row (expected columns "Frequency" + "Criteria" or "Checklist Items").'],
    };
  }

  if (isCatalogFormat) {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;
      const groupName = cellText(row, catGroupCol) || 'General PM';
      const rawItems = cellText(row, catItemsCol);
      if (!rawItems) return;

      const lines = rawItems
        .split(/(?:\r?\n|\s*(?=\d+\.\s+))/)
        .map((l) => l.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);

      if (lines.length > 0) {
        const group: ParsedPmEquipmentGroup = { name: groupName, items: [] };
        lines.forEach((line) => {
          orderIndex += 1;
          group.items.push({
            orderIndex,
            instruction: line,
            mandatory: true,
            inputType: 'PASS_FAIL',
            equipmentGroup: groupName,
            priorToPm: false,
          });
        });
        equipmentGroups.push(group);
      }
    });

    const totalItems = equipmentGroups.reduce((sum, g) => sum + g.items.length, 0);
    return { templateName, equipmentGroups, totalItems, warnings };
  }

  let currentGroup: ParsedPmEquipmentGroup | null = null;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const srNo = cellText(row, 2);
    const description = cellText(row, 3);
    if (!srNo && !description) return; // fully blank row

    if (srNo) {
      // Equipment group header row.
      currentGroup = { name: description || `Group ${srNo}`, items: [] };
      equipmentGroups.push(currentGroup);
      return;
    }

    if (!description) return;
    if (!currentGroup) {
      warnings.push(`Row ${rowNumber}: item "${description}" appeared before any equipment group header — skipped.`);
      return;
    }

    const frequency = cellText(row, 4) || undefined;
    const tradeText = cellText(row, 5);
    const trade = tradeText ? mapTrade(tradeText) : undefined;
    if (tradeText && !trade) {
      warnings.push(`Row ${rowNumber}: unrecognized trade "${tradeText}" for "${description}" — left unset.`);
    }
    const criteria = cellText(row, 6) || undefined;
    const priorToPmText = cellText(row, 7).toLowerCase();
    const manpowerText = cellText(row, 8);
    const timeText = cellText(row, 9);

    orderIndex += 1;
    currentGroup.items.push({
      orderIndex,
      instruction: description,
      mandatory: true,
      inputType: 'PASS_FAIL',
      equipmentGroup: currentGroup.name,
      frequency,
      trade,
      criteria,
      priorToPm: priorToPmText === 'yes',
      manpowerRequirement: manpowerText ? Number(manpowerText) || undefined : undefined,
      timeRequirementHours: timeText ? Number(timeText) || undefined : undefined,
    });
  });

  const nonEmptyGroups = equipmentGroups.filter((g) => g.items.length > 0);
  const totalItems = nonEmptyGroups.reduce((sum, g) => sum + g.items.length, 0);
  if (totalItems === 0) {
    warnings.push('No checklist items were found — check the file matches the expected "PM Check list" layout.');
  }

  return { templateName, equipmentGroups: nonEmptyGroups, totalItems, warnings };
}
