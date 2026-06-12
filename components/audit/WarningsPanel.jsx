import Panel from "../ui/Panel";

export default function WarningsPanel({ errors }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Panel title="Parse Warnings" count={errors.length} warn revealClass="reveal delayed-3">
      <ul>
        {errors.map((error) => (
          <li key={`${error.file}-${error.message}`}>
            {error.file}: {error.message}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
