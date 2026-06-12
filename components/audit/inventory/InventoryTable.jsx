export default function InventoryTable({
  filteredInventory,
  hasSiteData,
  activeMachineId,
  onActiveMachineChange,
}) {
  return (
    <div className="table-wrap inventory-wrap">
      <table>
        <thead>
          <tr>
            <th>Device</th>
            {hasSiteData && <th>Site</th>}
            <th>Status</th>
            <th>IP</th>
            <th>MAC</th>
            <th>Model</th>
            <th>Role</th>
            <th>Serial</th>
            <th>CSV</th>
          </tr>
        </thead>
        <tbody>
          {filteredInventory.map((device) => (
            <tr
              key={device.id}
              className={device.id === activeMachineId ? "row-active" : ""}
              onClick={() => onActiveMachineChange(device.id)}
            >
              <td>{device.displayName}</td>
              {hasSiteData && <td>{device.site || "n/a"}</td>}
              <td>
                <span className={`status-pill status-${device.statusTone}`}>{device.status || "unknown"}</span>
              </td>
              <td>{device.ip || "n/a"}</td>
              <td>{device.mac || "n/a"}</td>
              <td>{device.model || "n/a"}</td>
              <td>{device.role || "n/a"}</td>
              <td>{device.serial || "n/a"}</td>
              <td>{device.sourceFile}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}