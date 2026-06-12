export default function SectionHeader({ title, count, warn = false }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      {typeof count === "number" && (
        <span className={`badge ${warn ? "badge-warn" : ""}`.trim()}>{count}</span>
      )}
    </div>
  );
}
