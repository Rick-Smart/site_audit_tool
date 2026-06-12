export default function CsvSummaryTable({ summaries }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>CSV</th>
            <th>Rows</th>
            <th>Columns</th>
            <th>Null %</th>
            <th>Status Column</th>
            <th>Unhealthy</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.filename}>
              <td>{summary.filename}</td>
              <td>{summary.rows.toLocaleString()}</td>
              <td>{summary.columns}</td>
              <td>{summary.nullRatioPct.toFixed(2)}%</td>
              <td>{summary.statusColumn ?? "n/a"}</td>
              <td>{summary.unhealthyCount ?? "n/a"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}