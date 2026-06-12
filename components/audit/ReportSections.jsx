import CsvSummaryPanel from "./CsvSummaryPanel";
import DynamicInventoryPanel from "./DynamicInventoryPanel";
import FindingsPanel from "./FindingsPanel";
import MachineInventoryPanel from "./MachineInventoryPanel";
import PdfExportFieldsPanel from "./PdfExportFieldsPanel";
import TopologyPanel from "./TopologyPanel";
import WarningsPanel from "./WarningsPanel";
import { CSV_TYPES, getTypeLabel } from "../../lib/csvTypeDetection";

export default function ReportSections({
  errors,
  findings,
  summaries,
  machineInventory,
  filteredInventory,
  fileOptions,
  fileFilter,
  onFileFilterChange,
  hasSiteData,
  siteOptions,
  siteFilter,
  onSiteFilterChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  activeMachineId,
  onActiveMachineChange,
  activeMachine,
  selectedExportFieldsByType = {},
  exportFieldOptionsByType = {},
  onToggleField = () => {},
  dataByType = {},
  topologies,
}) {
  const nonDeviceTypes = [CSV_TYPES.ADMINS, CSV_TYPES.USERS, CSV_TYPES.GENERIC];

  return (
    <>
      <WarningsPanel errors={errors} />
      <FindingsPanel findings={findings} />
      <CsvSummaryPanel summaries={summaries} />
      <MachineInventoryPanel
        machineInventory={machineInventory}
        filteredInventory={filteredInventory}
        fileOptions={fileOptions}
        fileFilter={fileFilter}
        onFileFilterChange={onFileFilterChange}
        hasSiteData={hasSiteData}
        siteOptions={siteOptions}
        siteFilter={siteFilter}
        onSiteFilterChange={onSiteFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        activeMachineId={activeMachineId}
        onActiveMachineChange={onActiveMachineChange}
        activeMachine={activeMachine}
      />
      <PdfExportFieldsPanel
        title="Device PDF Export Fields"
        machineInventory={machineInventory}
        selectedExportFields={selectedExportFieldsByType[CSV_TYPES.DEVICES] || []}
        exportFieldOptions={exportFieldOptionsByType[CSV_TYPES.DEVICES] || []}
        onToggleField={(key) => onToggleField(CSV_TYPES.DEVICES, key)}
      />

      {nonDeviceTypes.map((type) => (
        <div key={type}>
          <DynamicInventoryPanel type={type} records={dataByType[type] || []} />
          <PdfExportFieldsPanel
            title={`${getTypeLabel(type)} PDF Export Fields`}
            machineInventory={dataByType[type] || []}
            selectedExportFields={selectedExportFieldsByType[type] || []}
            exportFieldOptions={exportFieldOptionsByType[type] || []}
            onToggleField={(key) => onToggleField(type, key)}
          />
        </div>
      ))}
      <TopologyPanel topologies={topologies} />
    </>
  );
}
