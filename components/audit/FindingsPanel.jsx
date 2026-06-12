import Panel from "../ui/Panel";

export default function FindingsPanel({ findings }) {
  if (findings.length === 0) {
    return null;
  }

  return (
    <Panel title="Executive Findings" count={findings.length} revealClass="reveal delayed-3">
      <ul>
        {findings.map((finding) => (
          <li key={finding}>{finding}</li>
        ))}
      </ul>
    </Panel>
  );
}
