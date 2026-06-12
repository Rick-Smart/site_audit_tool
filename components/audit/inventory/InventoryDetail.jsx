export default function InventoryDetail({ activeMachine }) {
  if (!activeMachine) {
    return null;
  }

  return (
    <div className="machine-detail">
      <h3>Record Detail: {activeMachine.displayName}</h3>
      <pre>{JSON.stringify(activeMachine.raw, null, 2)}</pre>
    </div>
  );
}