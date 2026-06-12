import { CSV_TYPES, getTypeLabel } from "./csvTypeDetection";

const DIFF_TYPES = [CSV_TYPES.DEVICES, CSV_TYPES.ADMINS, CSV_TYPES.USERS, CSV_TYPES.GENERIC];

function asText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function formatFieldLabel(key) {
  return String(key || "")
    .replace(/^raw::/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toDisplayValue(value) {
  return asText(value) === "" ? "empty" : asText(value);
}

function isGenericRecordLabel(value) {
  return /^record-\d+$/i.test(asText(value));
}

function makeRawLookup(raw = {}) {
  const lookup = new Map();
  for (const [key, value] of Object.entries(raw || {})) {
    lookup.set(key.toLowerCase().trim(), asText(value));
  }
  return lookup;
}

function buildStableKey(type, record) {
  const rawLookup = makeRawLookup(record.raw || {});
  const candidates = [
    record.serial,
    record.mac,
    record.hostname,
    record.ip,
    rawLookup.get("email"),
    rawLookup.get("email address"),
    rawLookup.get("username"),
    rawLookup.get("name"),
    rawLookup.get("device"),
    rawLookup.get("id"),
    record.displayName,
  ];

  const value = candidates.find((item) => asText(item) !== "") || `${type}-${record.sourceFile || "source"}-${record.rowIndex || "row"}`;
  return `${type}::${String(value).toLowerCase()}`;
}

function toComparableRecord(record) {
  const base = {};

  for (const [key, value] of Object.entries(record || {})) {
    if (["id", "rowIndex", "raw"].includes(key)) {
      continue;
    }

    if (value && typeof value === "object") {
      continue;
    }

    base[key] = asText(value);
  }

  for (const [rawKey, rawValue] of Object.entries(record.raw || {})) {
    base[`raw::${rawKey}`] = asText(rawValue);
  }

  return base;
}

function findChangedFields(beforeComparable, afterComparable) {
  const allKeys = new Set([...Object.keys(beforeComparable), ...Object.keys(afterComparable)]);
  const changed = [];

  for (const key of allKeys) {
    const before = beforeComparable[key] || "";
    const after = afterComparable[key] || "";
    if (before !== after) {
      changed.push(key);
    }
  }

  return changed;
}

function buildChangedFieldDetails(changedFields, beforeComparable, afterComparable) {
  return changedFields.map((key) => ({
    key,
    label: formatFieldLabel(key),
    before: toDisplayValue(beforeComparable[key]),
    after: toDisplayValue(afterComparable[key]),
  }));
}

function buildChangeIdentifier(record, fallbackKey) {
  if (!record) {
    return fallbackKey;
  }

  const rawLookup = makeRawLookup(record.raw || {});
  const candidates = [
    !isGenericRecordLabel(record.displayName) ? record.displayName : "",
    record.hostname,
    record.serial,
    record.mac,
    record.ip,
    rawLookup.get("email"),
    rawLookup.get("email address"),
    rawLookup.get("username"),
    rawLookup.get("name"),
    rawLookup.get("id"),
    record.displayName,
  ];

  return candidates.find((value) => asText(value) !== "") || fallbackKey;
}

function buildRecordDetails(record) {
  if (!record) {
    return [];
  }

  const details = [];
  const seen = new Set();
  const rawLookup = makeRawLookup(record.raw || {});
  const orderedFields = [
    ["Display Name", !isGenericRecordLabel(record.displayName) ? record.displayName : ""],
    ["Hostname", record.hostname],
    ["Username", rawLookup.get("username")],
    ["Name", rawLookup.get("name")],
    ["Email", rawLookup.get("email") || rawLookup.get("email address")],
    ["Serial", record.serial],
    ["IP", record.ip],
    ["MAC", record.mac],
    ["Role", record.role],
    ["Site", record.site],
    ["Scope", rawLookup.get("scope")],
    ["Status", record.status],
    ["Source File", record.sourceFile],
  ];

  for (const [label, value] of orderedFields) {
    const text = asText(value);
    if (!text) {
      continue;
    }

    const dedupeKey = `${label.toLowerCase()}::${text.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    details.push({
      label,
      value: text,
    });
  }

  return details;
}

function toMap(records = [], type) {
  const next = new Map();

  for (const record of records) {
    const key = buildStableKey(type, record);
    next.set(key, record);
  }

  return next;
}

function emptyTypeBucket() {
  return {
    added: 0,
    removed: 0,
    modified: 0,
    statusChanged: 0,
  };
}

export function buildDiffReport(currentByType = {}, baselineByType = {}) {
  const baselineTotal = DIFF_TYPES.reduce((sum, type) => sum + (baselineByType[type]?.length || 0), 0);
  const currentTotal = DIFF_TYPES.reduce((sum, type) => sum + (currentByType[type]?.length || 0), 0);

  const byType = {};
  const changes = [];
  const statusTransitionCounts = new Map();

  for (const type of DIFF_TYPES) {
    byType[type] = emptyTypeBucket();

    const currentRecords = currentByType[type] || [];
    const baselineRecords = baselineByType[type] || [];

    const currentMap = toMap(currentRecords, type);
    const baselineMap = toMap(baselineRecords, type);

    for (const [key, after] of currentMap.entries()) {
      if (!baselineMap.has(key)) {
        byType[type].added += 1;
        changes.push({
          type,
          typeLabel: getTypeLabel(type),
          changeType: "added",
          key,
          identifier: buildChangeIdentifier(after, key),
          before: null,
          after,
          changedFields: [],
          changedFieldDetails: [],
          recordDetails: buildRecordDetails(after),
        });
      }
    }

    for (const [key, before] of baselineMap.entries()) {
      if (!currentMap.has(key)) {
        byType[type].removed += 1;
        changes.push({
          type,
          typeLabel: getTypeLabel(type),
          changeType: "removed",
          key,
          identifier: buildChangeIdentifier(before, key),
          before,
          after: null,
          changedFields: [],
          changedFieldDetails: [],
          recordDetails: buildRecordDetails(before),
        });
      }
    }

    for (const [key, after] of currentMap.entries()) {
      const before = baselineMap.get(key);
      if (!before) {
        continue;
      }

      const beforeComparable = toComparableRecord(before);
      const afterComparable = toComparableRecord(after);
      const changedFields = findChangedFields(beforeComparable, afterComparable);
      const changedFieldDetails = buildChangedFieldDetails(changedFields, beforeComparable, afterComparable);

      if (changedFields.length === 0) {
        continue;
      }

      const statusBefore = asText(before.status || before.statusTone || "unknown").toLowerCase() || "unknown";
      const statusAfter = asText(after.status || after.statusTone || "unknown").toLowerCase() || "unknown";
      const statusChanged = statusBefore !== statusAfter;
      const changeType = statusChanged ? "status-changed" : "modified";

      if (statusChanged) {
        byType[type].statusChanged += 1;
        const transitionKey = `${statusBefore} -> ${statusAfter}`;
        statusTransitionCounts.set(transitionKey, (statusTransitionCounts.get(transitionKey) || 0) + 1);
      } else {
        byType[type].modified += 1;
      }

      changes.push({
        type,
        typeLabel: getTypeLabel(type),
        changeType,
        key,
        identifier: buildChangeIdentifier(after, key),
        before,
        after,
        changedFields,
        changedFieldDetails,
        recordDetails: buildRecordDetails(after),
        statusBefore,
        statusAfter,
      });
    }
  }

  const totals = Object.values(byType).reduce(
    (sum, bucket) => ({
      added: sum.added + bucket.added,
      removed: sum.removed + bucket.removed,
      modified: sum.modified + bucket.modified,
      statusChanged: sum.statusChanged + bucket.statusChanged,
    }),
    { added: 0, removed: 0, modified: 0, statusChanged: 0 }
  );

  const statusTransitions = Array.from(statusTransitionCounts.entries())
    .map(([transition, count]) => ({ transition, count }))
    .sort((a, b) => b.count - a.count);

  return {
    hasBaseline: baselineTotal > 0,
    baselineTotal,
    currentTotal,
    totals,
    byType,
    statusTransitions,
    changes,
  };
}

function createEmptyBucketMap() {
  return {
    [CSV_TYPES.DEVICES]: emptyTypeBucket(),
    [CSV_TYPES.ADMINS]: emptyTypeBucket(),
    [CSV_TYPES.USERS]: emptyTypeBucket(),
    [CSV_TYPES.GENERIC]: emptyTypeBucket(),
  };
}

function incrementBucket(bucket, change) {
  if (change.changeType === "added") {
    bucket.added += 1;
    return;
  }
  if (change.changeType === "removed") {
    bucket.removed += 1;
    return;
  }
  if (change.changeType === "status-changed") {
    bucket.statusChanged += 1;
    return;
  }
  bucket.modified += 1;
}

export function filterDiffReport(diffReport, changeTypeFilter = "all") {
  if (!diffReport?.hasBaseline || changeTypeFilter === "all") {
    return diffReport;
  }

  const filteredChanges = (diffReport.changes || []).filter((change) => change.changeType === changeTypeFilter);
  const byType = createEmptyBucketMap();
  const statusTransitionCounts = new Map();

  for (const change of filteredChanges) {
    if (!byType[change.type]) {
      byType[change.type] = emptyTypeBucket();
    }

    incrementBucket(byType[change.type], change);

    if (change.changeType === "status-changed") {
      const transitionKey = `${change.statusBefore || "unknown"} -> ${change.statusAfter || "unknown"}`;
      statusTransitionCounts.set(transitionKey, (statusTransitionCounts.get(transitionKey) || 0) + 1);
    }
  }

  const totals = Object.values(byType).reduce(
    (sum, bucket) => ({
      added: sum.added + bucket.added,
      removed: sum.removed + bucket.removed,
      modified: sum.modified + bucket.modified,
      statusChanged: sum.statusChanged + bucket.statusChanged,
    }),
    { added: 0, removed: 0, modified: 0, statusChanged: 0 }
  );

  const statusTransitions = Array.from(statusTransitionCounts.entries())
    .map(([transition, count]) => ({ transition, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ...diffReport,
    totals,
    byType,
    statusTransitions,
    changes: filteredChanges,
  };
}
