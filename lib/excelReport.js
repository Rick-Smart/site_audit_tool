import * as XLSX from "xlsx-js-style";
import { CSV_TYPES, getTypeLabel } from "./csvTypeDetection";
import { normalizeStatus, pickColumn, STATUS_COLUMN_CANDIDATES } from "./audit";

const DEFAULT_EXPORT_OPTIONS = {
  includeSummary: true,
  includeNormalized: false,
  sheetNameMode: "filename",
  filePrefix: "site_audit_export",
};

const STATUS_CELL_STYLES = {
  healthy: {
    fill: { patternType: "solid", fgColor: { rgb: "C6EFCE" } },
    font: { color: { rgb: "006100" }, bold: true },
  },
  dormant: {
    fill: { patternType: "solid", fgColor: { rgb: "FFE699" } },
    font: { color: { rgb: "7F6000" }, bold: true },
  },
  unhealthy: {
    fill: { patternType: "solid", fgColor: { rgb: "F8CBAD" } },
    font: { color: { rgb: "9C0006" }, bold: true },
  },
  unknown: {
    fill: { patternType: "solid", fgColor: { rgb: "E7E6E6" } },
    font: { color: { rgb: "404040" }, bold: true },
  },
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

function toStatusFlag(statusValue) {
  const normalized = normalizeStatus(statusValue);

  if (normalized.tone === "healthy") {
    return "ONLINE";
  }
  if (normalized.tone === "dormant") {
    return "DORMANT";
  }
  if (normalized.tone === "unhealthy") {
    return "OFFLINE";
  }
  return "UNKNOWN";
}

function applyStatusCellStyles(sheet, headers = [], rows = []) {
  if (headers.length === 0 || rows.length === 0) {
    return;
  }

  const statusColumnIndexes = headers
    .map((header, index) => ({ header: String(header || ""), index }))
    .filter(({ header }) => {
      const h = header.toLowerCase();
      return h === "status" || h === "status flag" || h === "statusflag" || h === "statustone";
    })
    .map(({ index }) => index);

  if (statusColumnIndexes.length === 0) {
    return;
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || {};

    for (const colIndex of statusColumnIndexes) {
      const header = headers[colIndex];
      const value = row?.[header];
      const tone = normalizeStatus(value).tone;
      const style = STATUS_CELL_STYLES[tone] || STATUS_CELL_STYLES.unknown;

      const address = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex + 1 });
      const cell = sheet[address];
      if (!cell) {
        continue;
      }

      cell.s = {
        ...(cell.s || {}),
        fill: style.fill,
        font: {
          ...(cell.s?.font || {}),
          ...(style.font || {}),
        },
      };
    }
  }
}

function appendRawStatusFlagColumn(headers = [], rows = []) {
  if (headers.length === 0 || rows.length === 0) {
    return { headers, rows };
  }

  const statusColumn = pickColumn(headers, STATUS_COLUMN_CANDIDATES);
  if (!statusColumn) {
    return { headers, rows };
  }

  const flagHeader = "Status Flag";
  const nextHeaders = headers.includes(flagHeader) ? [...headers] : [...headers, flagHeader];
  const nextRows = rows.map((row) => ({
    ...row,
    [flagHeader]: toStatusFlag(row?.[statusColumn]),
  }));

  return {
    headers: nextHeaders,
    rows: nextRows,
  };
}

function appendNormalizedStatusFlagColumn(headers = [], rows = []) {
  if (!headers.includes("status") && !headers.includes("statusTone")) {
    return { headers, rows };
  }

  const flagHeader = "statusFlag";
  const nextHeaders = headers.includes(flagHeader) ? [...headers] : [...headers, flagHeader];
  const nextRows = rows.map((row) => ({
    ...row,
    [flagHeader]: row?.statusTone
      ? toStatusFlag(row.statusTone === "dormant" ? "dormant" : row.status)
      : toStatusFlag(row?.status),
  }));

  return {
    headers: nextHeaders,
    rows: nextRows,
  };
}

function toDeltaSummaryRows(diffReport) {
  if (!diffReport?.hasBaseline) {
    return [];
  }

  const rows = [
    {
      scope: "Total",
      added: diffReport.totals.added,
      removed: diffReport.totals.removed,
      modified: diffReport.totals.modified,
      statusChanged: diffReport.totals.statusChanged,
    },
  ];

  const orderedTypes = [CSV_TYPES.DEVICES, CSV_TYPES.ADMINS, CSV_TYPES.USERS, CSV_TYPES.GENERIC];
  for (const type of orderedTypes) {
    const bucket = diffReport.byType?.[type];
    if (!bucket) {
      continue;
    }

    rows.push({
      scope: getTypeLabel(type),
      added: bucket.added,
      removed: bucket.removed,
      modified: bucket.modified,
      statusChanged: bucket.statusChanged,
    });
  }

  return rows;
}

function toDeltaChangeRows(diffReport) {
  if (!diffReport?.hasBaseline || !Array.isArray(diffReport.changes)) {
    return [];
  }

  return diffReport.changes.map((change) => ({
    type: change.typeLabel || getTypeLabel(change.type),
    changeType: change.changeType,
    identifier: change.identifier || change.after?.displayName || change.before?.displayName || change.key,
    statusBefore: change.statusBefore || change.before?.status || "",
    statusAfter: change.statusAfter || change.after?.status || "",
    changedFields: Array.isArray(change.changedFieldDetails)
      ? change.changedFieldDetails.map((detail) => `${detail.label}: ${detail.before} -> ${detail.after}`).join(" | ")
      : Array.isArray(change.recordDetails)
        ? change.recordDetails.map((detail) => `${detail.label}: ${detail.value}`).join(" | ")
      : Array.isArray(change.changedFields)
        ? change.changedFields.join(", ")
        : "",
    sourceBefore: change.before?.sourceFile || "",
    sourceAfter: change.after?.sourceFile || "",
  }));
}

export function generateWorkbookExport(csvFiles = [], options = {}, dataByType = {}, diffReport = null, exportConfig = {}) {
  if (!Array.isArray(csvFiles) || csvFiles.length === 0) {
    return null;
  }

  const resolved = {
    ...DEFAULT_EXPORT_OPTIONS,
    ...options,
  };

  const exportChangesOnly = Boolean(exportConfig?.changesOnly && diffReport?.hasBaseline);

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();

  if (!exportChangesOnly && resolved.includeSummary) {
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

  if (!exportChangesOnly) {
    for (const file of csvFiles) {
      const baseHeaders = Array.isArray(file.headers) ? file.headers : [];
      const rows = Array.isArray(file.rows) ? file.rows : [];
      const sanitizedRows = toSanitizedRows(rows, baseHeaders);
      const withStatusFlags = appendRawStatusFlagColumn(baseHeaders, sanitizedRows);

      const sheet = XLSX.utils.json_to_sheet(withStatusFlags.rows, {
        header: withStatusFlags.headers,
      });

      applySheetOptions(sheet, withStatusFlags.headers, withStatusFlags.rows);
      applyStatusCellStyles(sheet, withStatusFlags.headers, withStatusFlags.rows);

      const rawBaseName = resolveRawSheetBaseName(file, resolved.sheetNameMode);
      const baseName = sanitizeSheetName(rawBaseName, "Import");
      const sheetName = uniqueSheetName(baseName, usedNames);
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    }
  }

  if (!exportChangesOnly && resolved.includeNormalized) {
    const orderedTypes = [CSV_TYPES.DEVICES, CSV_TYPES.ADMINS, CSV_TYPES.USERS, CSV_TYPES.GENERIC];

    for (const type of orderedTypes) {
      const records = Array.isArray(dataByType[type]) ? dataByType[type] : [];
      if (records.length === 0) {
        continue;
      }

      const baseNormalizedRows = records.map((record) => toPlainRow(record));
      const baseNormalizedHeaders = buildHeaderOrder(baseNormalizedRows);
      const withStatusFlags = appendNormalizedStatusFlagColumn(baseNormalizedHeaders, baseNormalizedRows);

      const normalizedSheet = XLSX.utils.json_to_sheet(withStatusFlags.rows, {
        header: withStatusFlags.headers,
      });

      applySheetOptions(normalizedSheet, withStatusFlags.headers, withStatusFlags.rows);
      applyStatusCellStyles(normalizedSheet, withStatusFlags.headers, withStatusFlags.rows);

      const normalizedName = uniqueSheetName(
        sanitizeSheetName(`${getTypeLabel(type)} Normalized`, `${type} Normalized`),
        usedNames
      );
      XLSX.utils.book_append_sheet(workbook, normalizedSheet, normalizedName);
    }
  }

  if (diffReport?.hasBaseline) {
    const summaryRows = toDeltaSummaryRows(diffReport);
    const summaryHeaders = ["scope", "added", "removed", "modified", "statusChanged"];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { header: summaryHeaders });
    applySheetOptions(summarySheet, summaryHeaders, summaryRows);
    const deltaSummaryName = uniqueSheetName("Delta Summary", usedNames);
    XLSX.utils.book_append_sheet(workbook, summarySheet, deltaSummaryName);

    const changeRows = toDeltaChangeRows(diffReport);
    if (changeRows.length > 0) {
      const changeHeaders = [
        "type",
        "changeType",
        "identifier",
        "statusBefore",
        "statusAfter",
        "changedFields",
        "sourceBefore",
        "sourceAfter",
      ];
      const changeSheet = XLSX.utils.json_to_sheet(changeRows, { header: changeHeaders });
      applySheetOptions(changeSheet, changeHeaders, changeRows);
      const deltaChangesName = uniqueSheetName("Delta Changes", usedNames);
      XLSX.utils.book_append_sheet(workbook, changeSheet, deltaChangesName);
    }
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const prefix = String(resolved.filePrefix || DEFAULT_EXPORT_OPTIONS.filePrefix)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || DEFAULT_EXPORT_OPTIONS.filePrefix;

  const fileName = `${prefix}_${stamp}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return {
    fileName,
    sheetCount: workbook.SheetNames.length,
  };
}
