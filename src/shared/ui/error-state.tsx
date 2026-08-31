import { Button } from "@/shared/ui/button";

export function ErrorState({
  title = "مشکلی پیش آمد",
  description = "لطفاً دوباره تلاش کنید.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-paper">
      <div className="border-r-2 border-clay pr-4">
        <p className="text-sm font-semibold text-clay-ink">{title}</p>
        <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
        {onRetry ? (
          <Button variant="clay" size="sm" className="mt-4" onClick={onRetry}>
            تلاش مجدد
          </Button>
        ) : null}
      </div>
    </div>
  );
}
