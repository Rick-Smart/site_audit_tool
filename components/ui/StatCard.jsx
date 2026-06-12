export default function StatCard({ label, value, tone = "default" }) {
  const toneClass = tone === "warn" ? "warn-text" : tone === "ok" ? "ok-text" : "";

  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong className={toneClass}>{value}</strong>
    </article>
  );
}
