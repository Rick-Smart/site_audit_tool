import Panel from "../ui/Panel";
import InventoryDetail from "./inventory/InventoryDetail";
import InventoryFilters from "./inventory/InventoryFilters";
import InventoryTable from "./inventory/InventoryTable";

export default function MachineInventoryPanel({
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
}) {
  if (machineInventory.length === 0) {
    return null;
  }

  return (
    <Panel title="Machine Inventory" count={filteredInventory.length} revealClass="reveal delayed-4">
      <InventoryFilters
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
      />

      <p className="inventory-meta">
        Showing {filteredInventory.length.toLocaleString()} of {machineInventory.length.toLocaleString()} records
      </p>

      <InventoryTable
        filteredInventory={filteredInventory}
        hasSiteData={hasSiteData}
        activeMachineId={activeMachineId}
        onActiveMachineChange={onActiveMachineChange}
      />

      <InventoryDetail activeMachine={activeMachine} />
    </Panel>
  );
}
