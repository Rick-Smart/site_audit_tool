export default function PdfExportFieldList({ exportFieldOptions, selectedExportFields, onToggleField }) {
  return (
    <div className="field-picker-grid">
      {exportFieldOptions.map((field) => (
        <label key={field.key} className="field-toggle">
          <input
            type="checkbox"
            checked={selectedExportFields.includes(field.key)}
            onChange={() => onToggleField(field.key)}
          />
          <span>{field.label}</span>
        </label>
      ))}
    </div>
  );
}