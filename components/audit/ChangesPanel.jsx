import Panel from "../ui/Panel";

const CHANGE_FILTER_OPTIONS = [
  { value: "all", label: "All Changes" },
  { value: "added", label: "Added Only" },
  { value: "removed", label: "Removed Only" },
  { value: "modified", label: "Modified Only" },
  { value: "status-changed", label: "Status Changes Only" },
];

const EXPORT_SCOPE_OPTIONS = [
  { value: "full", label: "Full Report/Workbook" },
  { value: "changes-only", label: "Changes Only" },
];

function getChangeBadgeClass(changeType) {
  if (changeType === "added") {
    return "status-pill status-healthy";
  }
  if (changeType === "removed") {
    return "status-pill status-unhealthy";
  }
  if (changeType === "status-changed") {
    return "status-pill status-dormant";
  }
  return "status-pill status-unknown";
}

function getChangeLabel(changeType) {
  if (changeType === "status-changed") {
    return "Status Changed";
  }
  return String(changeType || "modified").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatChangedDetails(change) {
  if (!Array.isArray(change.changedFieldDetails) || change.changedFieldDetails.length === 0) {
    return null;
  }

  return change.changedFieldDetails;
}

function formatRecordDetails(change) {
  if (!Array.isArray(change.recordDetails) || change.recordDetails.length === 0) {
    return null;
  }

  return change.recordDetails;
}

export default function ChangesPanel({ diffReport, diffExportOptions, onDiffOptionChange }) {
  if (!diffReport?.hasBaseline) {
    return null;
  }

  const topChanges = diffReport.changes.slice(0, 200);

  return (
    <Panel title="Change Summary" count={diffReport.changes.length} revealClass="reveal delayed-3">
      <p className="inventory-meta">
        Baseline records: {diffReport.baselineTotal.toLocaleString()} | Current records: {diffReport.currentTotal.toLocaleString()}
      </p>

      <div className="change-controls-grid">
        <label className="control-group">
          <span>Visible Change Set</span>
          <select
            value={diffExportOptions?.changeTypeFilter || "all"}
            onChange={(event) => onDiffOptionChange?.("changeTypeFilter", event.target.value)}
          >
            {CHANGE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="control-group">
          <span>Export Scope</span>
          <select
            value={diffExportOptions?.exportScope || "full"}
            onChange={(event) => onDiffOptionChange?.("exportScope", event.target.value)}
          >
            {EXPORT_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="inventory-meta change-controls-note">
        These settings apply to the table below and to both PDF and XLSX exports while a baseline is loaded.
      </p>

      <div className="change-stats-grid">
        <article className="stat-card">
          <p>Added</p>
          <strong>{diffReport.totals.added.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <p>Removed</p>
          <strong>{diffReport.totals.removed.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <p>Modified</p>
          <strong>{diffReport.totals.modified.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <p>Status Changes</p>
          <strong>{diffReport.totals.statusChanged.toLocaleString()}</strong>
        </article>
      </div>

      {diffReport.statusTransitions.length > 0 && (
        <div className="inventory-meta">
          Top status transitions: {diffReport.statusTransitions.slice(0, 4).map((item) => `${item.transition} (${item.count})`).join(", ")}
        </div>
      )}

      <div className="table-wrap inventory-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Change</th>
              <th>Identifier</th>
              <th>Status</th>
              <th>Fields Changed</th>
            </tr>
          </thead>
          <tbody>
            {topChanges.map((change) => {
              const identifier = change.identifier || change.after?.displayName || change.before?.displayName || change.key;

              const statusText =
                change.changeType === "status-changed"
                  ? `${change.statusBefore || "unknown"} -> ${change.statusAfter || "unknown"}`
                  : change.changeType === "removed"
                    ? `${change.before?.status || "n/a"} -> removed`
                    : change.changeType === "added"
                      ? `added -> ${change.after?.status || "n/a"}`
                      : change.after?.status || change.before?.status || "n/a";

              return (
                <tr key={`${change.changeType}-${change.key}`}>
                  <td>{change.typeLabel}</td>
                  <td>
                    <span className={getChangeBadgeClass(change.changeType)}>{getChangeLabel(change.changeType)}</span>
                  </td>
                  <td>{identifier}</td>
                  <td>{statusText}</td>
                  <td>
                    {formatChangedDetails(change) ? (
                      <div className="change-detail-list">
                        {formatChangedDetails(change).map((detail) => (
                          <div key={`${change.key}-${detail.key}`} className="change-detail-item">
                            <strong>{detail.label}:</strong> {detail.before} -&gt; {detail.after}
                          </div>
                        ))}
                      </div>
                    ) : formatRecordDetails(change) ? (
                      <div className="change-detail-list">
                        {formatRecordDetails(change).map((detail) => (
                          <div key={`${change.key}-${detail.label}`} className="change-detail-item">
                            <strong>{detail.label}:</strong> {detail.value}
                          </div>
                        ))}
                      </div>
                    ) : (
                      "n/a"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
