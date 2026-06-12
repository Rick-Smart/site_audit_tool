import * as XLSX from "xlsx";
import { getTypeLabel } from "./csvTypeDetection";

function sanitizeCellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  // Mitigate formula injection in spreadsheet apps.
  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

function toSanitizedRows(rows = [], headers = []) {
  return rows.map((row) => {
    const next = {};
    for (const header of headers) {
      next[header] = sanitizeCellValue(row?.[header]);
    }
    return next;
  });
}

function sanitizeSheetName(input, fallback = "Sheet") {
  const raw = String(input || fallback)
    .replace(/\.[^/.]+$/, "")
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const base = raw || fallback;
  return base.slice(0, 31);
}

function uniqueSheetName(base, usedNames) {
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }

  let index = 2;
  while (index < 1000) {
    const suffix = ` (${index})`;
    const maxBaseLength = Math.max(1, 31 - suffix.length);
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    index += 1;
  }

  const fallback = `Sheet-${Date.now()}`.slice(0, 31);
  usedNames.add(fallback);
  return fallback;
}

export function generateWorkbookExport(csvFiles = []) {
  if (!Array.isArray(csvFiles) || csvFiles.length === 0) {
    return;
  }

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();

  const summaryRows = csvFiles.map((file) => ({
    File: file.fileName,
    Type: getTypeLabel(file.detectedType),
    Rows: Array.isArray(file.rows) ? file.rows.length : 0,
    Columns: Array.isArray(file.headers) ? file.headers.length : 0,
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
    header: ["File", "Type", "Rows", "Columns"],
  });
  summarySheet["!autofilter"] = { ref: "A1:D1" };
  summarySheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const summaryName = uniqueSheetName("Summary", usedNames);
  XLSX.utils.book_append_sheet(workbook, summarySheet, summaryName);

  for (const file of csvFiles) {
    const headers = Array.isArray(file.headers) ? file.headers : [];
    const rows = Array.isArray(file.rows) ? file.rows : [];
    const sanitizedRows = toSanitizedRows(rows, headers);

    const sheet = XLSX.utils.json_to_sheet(sanitizedRows, {
      header: headers,
    });

    if (headers.length > 0) {
      const endColumn = XLSX.utils.encode_col(Math.max(0, headers.length - 1));
      sheet["!autofilter"] = { ref: `A1:${endColumn}1` };
      sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    }

    const baseName = sanitizeSheetName(file.fileName, "Import");
    const sheetName = uniqueSheetName(baseName, usedNames);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  XLSX.writeFile(workbook, `site_audit_export_${stamp}.xlsx`);
}
