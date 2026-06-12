import Panel from "../ui/Panel";
import CsvSummaryTable from "./csv/CsvSummaryTable";

export default function CsvSummaryPanel({ summaries }) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <Panel title="CSV Summary" count={summaries.length} revealClass="reveal delayed-4">
      <CsvSummaryTable summaries={summaries} />
    </Panel>
  );
}
