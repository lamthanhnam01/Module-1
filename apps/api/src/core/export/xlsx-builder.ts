/**
 * Standardized OpenXML (.xlsx) Workbook Generator
 * Pure Node.js implementation using built-in zlib (zero external dependencies).
 * Generates genuine binary PKZip .xlsx files compliant with Microsoft Excel, LibreOffice & Google Sheets.
 *
 * Features:
 * - Frozen header panes
 * - Native Excel AutoFilter
 * - Toan Trung brand styling (Navy blue headers #1E3A8A, white bold text, zebra striping)
 * - Safe string escaping (preventing spreadsheet formula injection)
 * - Explicit string type for phone numbers & codes (preserves leading zeros like 0903123456)
 * - Currency and date formatting
 */

import zlib from 'node:zlib';

export interface XlsxColumn {
  header: string;
  key: string;
  width?: number;
  type?: 'string' | 'number' | 'currency' | 'percent' | 'date';
}

export interface XlsxSheet {
  name: string;
  title?: string;
  metadata?: Array<{ label: string; value: string }>;
  kpiSummary?: Array<{ label: string; value: string | number }>;
  columns: XlsxColumn[];
  rows: Array<Record<string, unknown>>;
  summaryRow?: Record<string, unknown>;
  footerNotes?: string[];
}

function escapeXml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeForFormulaInjection(val: string): string {
  if (!val) return '';
  // Prepend single quote if string begins with formula trigger chars (=, +, -, @)
  if (/^[=+\-@]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

// Convert 0-indexed column number to Excel column letters (0 -> A, 27 -> AB)
function colToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Lightweight ZIP (PKZip) packager using standard Node.js zlib
 */
export class ZipArchive {
  private files: Array<{
    name: string;
    data: Buffer;
    crc32: number;
    compressed: Buffer;
  }> = [];

  addFile(name: string, content: string | Buffer): void {
    const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    const crc = this.computeCrc32(data);
    const compressed = zlib.deflateRawSync(data);
    this.files.push({ name, data, crc32: crc, compressed });
  }

  toBuffer(): Buffer {
    const localHeaders: Buffer[] = [];
    const centralDirs: Buffer[] = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBuf = Buffer.from(file.name, 'utf8');

      // Local file header (30 bytes + name)
      const lfh = Buffer.alloc(30 + nameBuf.length);
      lfh.writeUInt32LE(0x04034b50, 0); // Local header signature
      lfh.writeUInt16LE(20, 4); // Version needed (2.0)
      lfh.writeUInt16LE(0, 6); // General purpose bit flag
      lfh.writeUInt16LE(8, 8); // Compression method (8 = Deflate)
      lfh.writeUInt16LE(0, 10); // Last mod time
      lfh.writeUInt16LE(0, 12); // Last mod date
      lfh.writeUInt32LE(file.crc32, 14); // CRC-32
      lfh.writeUInt32LE(file.compressed.length, 18); // Compressed size
      lfh.writeUInt32LE(file.data.length, 22); // Uncompressed size
      lfh.writeUInt16LE(nameBuf.length, 26); // File name length
      lfh.writeUInt16LE(0, 28); // Extra field length
      nameBuf.copy(lfh, 30);

      localHeaders.push(lfh, file.compressed);

      // Central directory header (46 bytes + name)
      const cdh = Buffer.alloc(46 + nameBuf.length);
      cdh.writeUInt32LE(0x02014b50, 0); // Central directory signature
      cdh.writeUInt16LE(20, 4); // Version made by
      cdh.writeUInt16LE(20, 6); // Version needed
      cdh.writeUInt16LE(0, 8); // General purpose bit flag
      cdh.writeUInt16LE(8, 10); // Compression method
      cdh.writeUInt16LE(0, 12); // Last mod time
      cdh.writeUInt16LE(0, 14); // Last mod date
      cdh.writeUInt32LE(file.crc32, 16); // CRC-32
      cdh.writeUInt32LE(file.compressed.length, 20); // Compressed size
      cdh.writeUInt32LE(file.data.length, 24); // Uncompressed size
      cdh.writeUInt16LE(nameBuf.length, 28); // File name length
      cdh.writeUInt16LE(0, 30); // Extra field length
      cdh.writeUInt16LE(0, 32); // File comment length
      cdh.writeUInt16LE(0, 34); // Disk number start
      cdh.writeUInt16LE(0, 36); // Internal file attributes
      cdh.writeUInt32LE(0, 38); // External file attributes
      cdh.writeUInt32LE(offset, 42); // Relative offset of local header
      nameBuf.copy(cdh, 46);

      centralDirs.push(cdh);
      offset += lfh.length + file.compressed.length;
    }

    const centralDirBuffer = Buffer.concat(centralDirs);
    const centralDirSize = centralDirBuffer.length;
    const centralDirOffset = offset;

    // End of central directory record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
    eocd.writeUInt16LE(0, 4); // Number of this disk
    eocd.writeUInt16LE(0, 6); // Disk where central directory starts
    eocd.writeUInt16LE(this.files.length, 8); // Number of central directory records on this disk
    eocd.writeUInt16LE(this.files.length, 10); // Total number of central directory records
    eocd.writeUInt32LE(centralDirSize, 12); // Size of central directory
    eocd.writeUInt32LE(centralDirOffset, 16); // Offset of start of central directory
    eocd.writeUInt16LE(0, 20); // Comment length

    return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
  }

  private computeCrc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      const byte = buf[i];
      crc ^= byte;
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}

/**
 * Generate OpenXML Styles (styles.xml)
 * Defines fonts, fills, borders and cell formats:
 * Style 0: Normal
 * Style 1: Title (Bold, 14pt, Navy #1E3A8A)
 * Style 2: Header (Bold, 11pt, White text, Navy Blue Fill #1E3A8A, Thin Border, Center)
 * Style 3: Zebra Row (Light gray #F8FAFC, Thin Border)
 * Style 4: Plain Cell (Thin Border)
 * Style 5: Currency / Number (Thin Border, Right align)
 */
function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0"/>
    <numFmt numFmtId="165" formatCode="0.00%"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Segoe UI"/><color rgb="FF1E293B"/></font>
    <font><b/><sz val="14"/><name val="Segoe UI"/><color rgb="FF1E3A8A"/></font>
    <font><b/><sz val="11"/><name val="Segoe UI"/><color rgb="FFFFFFFF"/></font>
    <font><b/><sz val="11"/><name val="Segoe UI"/><color rgb="FF1E3A8A"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

function buildSheetXml(sheet: XlsxSheet): string {
  let currentRow = 1;
  const rowsXml: string[] = [];

  // Sheet Title
  if (sheet.title) {
    rowsXml.push(
      `<row r="${currentRow}" ht="28" customHeight="1">` +
        `<c r="A${currentRow}" s="1" t="inlineStr"><is><t>${escapeXml(sheet.title)}</t></is></c>` +
        `</row>`
    );
    currentRow++;
  }

  // Metadata rows (Filters, Export time, Scope)
  if (sheet.metadata && sheet.metadata.length > 0) {
    for (const meta of sheet.metadata) {
      rowsXml.push(
        `<row r="${currentRow}" ht="18">` +
          `<c r="A${currentRow}" t="inlineStr"><is><t>${escapeXml(meta.label)}: ${escapeXml(meta.value)}</t></is></c>` +
          `</row>`
      );
      currentRow++;
    }
  }

  // Top KPI Summary Banner Row (Step 6.2)
  if (sheet.kpiSummary && sheet.kpiSummary.length > 0) {
    const kpiCells = sheet.kpiSummary
      .map((kpi, idx) => {
        const colLetter = colToLetter(idx);
        return `<c r="${colLetter}${currentRow}" s="7" t="inlineStr"><is><t>${escapeXml(kpi.label)}: ${escapeXml(kpi.value)}</t></is></c>`;
      })
      .join('');
    rowsXml.push(`<row r="${currentRow}" ht="26" customHeight="1">${kpiCells}</row>`);
    currentRow++;
  }

  // Empty separator row
  currentRow++;

  const headerRowIndex = currentRow;
  const colCount = sheet.columns.length;
  const lastColLetter = colToLetter(colCount - 1);

  // Auto-calculated column widths with padding to prevent ### cutoffs
  const colsXml: string[] = ['<cols>'];
  sheet.columns.forEach((col, idx) => {
    let maxLen = col.header.length;
    for (let r = 0; r < Math.min(sheet.rows.length, 200); r++) {
      const val = sheet.rows[r]?.[col.key];
      if (val != null) {
        const strLen = String(val).length;
        if (strLen > maxLen) maxLen = strLen;
      }
    }
    const autoWidth = Math.min(60, Math.max(col.width || 12, maxLen + 5));
    colsXml.push(`<col min="${idx + 1}" max="${idx + 1}" width="${autoWidth}" customWidth="1"/>`);
  });
  colsXml.push('</cols>');

  // Header row with Toan Trung Navy Blue styling (#1E3A8A, s="2", row height 32px)
  const headerCells = sheet.columns
    .map((col, idx) => {
      const colLetter = colToLetter(idx);
      return `<c r="${colLetter}${headerRowIndex}" s="2" t="inlineStr"><is><t>${escapeXml(col.header)}</t></is></c>`;
    })
    .join('');

  rowsXml.push(`<row r="${headerRowIndex}" ht="32" customHeight="1">${headerCells}</row>`);
  currentRow++;

  const firstDataRow = currentRow;

  // Data rows
  sheet.rows.forEach((row, rowIdx) => {
    const isZebra = rowIdx % 2 === 1;
    const defaultStyle = isZebra ? 3 : 4;

    const cells = sheet.columns
      .map((col, colIdx) => {
        const colLetter = colToLetter(colIdx);
        const cellRef = `${colLetter}${currentRow}`;
        const rawVal = row[col.key];

        if (rawVal == null || rawVal === '') {
          return `<c r="${cellRef}" s="${defaultStyle}"/>`;
        }

        // Numeric, currency (#,##0) or percent (0.00%)
        if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') {
          const num = typeof rawVal === 'number' ? rawVal : Number(rawVal);
          if (!isNaN(num)) {
            const numStyle = col.type === 'percent' ? 6 : 5;
            return `<c r="${cellRef}" s="${numStyle}"><v>${num}</v></c>`;
          }
        }

        // String / Text: Explicit inline string to preserve leading zeros in phone numbers & codes
        const sanitized = sanitizeForFormulaInjection(String(rawVal));
        return `<c r="${cellRef}" s="${defaultStyle}" t="inlineStr"><is><t>${escapeXml(sanitized)}</t></is></c>`;
      })
      .join('');

    rowsXml.push(`<row r="${currentRow}" ht="20">${cells}</row>`);
    currentRow++;
  });

  const lastDataRow = Math.max(firstDataRow, currentRow - 1);

  if (sheet.summaryRow) {
    const summaryCells = sheet.columns
      .map((col, colIdx) => {
        const colLetter = colToLetter(colIdx);
        const cellRef = `${colLetter}${currentRow}`;
        const rawVal = sheet.summaryRow?.[col.key];
        if (rawVal == null || rawVal === '') {
          return `<c r="${cellRef}" s="7"/>`;
        }
        if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') {
          const num = typeof rawVal === 'number' ? rawVal : Number(rawVal);
          if (!isNaN(num)) {
            const numStyle = col.type === 'percent' ? 6 : 5;
            return `<c r="${cellRef}" s="${numStyle}"><v>${num}</v></c>`;
          }
        }
        const sanitized = sanitizeForFormulaInjection(String(rawVal));
        return `<c r="${cellRef}" s="7" t="inlineStr"><is><t>${escapeXml(sanitized)}</t></is></c>`;
      })
      .join('');
    rowsXml.push(`<row r="${currentRow}" ht="24" customHeight="1">${summaryCells}</row>`);
    currentRow++;
  }

  if (sheet.footerNotes && sheet.footerNotes.length > 0) {
    currentRow++;
    for (const note of sheet.footerNotes) {
      rowsXml.push(
        `<row r="${currentRow}" ht="18">` +
          `<c r="A${currentRow}" t="inlineStr"><is><t>${escapeXml(sanitizeForFormulaInjection(note))}</t></is></c>` +
          `</row>`
      );
      currentRow++;
    }
  }

  // AutoFilter range: from header row to last data row
  const autoFilterXml = `<autoFilter ref="A${headerRowIndex}:${lastColLetter}${lastDataRow}"/>`;

  // Freeze panes at header row
  const viewsXml = `
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="${headerRowIndex}" topLeftCell="A${firstDataRow}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${viewsXml}
  ${colsXml.join('')}
  <sheetData>
    ${rowsXml.join('\n    ')}
  </sheetData>
  ${autoFilterXml}
</worksheet>`;
}

export function buildStandardXlsxBuffer(sheets: XlsxSheet[]): Buffer {
  const zip = new ZipArchive();

  // 1. [Content_Types].xml
  const sheetTypes = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('');

  zip.addFile(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetTypes}
</Types>`
  );

  // 2. _rels/.rels
  zip.addFile(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  // 3. xl/_rels/workbook.xml.rels
  const sheetRels = sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('');
  const stylesRelId = `rId${sheets.length + 1}`;

  zip.addFile(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. xl/workbook.xml
  const sheetsTag = sheets
    .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');

  zip.addFile(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetsTag}
  </sheets>
</workbook>`
  );

  // 5. xl/styles.xml
  zip.addFile('xl/styles.xml', buildStylesXml());

  // 6. xl/worksheets/sheetN.xml
  sheets.forEach((sheet, idx) => {
    zip.addFile(`xl/worksheets/sheet${idx + 1}.xml`, buildSheetXml(sheet));
  });

  return zip.toBuffer();
}

