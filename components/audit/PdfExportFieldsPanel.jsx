import Panel from "../ui/Panel";
import PdfExportFieldList from "./pdf/PdfExportFieldList";

export default function PdfExportFieldsPanel({
  title = "PDF Export Fields",
  machineInventory,
  selectedExportFields,
  exportFieldOptions,
  onToggleField,
}) {
  if (machineInventory.length === 0 || exportFieldOptions.length === 0) {
    return null;
  }

  return (
    <Panel title={title} count={selectedExportFields.length} revealClass="reveal delayed-4">
      <PdfExportFieldList
        exportFieldOptions={exportFieldOptions}
        selectedExportFields={selectedExportFields}
        onToggleField={onToggleField}
      />
      <p className="inventory-meta">
        Field list is generated dynamically from uploaded CSV columns. PDF export uses the selected fields for this
        section.
      </p>
    </Panel>
  );
}
