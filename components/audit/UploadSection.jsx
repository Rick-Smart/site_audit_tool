import UploadCard from "../ui/UploadCard";
import PrimaryButton from "../ui/PrimaryButton";

export default function UploadSection({ stats, onCsvChange, onBaselineCsvChange, onPngChange, onClearData }) {
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
        id="baseline-csv-input"
        title="Baseline CSVs"
        subtitle="Reference dataset for change tracking"
        triggerText="Select Baseline CSV Files"
        metaText={stats.baselineFiles > 0 ? `${stats.baselineFiles} loaded` : "No baseline selected"}
        accept=".csv,text/csv"
        onChange={onBaselineCsvChange}
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
        <div className="upload-card upload-card--clear">
          <div>
            <p className="upload-title upload-title--compact">Clear Data</p>
            <p className="upload-subtitle upload-subtitle--compact">Remove all uploaded files and start fresh</p>
          </div>
          <PrimaryButton onClick={onClearData} className="button--nowrap">
            Clear All
          </PrimaryButton>
        </div>
      )}
    </section>
  );
}
