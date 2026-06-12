export default function InventoryFilters({
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
}) {
  return (
    <div className="inventory-toolbar">
      <div className="control-group">
        <label htmlFor="file-filter">File</label>
        <select id="file-filter" value={fileFilter} onChange={(event) => onFileFilterChange(event.target.value)}>
          {fileOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All files" : option}
            </option>
          ))}
        </select>
      </div>

      {hasSiteData && (
        <div className="control-group">
          <label htmlFor="site-filter">Site</label>
          <select id="site-filter" value={siteFilter} onChange={(event) => onSiteFilterChange(event.target.value)}>
            {siteOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All sites" : option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="control-group">
        <label htmlFor="status-filter">Status</label>
        <select id="status-filter" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          <option value="all">All status</option>
          <option value="healthy">Healthy</option>
          <option value="dormant">Dormant</option>
          <option value="unhealthy">Unhealthy</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="control-group control-search">
        <label htmlFor="inventory-search">Search</label>
        <input
          id="inventory-search"
          type="text"
          placeholder="hostname, ip, mac, serial, model..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  );
}