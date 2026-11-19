import type { Response } from 'express';

export function sendExportFile(res: Response, format: 'xlsx' | 'pdf', filenameBase: string, buffer: Buffer) {
  if (format === 'pdf') {
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filenameBase}.pdf"` });
  } else {
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
    });
  }
  res.send(buffer);
}
