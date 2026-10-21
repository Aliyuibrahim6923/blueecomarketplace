/**
 * Tiny dependency-free horizontal bar chart (accessible: a real table is
 * rendered for screen readers). Keeps dashboards light on slow connections.
 */
export function BarChart({
  title,
  data,
  format = (v) => v.toLocaleString("en-NG"),
  emptyText = "No data for this period yet.",
}: {
  title: string;
  data: { label: string; value: number }[];
  format?: (value: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="rounded-lg border border-border bg-white p-4">
      <figcaption className="text-sm font-semibold text-ocean-900">{title}</figcaption>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2" aria-hidden>
            {data.map((d) => (
              <li key={d.label} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2 text-sm">
                <span className="truncate text-muted-foreground">{d.label}</span>
                <span className="h-3 rounded-full bg-ocean-50">
                  <span className="block h-3 rounded-full bg-teal-500" style={{ width: `${(d.value / max) * 100}%` }} />
                </span>
                <span className="tabular-nums text-ocean-900">{format(d.value)}</span>
              </li>
            ))}
          </ul>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  <td>{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ocean-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
