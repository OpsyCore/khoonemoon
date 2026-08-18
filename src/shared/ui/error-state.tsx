import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

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
    <Card className="space-y-3 border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/30">
      <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
        {title}
      </p>
      <p className="text-sm text-rose-600 dark:text-rose-200">{description}</p>
      {onRetry ? (
        <Button variant="danger" size="sm" onClick={onRetry}>
          تلاش مجدد
        </Button>
      ) : null}
    </Card>
  );
}
