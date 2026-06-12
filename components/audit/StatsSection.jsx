import StatCard from "../ui/StatCard";

export default function StatsSection({ stats }) {
  return (
    <section className="stat-grid reveal delayed-1">
      <StatCard label="CSV Files" value={stats.files} />
      <StatCard label="Total Rows" value={stats.totalRows.toLocaleString()} />
      <StatCard label="Devices Parsed" value={stats.devices.toLocaleString()} />
      <StatCard label="Unhealthy Records" value={stats.unhealthy} tone={stats.unhealthy > 0 ? "warn" : "ok"} />
      <StatCard label="Topology Images" value={stats.topologyCount} />
    </section>
  );
}
