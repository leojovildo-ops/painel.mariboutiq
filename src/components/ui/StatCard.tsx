export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="label">{label}</p>
      <p className="num mt-2 font-display text-xl font-bold text-creme sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-creme-700">{hint}</p>}
    </div>
  );
}
