export const STATUS_COLUMN_CANDIDATES = ["status", "state", "health", "online", "connection"];
export const SITE_COLUMN_CANDIDATES = ["site", "network", "location", "branch", "office", "name"];
const HOSTNAME_COLUMN_CANDIDATES = ["hostname", "host", "device name", "name", "client", "switch", "ap"];
const IP_COLUMN_CANDIDATES = ["ip", "ip address", "lan ip", "wan ip", "address", "ipv4"];
const MAC_COLUMN_CANDIDATES = ["mac", "mac address", "client mac"];
const SERIAL_COLUMN_CANDIDATES = ["serial", "serial number", "sn"];
const MODEL_COLUMN_CANDIDATES = ["model", "product", "device model"];
const VENDOR_COLUMN_CANDIDATES = ["vendor", "manufacturer", "make"];
const ROLE_COLUMN_CANDIDATES = ["role", "type", "device type", "category"];

const HEALTHY_TOKENS = new Set(["online", "up", "healthy", "ok", "connected", "active", "true", "1"]);
const UNHEALTHY_TOKENS = new Set(["offline", "down", "unhealthy", "critical", "error", "disconnected", "false", "0"]);
const DORMANT_TOKENS = new Set(["dormant", "idle", "standby", "sleep", "sleeping", "inactive"]);

export function pickColumn(columns, candidates) {
  const lowerMap = new Map();

  for (const col of columns) {
    lowerMap.set(col.toLowerCase(), col);
  }

  for (const candidate of candidates) {
    const exact = lowerMap.get(candidate);
    if (exact) {
      return exact;
    }
  }

  for (const col of columns) {
    const colLower = col.toLowerCase();
    if (candidates.some((candidate) => colLower.includes(candidate))) {
      return col;
    }
  }

  return null;
}

export function summarizeCsv(filename, rowsData) {
  const rows = rowsData.length;
  const allColumns = Array.from(
    new Set(rowsData.flatMap((row) => Object.keys(row).map((key) => key.trim())))
  );

  const normalizedRows = rowsData.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim()] = value;
    }
    return normalized;
  });

  const columns = allColumns.length;
  const totalCells = Math.max(rows * Math.max(columns, 1), 1);
  let nullCells = 0;

  for (const row of normalizedRows) {
    for (const col of allColumns) {
      const value = row[col];
      if (value === null || value === undefined || String(value).trim() === "") {
        nullCells += 1;
      }
    }
  }

  const siteCol = pickColumn(allColumns, SITE_COLUMN_CANDIDATES);
  const statusCol = pickColumn(allColumns, STATUS_COLUMN_CANDIDATES);

  const sites = new Set();
  if (siteCol) {
    for (const row of normalizedRows) {
      const value = row[siteCol];
      if (value !== null && value !== undefined) {
        const trimmed = String(value).trim();
        if (trimmed) {
          sites.add(trimmed);
        }
      }
    }
  }

  let healthyCount = null;
  let unhealthyCount = null;

  if (statusCol) {
    healthyCount = 0;
    unhealthyCount = 0;

    for (const row of normalizedRows) {
      const status = String(row[statusCol] ?? "").trim().toLowerCase();
      if (HEALTHY_TOKENS.has(status)) {
        healthyCount += 1;
      }
      if (UNHEALTHY_TOKENS.has(status) || DORMANT_TOKENS.has(status)) {
        unhealthyCount += 1;
      }
    }
  }

  return {
    filename,
    rows,
    columns,
    nullRatioPct: Number(((nullCells / totalCells) * 100).toFixed(2)),
    siteColumn: siteCol,
    uniqueSites: Array.from(sites).sort().slice(0, 30),
    statusColumn: statusCol,
    healthyCount,
    unhealthyCount,
  };
}

export function buildFindings(summaries) {
  const findings = [];

  const totalRows = summaries.reduce((sum, item) => sum + item.rows, 0);
  findings.push(`Analyzed ${summaries.length} CSV file(s) totaling ${totalRows.toLocaleString()} rows.`);

  const highNull = summaries.filter((summary) => summary.nullRatioPct >= 20);
  if (highNull.length > 0) {
    findings.push(
      `Data quality warning: high null density (>=20%) in ${highNull.map((item) => item.filename).join(", ")}.`
    );
  }

  const unhealthy = summaries
    .filter((summary) => summary.uniqueSites !== undefined && (summary.unhealthyCount ?? 0) > 0)
    .sort((a, b) => (b.unhealthyCount ?? 0) - (a.unhealthyCount ?? 0));

  if (unhealthy.length > 0) {
    findings.push(
      `Operational risk: ${unhealthy[0].filename} reports ${unhealthy[0].unhealthyCount} unhealthy/down records.`
    );
  } else {
    findings.push("No explicit unhealthy/down records detected from status-like columns.");
  }

  const sites = new Set();
  // Filter to device summaries only (they have uniqueSites property)
  const deviceSummaries = summaries.filter((s) => s.uniqueSites !== undefined);
  for (const summary of deviceSummaries) {
    for (const site of summary.uniqueSites) {
      sites.add(site);
    }
  }

  if (sites.size > 0) {
    findings.push(`Detected site/network labels include: ${Array.from(sites).sort().slice(0, 8).join(", ")}.`);
  }

  return findings;
}

function normalizeColumns(rowsData) {
  return rowsData.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[String(key).trim()] = value;
    }
    return normalized;
  });
}

function asText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

export function normalizeStatus(statusValue) {
  const status = asText(statusValue).toLowerCase();
  if (!status) {
    return { label: "unknown", tone: "unknown" };
  }
  if (HEALTHY_TOKENS.has(status)) {
    return { label: status, tone: "healthy" };
  }
  if (DORMANT_TOKENS.has(status)) {
    return { label: status, tone: "dormant" };
  }
  if (UNHEALTHY_TOKENS.has(status)) {
    return { label: status, tone: "unhealthy" };
  }
  return { label: status, tone: "unknown" };
}

export function buildMachineInventory(filename, rowsData) {
  const normalizedRows = normalizeColumns(rowsData);
  const allColumns = Array.from(
    new Set(normalizedRows.flatMap((row) => Object.keys(row).map((key) => key.trim())))
  );

  const columnMap = {
    hostname: pickColumn(allColumns, HOSTNAME_COLUMN_CANDIDATES),
    ip: pickColumn(allColumns, IP_COLUMN_CANDIDATES),
    mac: pickColumn(allColumns, MAC_COLUMN_CANDIDATES),
    serial: pickColumn(allColumns, SERIAL_COLUMN_CANDIDATES),
    model: pickColumn(allColumns, MODEL_COLUMN_CANDIDATES),
    vendor: pickColumn(allColumns, VENDOR_COLUMN_CANDIDATES),
    role: pickColumn(allColumns, ROLE_COLUMN_CANDIDATES),
    site: pickColumn(allColumns, SITE_COLUMN_CANDIDATES),
    status: pickColumn(allColumns, STATUS_COLUMN_CANDIDATES),
  };

  const records = normalizedRows.map((row, index) => {
    const hostname = columnMap.hostname ? asText(row[columnMap.hostname]) : "";
    const ip = columnMap.ip ? asText(row[columnMap.ip]) : "";
    const mac = columnMap.mac ? asText(row[columnMap.mac]) : "";
    const serial = columnMap.serial ? asText(row[columnMap.serial]) : "";
    const model = columnMap.model ? asText(row[columnMap.model]) : "";
    const vendor = columnMap.vendor ? asText(row[columnMap.vendor]) : "";
    const role = columnMap.role ? asText(row[columnMap.role]) : "";
    const site = columnMap.site ? asText(row[columnMap.site]) : "";
    const statusRaw = columnMap.status ? asText(row[columnMap.status]) : "";
    const status = normalizeStatus(statusRaw);

    const displayName = hostname || serial || mac || ip || `record-${index + 1}`;

    return {
      id: `${filename}-${index + 1}`,
      sourceFile: filename,
      rowIndex: index + 1,
      displayName,
      hostname,
      ip,
      mac,
      serial,
      model,
      vendor,
      role,
      site,
      status: status.label,
      statusTone: status.tone,
      raw: row,
    };
  });

  return {
    columns: allColumns,
    columnMap,
    records,
  };
}
