import SectionHeader from "./SectionHeader";

export default function Panel({
  title,
  count,
  warn = false,
  revealClass = "",
  children,
}) {
  return (
    <section className={`panel ${warn ? "panel-warning" : ""} ${revealClass}`.trim()}>
      {(title || typeof count === "number") && <SectionHeader title={title} count={count} warn={warn} />}
      {children}
    </section>
  );
}
