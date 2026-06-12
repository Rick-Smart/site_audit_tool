import Panel from "../ui/Panel";

const SHEET_NAME_OPTIONS = [
  { value: "filename", label: "Source Filename" },
  { value: "type-filename", label: "Type + Filename" },
];

export default function XlsxExportOptionsPanel({ visible, options, onOptionChange, onPreset }) {
  if (!visible) {
    return null;
  }

  return (
    <Panel title="XLSX Export Options" revealClass="reveal delayed-2">
      <div className="xlsx-presets-row">
        <button
          type="button"
          className="xlsx-preset-btn"
          onClick={() => onPreset("RAW_ONLY")}
        >
          Raw Only Preset
        </button>
        <button
          type="button"
          className="xlsx-preset-btn"
          onClick={() => onPreset("FULL_WORKBOOK")}
        >
          Full Workbook Preset
        </button>
      </div>

      <div className="xlsx-options-grid">
        <label className="field-toggle">
          <input
            type="checkbox"
            checked={Boolean(options.includeSummary)}
            onChange={(event) => onOptionChange("includeSummary", event.target.checked)}
          />
          Include Summary Sheet
        </label>

        <label className="field-toggle">
          <input
            type="checkbox"
            checked={Boolean(options.includeNormalized)}
            onChange={(event) => onOptionChange("includeNormalized", event.target.checked)}
          />
          Include Normalized Sheets
        </label>

        <div className="control-group">
          <label htmlFor="xlsx-sheet-mode">Sheet Naming</label>
          <select
            id="xlsx-sheet-mode"
            value={options.sheetNameMode}
            onChange={(event) => onOptionChange("sheetNameMode", event.target.value)}
          >
            {SHEET_NAME_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="xlsx-file-prefix">Export Filename Prefix</label>
          <input
            id="xlsx-file-prefix"
            type="text"
            value={options.filePrefix}
            onChange={(event) => onOptionChange("filePrefix", event.target.value)}
            placeholder="site_audit_export"
          />
        </div>
      </div>
    </Panel>
  );
}
