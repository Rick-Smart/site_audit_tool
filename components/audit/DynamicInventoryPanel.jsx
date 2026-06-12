import { useMemo, useState } from "react";
import { getTypeLabel } from "../../lib/csvTypeDetection";
import Panel from "../ui/Panel";

function toTitleCaseLabel(input) {
  return String(input)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRecordValue(record, key) {
  if (key.startsWith("raw::")) {
    const rawKey = key.slice(5);
    const value = record.raw?.[rawKey];
    return value === null || value === undefined || String(value).trim() === "" ? "n/a" : String(value);
  }

  const value = record[key];
  return value === null || value === undefined || String(value).trim() === "" ? "n/a" : String(value);
}

export default function DynamicInventoryPanel({ type, records }) {
  const [activeId, setActiveId] = useState("");

  const columns = useMemo(() => {
    if (records.length === 0) {
      return [];
    }

    const preferredRaw = ["username", "name", "email", "department", "role", "status"];
    const keys = ["displayName", "sourceFile"];
    const rawKeys = Array.from(new Set(records.flatMap((record) => Object.keys(record.raw || {}))));

    for (const key of preferredRaw) {
      if (rawKeys.includes(key) && keys.length < 8) {
        keys.push(`raw::${key}`);
      }
    }

    for (const rawKey of rawKeys) {
      if (keys.length >= 8) {
        break;
      }
      const normalized = `raw::${rawKey}`;
      if (!keys.includes(normalized)) {
        keys.push(normalized);
      }
    }

    return keys;
  }, [records]);

  const activeRecord = useMemo(() => {
    if (records.length === 0) {
      return null;
    }
    return records.find((record) => record.id === activeId) || records[0];
  }, [records, activeId]);

  if (records.length === 0) {
    return null;
  }

  return (
    <Panel title={`${getTypeLabel(type)} Inventory`} count={records.length} revealClass="reveal delayed-4">
      <p className="inventory-meta">
        Dynamic view generated from uploaded {getTypeLabel(type).toLowerCase()} CSV files.
      </p>

      <div className="table-wrap inventory-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column.startsWith("raw::") ? toTitleCaseLabel(column.slice(5)) : toTitleCaseLabel(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className={record.id === activeRecord?.id ? "row-active" : ""}
                onClick={() => setActiveId(record.id)}
              >
                {columns.map((column) => (
                  <td key={`${record.id}-${column}`}>{getRecordValue(record, column)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeRecord && (
        <div className="machine-detail">
          <h3>Record Detail: {activeRecord.displayName || "Unknown"}</h3>
          <pre>{JSON.stringify(activeRecord.raw || {}, null, 2)}</pre>
        </div>
      )}
    </Panel>
  );
}