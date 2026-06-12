export const BASE_EXPORT_FIELDS = [
  { key: "displayName", label: "Device" },
  { key: "site", label: "Site" },
  { key: "status", label: "Status" },
  { key: "ip", label: "IP" },
  { key: "mac", label: "MAC" },
  { key: "serial", label: "Serial" },
  { key: "model", label: "Model" },
  { key: "vendor", label: "Vendor" },
  { key: "role", label: "Role" },
  { key: "sourceFile", label: "CSV" },
  { key: "rowIndex", label: "Row" },
];

export function toTitleCaseLabel(input) {
  return String(input)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildExportFieldOptions(machineInventory) {
  if (machineInventory.length === 0) {
    return [];
  }

  const baseOptions = BASE_EXPORT_FIELDS.filter((field) => {
    if (field.key === "sourceFile" || field.key === "rowIndex") {
      return true;
    }
    return machineInventory.some((item) => {
      const value = item[field.key];
      return value !== null && value !== undefined && String(value).trim() !== "";
    });
  });

  const rawColumnSet = new Set();
  for (const item of machineInventory) {
    if (!item.raw) {
      continue;
    }
    for (const key of Object.keys(item.raw)) {
      const trimmed = String(key).trim();
      if (trimmed) {
        rawColumnSet.add(trimmed);
      }
    }
  }

  const baseLabelsLower = new Set(baseOptions.map((field) => field.label.toLowerCase()));

  const rawOptions = Array.from(rawColumnSet)
    .sort((a, b) => a.localeCompare(b))
    .map((columnName) => ({
      key: `raw::${columnName}`,
      label: toTitleCaseLabel(columnName),
    }))
    .filter((option) => !baseLabelsLower.has(option.label.toLowerCase()));

  return [...baseOptions, ...rawOptions];
}

export function buildGenericExportFieldOptions(records) {
  if (!records || records.length === 0) {
    return [];
  }

  const baseOptions = [
    { key: "displayName", label: "Record" },
    { key: "sourceFile", label: "CSV" },
    { key: "rowIndex", label: "Row" },
  ];

  const rawColumnSet = new Set();
  for (const item of records) {
    if (!item.raw) {
      continue;
    }
    for (const key of Object.keys(item.raw)) {
      const trimmed = String(key).trim();
      if (trimmed) {
        rawColumnSet.add(trimmed);
      }
    }
  }

  const rawOptions = Array.from(rawColumnSet)
    .sort((a, b) => a.localeCompare(b))
    .map((columnName) => ({
      key: `raw::${columnName}`,
      label: toTitleCaseLabel(columnName),
    }));

  const labelSet = new Set(baseOptions.map((item) => item.label.toLowerCase()));
  const dedupedRaw = rawOptions.filter((item) => !labelSet.has(item.label.toLowerCase()));

  return [...baseOptions, ...dedupedRaw];
}
