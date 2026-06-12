import { summarizeCsv, buildMachineInventory } from "./audit";
import { buildCsvSummary, buildGenericInventory } from "./genericCsvProcessor";
import { parseCsvText, readTextFile } from "./fileReaders";
import { CSV_TYPES, detectCsvType } from "./csvTypeDetection";

export async function ingestCsvFiles(files, seed = {}) {
  const nextDataByType = { ...(seed.dataByType || {}) };
  const nextCsvFiles = [...(seed.csvFiles || [])];
  const nextSummaries = [...(seed.summaries || [])];
  const nextErrors = [...(seed.errors || [])];

  for (const file of files) {
    try {
      const text = await readTextFile(file);
      const rows = await parseCsvText(text);

      if (rows.length === 0) {
        nextErrors.push({
          file: file.name,
          message: "CSV file is empty",
        });
        continue;
      }

      const columns = Object.keys(rows[0]);
      const detectedType = detectCsvType(columns, file.name);

      nextCsvFiles.push({
        fileName: file.name,
        detectedType,
        headers: columns,
        rows,
      });

      if (detectedType === CSV_TYPES.DEVICES) {
        const summary = summarizeCsv(file.name, rows);
        const inventory = buildMachineInventory(file.name, rows);
        nextSummaries.push(summary);

        if (!nextDataByType[CSV_TYPES.DEVICES]) {
          nextDataByType[CSV_TYPES.DEVICES] = [];
        }
        nextDataByType[CSV_TYPES.DEVICES].push(...inventory.records);
      } else {
        const summary = buildCsvSummary(file.name, rows, detectedType);
        const inventory = buildGenericInventory(file.name, rows, detectedType);
        nextSummaries.push(summary);

        if (!nextDataByType[detectedType]) {
          nextDataByType[detectedType] = [];
        }
        nextDataByType[detectedType].push(...inventory.records);
      }
    } catch (error) {
      nextErrors.push({
        file: file.name,
        message: error instanceof Error ? error.message : "Unknown parse failure",
      });
    }
  }

  return {
    dataByType: nextDataByType,
    csvFiles: nextCsvFiles,
    summaries: nextSummaries,
    errors: nextErrors,
  };
}
