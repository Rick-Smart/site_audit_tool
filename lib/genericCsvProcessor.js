import { detectCsvType, CSV_TYPES } from "./csvTypeDetection";

export function buildGenericInventory(filename, rowsData, detectedType) {
  const normalizedRows = rowsData.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[String(key).trim()] = value;
    }
    return normalized;
  });

  const records = normalizedRows.map((row, index) => {
    const displayName =
      row.hostname || row.username || row.name || row.email || row.id || `record-${index + 1}`;

    return {
      id: `${filename}-${index + 1}`,
      sourceFile: filename,
      rowIndex: index + 1,
      displayName,
      type: detectedType,
      raw: row,
    };
  });

  const allColumns = Array.from(
    new Set(normalizedRows.flatMap((row) => Object.keys(row).map((key) => key.trim())))
  );

  return {
    columns: allColumns,
    records,
  };
}

export function buildCsvSummary(filename, rowsData, detectedType) {
  const rows = rowsData.length;
  const allColumns = Array.from(
    new Set(rowsData.flatMap((row) => Object.keys(row).map((key) => key.trim())))
  );

  const columns = allColumns.length;
  const totalCells = Math.max(rows * Math.max(columns, 1), 1);
  let nullCells = 0;

  for (const row of rowsData) {
    for (const col of allColumns) {
      const value = row[col];
      if (value === null || value === undefined || String(value).trim() === "") {
        nullCells += 1;
      }
    }
  }

  return {
    filename,
    rows,
    columns,
    type: detectedType,
    nullRatioPct: Number(((nullCells / totalCells) * 100).toFixed(2)),
  };
}
