import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface ExportColumn {
  key: string;
  header: string;
}

@Injectable()
export class ExcelService {
  async exportRows(sheetName: string, columns: ExportColumn[], rows: Record<string, unknown>[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 22 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** Reads the first sheet; matches columns by header text (order-independent). */
  async importRows(buffer: Buffer, columns: ExportColumn[]): Promise<Record<string, string>[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const keyByColumnIndex = new Map<number, string>();
    headerRow.eachCell((cell, colNumber) => {
      const match = columns.find((c) => c.header.trim().toLowerCase() === String(cell.value ?? '').trim().toLowerCase());
      if (match) keyByColumnIndex.set(colNumber, match.key);
    });

    const rows: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, string> = {};
      keyByColumnIndex.forEach((key, colNumber) => {
        const value = row.getCell(colNumber).value;
        obj[key] = value == null ? '' : String(value);
      });
      if (Object.values(obj).some((v) => v !== '')) rows.push(obj);
    });
    return rows;
  }
}
