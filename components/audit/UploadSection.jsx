import UploadCard from "../ui/UploadCard";
import PrimaryButton from "../ui/PrimaryButton";

export default function UploadSection({ stats, onCsvChange, onPngChange, onClearData }) {
  return (
    <section className="upload-grid reveal delayed-2">
      <UploadCard
        id="csv-input"
        title="CSV Exports"
        subtitle="Meraki/firewall/switch/admin/user datasets"
        triggerText="Select CSV Files"
        metaText={stats.files > 0 ? `${stats.files} loaded` : "No files selected"}
        accept=".csv,text/csv"
        onChange={onCsvChange}
      />

      <UploadCard
        id="png-input"
        title="Topology PNGs"
        subtitle="Optional topology visuals for report context"
        triggerText="Select PNG Files"
        metaText={stats.topologyCount > 0 ? `${stats.topologyCount} loaded` : "No files selected"}
        accept=".png,image/png"
        onChange={onPngChange}
      />

      {stats.files > 0 && (
        <div className="upload-card" style={{ gridColumn: "span 2", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem" }}>
          <div>
            <p className="upload-title" style={{ margin: 0 }}>Clear Data</p>
            <p className="upload-subtitle" style={{ margin: "0.25rem 0 0" }}>Remove all uploaded files and start fresh</p>
          </div>
          <PrimaryButton onClick={onClearData} style={{ whiteSpace: "nowrap" }}>
            Clear All
          </PrimaryButton>
        </div>
      )}
    </section>
  );
}
