import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { ExportColumn } from './excel.service';

@Injectable()
export class PdfService {
  exportTable(title: string, columns: ExportColumn[], rows: Record<string, unknown>[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).font('Helvetica-Bold').text(title);
      doc.moveDown(0.5);

      const usableWidth = doc.page.width - 60;
      const colWidth = usableWidth / columns.length;

      doc.fontSize(9).font('Helvetica-Bold');
      let y = doc.y;
      columns.forEach((c, i) => doc.text(c.header, 30 + i * colWidth, y, { width: colWidth - 4 }));
      doc.moveDown(0.75);
      doc.font('Helvetica');

      for (const row of rows) {
        y = doc.y;
        if (y > doc.page.height - 50) {
          doc.addPage();
          y = doc.y;
        }
        columns.forEach((c, i) => doc.text(String(row[c.key] ?? ''), 30 + i * colWidth, y, { width: colWidth - 4 }));
        doc.moveDown(0.6);
      }

      doc.end();
    });
  }
}
