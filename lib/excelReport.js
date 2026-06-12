import * as XLSX from "xlsx";
import { CSV_TYPES, getTypeLabel } from "./csvTypeDetection";

const DEFAULT_EXPORT_OPTIONS = {
  includeSummary: true,
  includeNormalized: false,
  sheetNameMode: "filename",
  filePrefix: "site_audit_export",
};

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

function toPlainRow(record) {
  const next = {};

  for (const [key, value] of Object.entries(record || {})) {
    if (key === "raw" && value && typeof value === "object") {
      for (const [rawKey, rawValue] of Object.entries(value)) {
        next[`raw::${rawKey}`] = sanitizeCellValue(rawValue);
      }
      continue;
    }

    if (value && typeof value === "object") {
      continue;
    }

    next[key] = sanitizeCellValue(value);
  }

  return next;
}

function buildHeaderOrder(rows) {
  const headers = [];
  const seen = new Set();

  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  return headers;
}

function applySheetOptions(sheet, headers = [], rows = []) {
  if (headers.length === 0) {
    return;
  }

  const endColumn = XLSX.utils.encode_col(Math.max(0, headers.length - 1));
  sheet["!autofilter"] = { ref: `A1:${endColumn}1` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  sheet["!cols"] = headers.map((header) => {
    const headerWidth = String(header).length;
    const cellWidth = rows.reduce((maxWidth, row) => {
      const valueWidth = String(row?.[header] ?? "").length;
      return Math.max(maxWidth, valueWidth);
    }, 0);

    return { wch: Math.min(60, Math.max(10, headerWidth, cellWidth) + 2) };
  });
}

function resolveRawSheetBaseName(file, mode) {
  if (mode === "type-filename") {
    return `${getTypeLabel(file.detectedType)} - ${file.fileName}`;
  }
  return file.fileName;
}

export function generateWorkbookExport(csvFiles = [], options = {}, dataByType = {}) {
  if (!Array.isArray(csvFiles) || csvFiles.length === 0) {
    return;
  }

  const resolved = {
    ...DEFAULT_EXPORT_OPTIONS,
    ...options,
  };

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();

  if (resolved.includeSummary) {
    const summaryRows = csvFiles.map((file) => ({
      File: file.fileName,
      Type: getTypeLabel(file.detectedType),
      Rows: Array.isArray(file.rows) ? file.rows.length : 0,
      Columns: Array.isArray(file.headers) ? file.headers.length : 0,
    }));

    const summaryHeaders = ["File", "Type", "Rows", "Columns"];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
      header: summaryHeaders,
    });
    applySheetOptions(summarySheet, summaryHeaders, summaryRows);

    const summaryName = uniqueSheetName("Summary", usedNames);
    XLSX.utils.book_append_sheet(workbook, summarySheet, summaryName);
  }

  for (const file of csvFiles) {
    const headers = Array.isArray(file.headers) ? file.headers : [];
    const rows = Array.isArray(file.rows) ? file.rows : [];
    const sanitizedRows = toSanitizedRows(rows, headers);

    const sheet = XLSX.utils.json_to_sheet(sanitizedRows, {
      header: headers,
    });

    applySheetOptions(sheet, headers, sanitizedRows);

    const rawBaseName = resolveRawSheetBaseName(file, resolved.sheetNameMode);
    const baseName = sanitizeSheetName(rawBaseName, "Import");
    const sheetName = uniqueSheetName(baseName, usedNames);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  if (resolved.includeNormalized) {
    const orderedTypes = [CSV_TYPES.DEVICES, CSV_TYPES.ADMINS, CSV_TYPES.USERS, CSV_TYPES.GENERIC];

    for (const type of orderedTypes) {
      const records = Array.isArray(dataByType[type]) ? dataByType[type] : [];
      if (records.length === 0) {
        continue;
      }

      const normalizedRows = records.map((record) => toPlainRow(record));
      const normalizedHeaders = buildHeaderOrder(normalizedRows);

      const normalizedSheet = XLSX.utils.json_to_sheet(normalizedRows, {
        header: normalizedHeaders,
      });

      applySheetOptions(normalizedSheet, normalizedHeaders, normalizedRows);

      const normalizedName = uniqueSheetName(
        sanitizeSheetName(`${getTypeLabel(type)} Normalized`, `${type} Normalized`),
        usedNames
      );
      XLSX.utils.book_append_sheet(workbook, normalizedSheet, normalizedName);
    }
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const prefix = String(resolved.filePrefix || DEFAULT_EXPORT_OPTIONS.filePrefix)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || DEFAULT_EXPORT_OPTIONS.filePrefix;

  XLSX.writeFile(workbook, `${prefix}_${stamp}.xlsx`);
}
