export function LoadingState({
  label = "در حال بارگذاری...",
}: {
  label?: string;
}) {
  return (
    <div className="animate-pulse space-y-3 rounded-card border border-line bg-card p-5 shadow-paper">
      <div className="h-4 w-32 rounded-full bg-kraft/50" />
      <div className="h-3 w-full rounded-full bg-kraft/40" />
      <div className="h-3 w-2/3 rounded-full bg-kraft/40" />
      <p className="pt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
