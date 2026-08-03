import type { SummaryResponse } from "@oracle/shared";

interface RunSummaryProps {
  summary: SummaryResponse | null;
  loading?: boolean;
}

export function RunSummary({ summary, loading }: RunSummaryProps) {
  if (loading) {
    return <p>Loading pipeline run summary…</p>;
  }

  if (!summary) {
    return (
      <p>
        Summary unavailable — API queries not wired yet. Connect{" "}
        <code>NEXT_PUBLIC_API_URL</code> and deploy the API to load live counts.
      </p>
    );
  }

  return (
    <section>
      <h1>Pipeline Run Summary</h1>
      <p>{summary.infraNote}</p>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Records</th>
            <th>Retrieved</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(summary.layers).map(([name, layer]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{layer.count.toLocaleString()}</td>
              <td>{layer.retrievedAt ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul>
        {summary.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
