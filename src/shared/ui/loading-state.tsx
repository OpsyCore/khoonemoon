import { Card } from "@/shared/ui/card";

export function LoadingState({
  label = "در حال بارگذاری...",
}: {
  label?: string;
}) {
  return (
    <Card className="animate-pulse space-y-3 p-5">
      <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" />
      <p className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </Card>
  );
}
